import { useSyncExternalStore } from "react";

export type Accent = "en-AU" | "en-US" | "en-GB";

export interface Attempt {
  qid: string;
  ts: number;
  mode: "speech" | "manual";
  contentScore: number | null;
  wpm: number | null;
  durationMs: number;
}

export interface Settings {
  prepSeconds: number; // 0 = sem contagem
  dailyGoal: number;
  modelRate: number;
  accent: Accent;
  /** voiceURI da voz do modelo; "" = automática. */
  voiceURI: string;
  /** Tamanho da fonte do passage — índice em PASSAGE_SCALE_CLASSES (1 = padrão). */
  passageScale: number;
  /** Destaque prévio de palavras longas/pouco frequentes. */
  showHardWords: boolean;
  /** Modo foco (karaokê durante o modelo). */
  focusMode: boolean;
  /** Preferência de movimento: seguir sistema, sempre reduzir ou nunca reduzir. */
  motion: "system" | "reduce" | "full";
}

export interface AppState {
  version: 1;
  attempts: Attempt[];
  bookmarks: string[];
  settings: Settings;
}

export interface QuestionStat {
  attempts: number;
  bestContent: number | null;
  bestWpm: number | null;
  lastAttemptAt: number;
}

const KEY = "readaloud-trainer-v1";

export const DEFAULT_SETTINGS: Settings = {
  prepSeconds: 40,
  dailyGoal: 10,
  modelRate: 1,
  accent: "en-AU",
  voiceURI: "",
  passageScale: 1,
  showHardWords: false,
  focusMode: false,
  motion: "system",
};

export const ACCENT_OPTIONS: { value: Accent; label: string }[] = [
  { value: "en-AU", label: "Australiano (padrão PTE)" },
  { value: "en-US", label: "Americano" },
  { value: "en-GB", label: "Britânico" },
];

function emptyState(preserveSettings?: Settings): AppState {
  return {
    version: 1,
    attempts: [],
    bookmarks: [],
    settings: preserveSettings ? { ...preserveSettings } : { ...DEFAULT_SETTINGS },
  };
}

const EMPTY = emptyState();

function normalizeSettings(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  const accent: Accent =
    s.accent === "en-US" || s.accent === "en-GB" || s.accent === "en-AU" ? s.accent : DEFAULT_SETTINGS.accent;
  const motion = s.motion === "reduce" || s.motion === "full" ? s.motion : "system";
  const passageScale =
    typeof s.passageScale === "number" &&
    Number.isInteger(s.passageScale) &&
    s.passageScale >= 0 &&
    s.passageScale <= 3
      ? s.passageScale
      : DEFAULT_SETTINGS.passageScale;
  return {
    prepSeconds: typeof s.prepSeconds === "number" && s.prepSeconds >= 0 ? s.prepSeconds : DEFAULT_SETTINGS.prepSeconds,
    dailyGoal: typeof s.dailyGoal === "number" && s.dailyGoal > 0 ? s.dailyGoal : DEFAULT_SETTINGS.dailyGoal,
    modelRate: typeof s.modelRate === "number" && s.modelRate > 0 ? s.modelRate : DEFAULT_SETTINGS.modelRate,
    accent,
    voiceURI: typeof s.voiceURI === "string" ? s.voiceURI : DEFAULT_SETTINGS.voiceURI,
    passageScale,
    showHardWords: s.showHardWords === true,
    focusMode: s.focusMode === true,
    motion,
  };
}

function load(): AppState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1) return emptyState();
    return {
      version: 1,
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      settings: normalizeSettings(parsed.settings),
    };
  } catch (err) {
    console.warn("Progresso ilegível — iniciando com estado limpo.", err);
    return emptyState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* modo privado/cheio: segue em memória */
  }
}

function setState(next: AppState) {
  state = next;
  if (typeof window !== "undefined") persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function recordAttempt(attempt: Omit<Attempt, "ts"> & { ts?: number }) {
  const entry: Attempt = { ts: attempt.ts ?? Date.now(), ...attempt };
  setState({ ...state, attempts: [...state.attempts, entry] });
}

export function toggleBookmark(qid: string) {
  const has = state.bookmarks.includes(qid);
  setState({
    ...state,
    bookmarks: has ? state.bookmarks.filter((id) => id !== qid) : [...state.bookmarks, qid],
  });
}

export function updateSettings(patch: Partial<Settings>) {
  setState({ ...state, settings: { ...state.settings, ...patch } });
}

/** Zera histórico e favoritos, mas preserva os ajustes do usuário. */
export function resetProgress() {
  setState(emptyState(state.settings));
}

// ---------- backup (export/import JSON) ----------

export function exportBackup(): string {
  return JSON.stringify(
    {
      app: "readaloud-trainer",
      version: 1,
      exportedAt: new Date().toISOString(),
      attempts: state.attempts,
      bookmarks: state.bookmarks,
      settings: state.settings,
    },
    null,
    2,
  );
}

export function importBackup(json: string): { ok: boolean; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "o arquivo não é um JSON válido" };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj["app"] !== "readaloud-trainer") {
    return { ok: false, error: "este arquivo não é um backup deste app" };
  }
  const attempts = obj["attempts"];
  const bookmarks = obj["bookmarks"];
  if (!Array.isArray(attempts) || attempts.some((a) => typeof a !== "object" || a === null || typeof (a as Attempt).qid !== "string")) {
    return { ok: false, error: "histórico de tentativas inválido" };
  }
  if (!Array.isArray(bookmarks) || bookmarks.some((b) => typeof b !== "string")) {
    return { ok: false, error: "lista de favoritos inválida" };
  }
  setState({
    version: 1,
    attempts: attempts as Attempt[],
    bookmarks: bookmarks as string[],
    settings: normalizeSettings(obj["settings"]),
  });
  return { ok: true };
}

