#!/usr/bin/env bash
# Runtime genérico da sandbox: instala -> configura -> sobe -> testa o OpenCode web.
#
# NÃO é parte de nenhum app: funciona em QUALQUER projeto nesta sandbox.
# Nenhum nome de app, rota de negócio ou path absoluto de projeto aparece aqui.
# O workspace é sempre a raiz passada como argumento (ou o diretório atual).
#
# Uso:
#   bash tools/setup-opencode.sh [ROOT] [--skip-proof] [--check] [--install-proxy-only]
#   bun run opencode:up          # atalho (package.json) -> tools/setup-opencode.sh .
#
# Env:
#   OPENCODE_PORT=4096 OPENCODE_HOST=127.0.0.1 OPENCODE_BIN=/path/binário
#   OPENCODE_MODEL=opencode/muse-spark-1.3-contributor-free SKIP_PROOF=0/1
#
# Etapas (idempotentes, seguro rodar N vezes):
#   1. Binário  — resolve sem depender do PATH (npm -g / opencode.exe / bun / env).
#   2. Config   — cria <ROOT>/opencode.json mínimo SOMENTE se não existir.
#   3. Servidor — sobe `opencode serve` em background se /api/health não responder.
#   4. Prova    — pede ao agente para escrever um token em <ROOT>/.opencode-healthcheck
#                (DENTRO do workspace: escrita fora dele trava em permissão external_directory).
#   5. Proxy    — garante <ROOT>/vite-opencode-proxy.ts + registra opencodeProxy()
#                no vite.config.* para expor o web em <preview>/oc/ sem criar rotas no app.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT=""; SKIP_PROOF="${SKIP_PROOF:-0}"; CHECK_ONLY=0; PROXY_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --skip-proof) SKIP_PROOF=1 ;;
    --check) CHECK_ONLY=1 ;;
    --install-proxy-only) PROXY_ONLY=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) [ -z "$ROOT" ] && ROOT="$arg" ;;
  esac
done
ROOT="$(cd "${ROOT:-$PWD}" && pwd)"
PORT="${OPENCODE_PORT:-4096}"
HOST="${OPENCODE_HOST:-127.0.0.1}"
MODEL="${OPENCODE_MODEL:-opencode/muse-spark-1.3-contributor-free}"
LOG="/tmp/opencode-web.log"
PIDFILE="/tmp/opencode/opencode.pid"
URL="http://$HOST:$PORT"
mkdir -p /tmp/opencode

log() { echo "[opencode-setup] $*"; }
fail() { echo "[opencode-setup] ERRO: $*" >&2; exit 1; }

# ---------- 1. Binário (não depende do PATH) ----------
resolve_bin() {
  [ -n "${OPENCODE_BIN:-}" ] && [ -x "${OPENCODE_BIN:-}" ] && { echo "$OPENCODE_BIN"; return 0; }
  command -v opencode 2>/dev/null && return 0
  local prefix=""
  prefix="$(npm prefix -g 2>/dev/null || true)"
  for b in \
    "$prefix/bin/opencode" \
    "$prefix/lib/node_modules/opencode-ai/bin/opencode.exe" \
    "$prefix/lib/node_modules/opencode-ai/bin/opencode" \
    "$HOME/.bun/bin/opencode" \
    "$HOME/.local/bin/opencode" \
    "/bin/opencode" \
    "/usr/bin/opencode"; do
    [ -n "$b" ] && [ -x "$b" ] && { echo "$b"; return 0; }
  done
  return 1
}

