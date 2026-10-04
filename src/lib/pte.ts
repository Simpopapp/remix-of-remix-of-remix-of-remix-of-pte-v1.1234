import raw from "@/data/pte-read-aloud.json";

export interface Question {
  id: string;
  text: string;
  words: string[];
  wordCount: number;
  topic: string;
  prompt: string;
  gradingNotes: string;
  source: string;
}

interface RawQuestion {
  id?: string;
  text?: string;
  content?: string;
  word_count?: number;
  topic?: string;
  prompt?: string;
  grading_notes?: string;
  source?: string;
}

const rawQuestions = ((raw as { questions?: RawQuestion[] }).questions ?? []) as RawQuestion[];

export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export const questions: Question[] = rawQuestions
  .map((q, i) => {
    const text = (q.content?.trim() || q.text?.trim() || "").replace(/\s+/g, " ").trim();
    const words = tokenize(text);
    return {
      id: q.id?.trim() || `pte-ra-${i + 1}`,
      text,
      words,
      wordCount: q.word_count && q.word_count > 0 ? q.word_count : words.length,
      topic: q.topic?.trim() || "sem tópico",
      prompt: q.prompt?.trim() || "",
      gradingNotes: q.grading_notes?.trim() || "",
      source: q.source?.trim() || "",
    };
  })
  .filter((q) => q.text.length > 0);

export const TOTAL_QUESTIONS = questions.length;

export const topics: { topic: string; count: number }[] = Array.from(
  questions.reduce((map, q) => map.set(q.topic, (map.get(q.topic) ?? 0) + 1), new Map<string, number>()),
)
  .map(([topic, count]) => ({ topic, count }))
  .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

const byId = new Map(questions.map((q) => [q.id, q]));

export function getQuestion(id: string | undefined): Question | undefined {
  return id ? byId.get(id) : undefined;
}

export function questionIndex(id: string): number {
  return questions.findIndex((q) => q.id === id);
}

/** Próxima questão na ordem do banco; null no fim (sem wrap-around). */
export function nextQuestionId(id: string): string | null {
  const i = questionIndex(id);
  if (i < 0 || i >= questions.length - 1) return null;
  return questions[i + 1]!.id;
}

/** Questão anterior na ordem do banco; null no início (sem wrap-around). */
export function prevQuestionId(id: string): string | null {
  const i = questionIndex(id);
  if (i <= 0) return null;
  return questions[i - 1]!.id;
}

/** Primeira questão (ordem do banco) ainda não dominada; se todas dominadas, a menos recente tentada. */
export function pickContinueId(isMastered: (id: string) => boolean, lastAttemptOf: (id: string) => number): string {
  const first = questions.find((q) => !isMastered(q.id));
  if (first) return first.id;
  return questions.reduce((best, q) => {
    const t = lastAttemptOf(q.id);
    const b = lastAttemptOf(best);
    return t < b ? q.id : best;
  }, questions[0]?.id ?? "");
}
