export interface ShadowChunk {
  text: string;
  /** Índice da primeira palavra da fatia (inclusive). */
  from: number;
  /** Índice da última palavra da fatia (inclusive). */
  to: number;
}

const SENTENCE_END = /[.!?]["')\]]?$/;
const ABBREVIATION = /^(?:[A-Za-z]\.|Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|vs|etc|e\.g|i\.e)\.$/i;

/**
 * Fatia o passage frase a frase para o modo shadowing. Não quebra em
 * abreviações curtas com ponto (ex.: "Dr.", "e.g.").
 */
export function chunkPassage(words: string[]): ShadowChunk[] {
  const chunks: ShadowChunk[] = [];
  let from = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? "";
    const isLast = i === words.length - 1;
    if (isLast || (SENTENCE_END.test(word) && !ABBREVIATION.test(word))) {
      chunks.push({ text: words.slice(from, i + 1).join(" "), from, to: i });
      from = i + 1;
    }
  }
  if (from < words.length) {
    chunks.push({ text: words.slice(from).join(" "), from, to: words.length - 1 });
  }
  return chunks;
}
