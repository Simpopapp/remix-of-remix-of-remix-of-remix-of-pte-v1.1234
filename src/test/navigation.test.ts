import { describe, expect, it } from "vitest";

import { nextQuestionId, prevQuestionId, questions } from "@/lib/pte";

describe("navegação entre questões (sem wrap-around)", () => {
  const first = questions[0]!.id;
  const last = questions[questions.length - 1]!.id;

  it("primeira questão não tem anterior", () => {
    expect(prevQuestionId(first)).toBeNull();
  });

  it("última questão não tem próxima", () => {
    expect(nextQuestionId(last)).toBeNull();
  });

  it("navega em ordem no meio do banco", () => {
    expect(nextQuestionId(first)).toBe(questions[1]!.id);
    expect(prevQuestionId(questions[1]!.id)).toBe(first);
  });
});