# ---------- 5. Proxy (função declarada cedo p/ --install-proxy-only) ----------
ensure_proxy() {
  local tmpl="$SCRIPT_DIR/vite-opencode-proxy.ts"
  local dest="$ROOT/vite-opencode-proxy.ts"
  if [ ! -f "$dest" ]; then
    if [ -f "$tmpl" ]; then
      cp "$tmpl" "$dest" && log "proxy instalado em $dest (template runtime)"
    else
      log "AVISO: template $tmpl ausente; pulando instalação do proxy."
      return 0
    fi
  fi
  local cfg=""
  for c in vite.config.ts vite.config.mts vite.config.js vite.config.mjs; do
    [ -f "$ROOT/$c" ] && { cfg="$ROOT/$c"; break; }
  done
  [ -z "$cfg" ] && { log "sem vite.config.* em $ROOT; proxy pronto, sem patch."; return 0; }
  grep -q "opencodeProxy" "$cfg" && { log "proxy já registrado em $(basename "$cfg")"; return 0; }
  log "registrando opencodeProxy() em $(basename "$cfg")..."
  python3 - "$cfg" <<'PYEOF'
import re, sys
p = sys.argv[1]
s = open(p).read()
if "opencodeProxy" in s:
    sys.exit(0)
# 1. import ao lado dos demais imports (ou no topo)
imp = 'import { opencodeProxy } from "./vite-opencode-proxy";\n'
if not re.search(r'^\s*import\s', s, re.M):
    s = imp + s
else:
    s = re.sub(r'(^\s*import[^\n]*\n)', r'\1' + imp, s, count=1)
# 2a. wrapper @lovable.dev/vite-tanstack-config: vite: { plugins: [...] }
m = re.search(r'vite\s*:\s*\{\s*plugins\s*:\s*\[', s)
if m:
    s = s[:m.end()] + "opencodeProxy(), " + s[m.end():]
    open(p, "w").write(s)
    sys.exit(0)
# 2b. config vite pura: plugins: [...]
m2 = re.search(r'plugins\s*:\s*\[', s)
if m2:
    s = s[:m2.end()] + "opencodeProxy(), " + s[m2.end():]
    open(p, "w").write(s)
    sys.exit(0)
sys.exit(2)
PYEOF
  case $? in
    0) log "proxy registrado em $(basename "$cfg") (reinicie o dev server se preciso)" ;;
    *) log "AVISO: patch automático não se aplicou a $(basename "$cfg"). Faça manual:"
       log "       1) import { opencodeProxy } from \"./vite-opencode-proxy\";"
       log "       2) vite: { plugins: [opencodeProxy()] } no defineConfig. Alvo: <preview>/oc/" ;;
  esac
}

[ "$PROXY_ONLY" = "1" ] && { ensure_proxy; exit 0; }

BIN="$(resolve_bin)" || {
  log "instalando opencode-ai (npm -g)..."
  npm i -g opencode-ai >/tmp/opencode/install.log 2>&1 || fail "instalação falhou (ver /tmp/opencode/install.log)"
  BIN="$(resolve_bin)" || fail "binário não encontrado após instalação"
}
log "binário: $BIN"

healthy() { [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$URL/api/health" 2>/dev/null)" = "200" ]; }
[ "$CHECK_ONLY" = "1" ] && { healthy && { log "OK em $URL"; exit 0; } || fail "fora do ar em $URL"; }

# ---------- 2. Config mínima (nunca sobrescreve a do projeto) ----------
if [ ! -f "$ROOT/opencode.json" ]; then
  cat >"$ROOT/opencode.json" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "$MODEL",
  "permission": { "read": "allow", "edit": "allow", "write": "allow", "bash": "allow", "webfetch": "allow" }
}
EOF
  log "opencode.json padrão criado em $ROOT (modelo $MODEL)"
fi

# ---------- 3. Servidor (idempotente) ----------
if healthy; then
  log "já está no ar em $URL"
else
  log "subindo servidor em $URL (workspace $ROOT)..."
  (cd "$ROOT" && nohup "$BIN" serve --port "$PORT" --hostname "$HOST" >"$LOG" 2>&1 & echo $! >"$PIDFILE")
  ok=0
  for _ in $(seq 1 30); do healthy && { ok=1; break; }; sleep 1; done
  [ "$ok" = "1" ] || { log "não respondeu; últimas linhas de $LOG:"; tail -n 30 "$LOG" 2>/dev/null; exit 1; }
  log "no ar (PID $(cat "$PIDFILE" 2>/dev/null || echo ?))"
fi

# ---------- 4. Prova em disco (SEMPRE dentro do workspace) ----------
if [ "$SKIP_PROOF" != "1" ]; then
  TOKEN="hc-$(date +%s)-$$"; PROOF="$ROOT/.opencode-healthcheck"
  SID="$(curl -s --max-time 10 -X POST "$URL/session?directory=$ROOT" -H 'content-type: application/json' \
    -d '{"title":"healthcheck"}' | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null || true)"
  if [ -n "$SID" ]; then
    curl -s --max-time 120 -X POST "$URL/session/$SID/message?directory=$ROOT" -H 'content-type: application/json' \
      -d "{\"agent\":\"build\",\"parts\":[{\"type\":\"text\",\"text\":\"Write exactly '$TOKEN' (no newline) to the file .opencode-healthcheck in the project root. Do nothing else.\"}]}" \
      >/dev/null 2>&1 &
    for _ in $(seq 1 60); do grep -q "$TOKEN" "$PROOF" 2>/dev/null && break; sleep 2; done
  fi
  if grep -q "$TOKEN" "$PROOF" 2>/dev/null; then log "prova OK ($TOKEN em .opencode-healthcheck)"; else log "prova FALHOU (ver $LOG)"; exit 1; fi
else
  log "prova pulada (SKIP_PROOF=1)"
fi

# ---------- 5. Proxy /oc/ ----------
ensure_proxy
log "OpenCode web: $URL  |  no preview: <preview-url>/oc/ (runtime, fora das rotas do app)"
