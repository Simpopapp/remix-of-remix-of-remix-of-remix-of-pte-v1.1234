# ReadAloud Trainer

Treino de Read Aloud do PTE com correção automática (alinhamento por sequência),
sessões guiadas, progresso com gráficos e ajustes de prática — tudo local
(localStorage), sem contas.

## Funcionalidades

- 148 questões com correção com ordem (hit/missed/substituted/moved) e proxies de fluência
- Sessão de treino (5/10/15) com fila inteligente e resumo final
- Progresso: score + WPM + volume (14 dias), heatmap de dias, detalhe por questão
- Passage: A−/A+, palavras difíceis destacadas, modo foco, impressão, shadowing
- Replay da própria voz, medidor de microfone, seletor de sotaque (en-AU padrão) e voz
- Backup: export/import JSON; zerar progresso preserva os ajustes

## Desenvolvimento

```sh
npm i
npm run dev        # http://localhost:8080
npm run test       # vitest
npm run build
```