// ---------- derivados (puros, testáveis) ----------

export function computeStats(app: AppState): Map<string, QuestionStat> {
  const map = new Map<string, QuestionStat>();
  for (const a of app.attempts) {
    if (a.mode !== "speech" || a.contentScore === null) continue;
    const cur = map.get(a.qid);
    if (!cur) {
      map.set(a.qid, { attempts: 1, bestContent: a.contentScore, bestWpm: a.wpm, lastAttemptAt: a.ts });
    } else {
      cur.attempts += 1;
      cur.lastAttemptAt = Math.max(cur.lastAttemptAt, a.ts);
      if (a.contentScore > (cur.bestContent ?? -1)) {
        cur.bestContent = a.contentScore;
        cur.bestWpm = a.wpm;
      }
    }
  }
  return map;
}

export function isMasteredStat(stat: QuestionStat | undefined): boolean {
  return !!stat && (stat.bestContent ?? 0) >= 90 && (stat.bestWpm ?? 0) >= 120 && (stat.bestWpm ?? 0) <= 160;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Streak de dias consecutivos com ao menos uma tentativa, contando a partir de hoje (ou ontem, se hoje ainda não treinou). */
export function computeStreak(app: AppState): number {
  if (app.attempts.length === 0) return 0;
  const days = new Set(app.attempts.map((a) => dayKey(a.ts)));
  const DAY = 86400000;
  const start = days.has(dayKey(Date.now())) ? Date.now() : Date.now() - DAY;
  let streak = 0;
  for (let t = start; days.has(dayKey(t)); t -= DAY) streak += 1;
  return streak;
}

export function attemptedToday(app: AppState): number {
  const today = dayKey(Date.now());
  const seen = new Set(app.attempts.filter((a) => dayKey(a.ts) === today).map((a) => a.qid));
  return seen.size;
}

/** Score médio de conteúdo das tentativas dos últimos `days` dias (null se nenhuma). */
export function recentAverage(app: AppState, days: number): number | null {
  const since = Date.now() - days * 86400000;
  const scores = app.attempts.filter((a) => a.mode === "speech" && a.contentScore !== null && a.ts >= since);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, a) => sum + (a.contentScore ?? 0), 0) / scores.length);
}

export function averageWpm(app: AppState): number | null {
  const wpms = app.attempts.filter((a) => a.wpm !== null && a.wpm > 0);
  if (wpms.length === 0) return null;
  return Math.round(wpms.reduce((sum, a) => sum + (a.wpm ?? 0), 0) / wpms.length);
}

export interface DailyProgress {
  day: string;
  /** rótulo curto MM-DD para o eixo do gráfico */
  label: string;
  /** score médio de conteúdo do dia (null se sem score) */
  score: number | null;
  /** WPM médio do dia (null se sem leitura válida) */
  wpm: number | null;
  /** nº de tentativas no dia */
  volume: number;
  /** true se treinou neste dia */
  trained: boolean;
}

/** Série diária (últimos `days` dias) com score médio, WPM médio e volume — base dos gráficos. */
export function dailyProgress(app: AppState, days: number): DailyProgress[] {
  const out: DailyProgress[] = [];
  const DAY = 86400000;
  for (let i = days - 1; i >= 0; i--) {
    const ts = Date.now() - i * DAY;
    const key = dayKey(ts);
    const dayAttempts = app.attempts.filter((a) => dayKey(a.ts) === key);
    const scored = dayAttempts.filter((a) => a.contentScore !== null);
    const withWpm = dayAttempts.filter((a) => a.wpm !== null && (a.wpm ?? 0) > 0);
    out.push({
      day: key,
      label: key.slice(5),
      score: scored.length
        ? Math.round(scored.reduce((s, a) => s + (a.contentScore ?? 0), 0) / scored.length)
        : null,
      wpm: withWpm.length
        ? Math.round(withWpm.reduce((s, a) => s + (a.wpm ?? 0), 0) / withWpm.length)
        : null,
      volume: dayAttempts.length,
      trained: dayAttempts.length > 0,
    });
  }
  return out;
}

/** Tentativas de uma questão, mais recentes primeiro. */
export function attemptsForQuestion(app: AppState, qid: string): Attempt[] {
  return app.attempts.filter((a) => a.qid === qid).sort((a, b) => b.ts - a.ts);
}

/** Score médio por dia (últimos `days` dias), para o gráfico. */
export function dailyAverages(app: AppState, days: number): { day: string; score: number | null }[] {
  const out: { day: string; score: number | null }[] = [];
  const DAY = 86400000;
  for (let i = days - 1; i >= 0; i--) {
    const ts = Date.now() - i * DAY;
    const key = dayKey(ts);
    const scores = app.attempts.filter((a) => dayKey(a.ts) === key && a.contentScore !== null);
    out.push({
      day: key,
      score: scores.length
        ? Math.round(scores.reduce((s, a) => s + (a.contentScore ?? 0), 0) / scores.length)
        : null,
    });
  }
  return out;
}
