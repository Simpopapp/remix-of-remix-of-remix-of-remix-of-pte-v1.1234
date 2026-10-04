# PRD — ReadAloud Trainer v2 (projeto 1)

Fonte: `.opencode/project1` — melhorias de utilidade + UX/UI, sem auth/multiusuário.

## Objetivo
Transformar o trainer básico em ferramenta de treino diário: correção com ordem, sessões guiadas, backup local e progresso que ensina.

## Fase 1 (P0 — escopo desta entrega)
- **Trilha A — motor de correção**
  - Scoring com ordem: alinhamento por sequência (tipo LCS/Needleman-Wunsch) sobre palavras normalizadas; status hit/missed/substituted + novo status **moved** (palavra certa fora de ordem) com penalidade parcial.
  - Proxies de fluência: pausas longas e repetições exibidos no ScorePanel.
  - Guarda contra 0% injusto: transcrição vazia/curta demais → estado "não avaliável, tente de novo" em vez de 0%.
  - Seletor de sotaque do reconhecimento (en-US/en-AU/en-GB), padrão **en-AU**.
  - Modo manual: tocar nas palavras que errou para gerar score manual quando não há correção automática.
- **Trilha E — backup (P0 dentro da trilha)**
  - Export/import JSON do progresso completo.
  - Zerar o progresso preserva os ajustes (preparação, meta, ritmo, sotaque).
- **Trilha B — sessão mínima**
  - "Treinar N questões" (5/10/15) com fila, shuffle inteligente (fracas primeiro + menos recentes + intercalação), barra "3/10", sem voltar à home entre questões, resumo ao final.

## Fases seguintes (ver roadmap-proj1)
2 — prática completa (mic meter, replay, shadowing, teclado) · 3 — inteligência (tópicos, charts, detalhe por questão) · 4 — polish (leitura, técnico/a11y).

## Fora de escopo
Auth, contas, nuvem, replay de voz, shadowing, PWA.
