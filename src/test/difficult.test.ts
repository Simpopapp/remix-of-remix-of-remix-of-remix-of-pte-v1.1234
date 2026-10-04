import { describe, expect, it } from "vitest";

import { hardWordIndexes } from "@/lib/difficult";

describe("hardWordIndexes", () => {
  it("marca palavras longas e pouco frequentes", () => {
    const words = ["The", "government", "announced", "a", "new", "policy."];
    const idx = hardWordIndexes(words);
    expect(idx).toContain(1); // government (10 letras)
    expect(idx).toContain(2); // announced (9 letras, fora da lista comum)
    expect(idx).not.toContain(4); // new
  });

  it("não marca palavras curtas e comuns", () => {
    const words = ["This", "is", "a", "very", "good", "test"];
    expect(hardWordIndexes(words)).toEqual([]);
  });

  it("marca palavras de 8–9 letras fora da lista comum", () => {
    const words = ["economic", "growth"];
    const idx = hardWordIndexes(words);
    expect(idx).toContain(0); // economic
    expect(idx).not.toContain(1); // growth tem 6 letras
  });

  it("ignora pontuação ao medir o comprimento", () => {
    const words = ["significantly,"];
    expect(hardWordIndexes(words)).toContain(0);
  });
});
