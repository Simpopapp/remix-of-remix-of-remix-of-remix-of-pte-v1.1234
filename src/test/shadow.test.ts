import { describe, expect, it } from "vitest";

import { chunkPassage } from "@/lib/shadow";
import { tokenize } from "@/lib/pte";

describe("shadowing — fatias de frase", () => {
  it("separa frases e mapeia índices das palavras", () => {
    const words = tokenize("First sentence ends here. A second follows! Finally done.");
    const chunks = chunkPassage(words);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ text: "First sentence ends here.", from: 0, to: 3 });
    expect(chunks[1]).toMatchObject({ text: "A second follows!", from: 4, to: 6 });
    expect(chunks[2]).toMatchObject({ text: "Finally done.", from: 7, to: 8 });
  });

  it("passage sem pontuação vira uma única fatia", () => {
    const chunks = chunkPassage(tokenize("one two three four"));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe("one two three four");
    expect(chunks[0]!.to).toBe(3);
  });

  it("palavras com pontuação anexada são tratadas como fim de frase", () => {
    const chunks = chunkPassage(tokenize("The city grew. It changed."));
    expect(chunks).toHaveLength(2);
    expect(chunks[1]!.text).toBe("It changed.");
  });

  it("abreviações curtas não quebram a frase", () => {
    const chunks = chunkPassage(tokenize("Dr. Smith lives nearby. Yes."));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.text).toBe("Dr. Smith lives nearby.");
  });
});
