import { useSyncExternalStore } from "react";

import { questions } from "@/lib/pte";
import type { QuestionStat } from "@/lib/storage";

export interface SessionResult {
  qid: string;
  score: number | null;
  wpm: number | null;
}

export interface SessionState {
  active: boolean;
  size: number;
  queue: string[];
  index: number; // próxima questão a responder
  startedAt: number;
  results: SessionResult[];
}

const IDLE: SessionState = { active: false, size: 0, queue: [], index: 0, startedAt: 0, results: [] };

let state: SessionState = IDLE;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fila inteligente: questões fracas (score < 90 ou nunca tentadas) primeiro,
 * depois as menos recentemente tentadas, com intercalação (2 fracas : 1 revisão).
 */
export function buildQueue(stats: Map<string, QuestionStat>, size: number): string[] {
  const weak = questions.filter((q) => {
    const s = stats.get(q.id);
    return !s || (s.bestContent ?? 0) < 90;
  });
  const rest = questions.filter((q) => {
    const s = stats.get(q.id);
    return !!s && (s.bestContent ?? 0) >= 90;
  });
  weak.sort((a, b) => {
    const sa = stats.get(a.id);
    const sb = stats.get(b.id);
    const ca = sa?.bestContent ?? -1;
    const cb = sb?.bestContent ?? -1;
    if (ca !== cb) return ca - cb;
    return (sa?.lastAttemptAt ?? 0) - (sb?.lastAttemptAt ?? 0) || Math.random() - 0.5;
  });
  rest.sort((a, b) => {
    const ta = stats.get(a.id)?.lastAttemptAt ?? 0;
    const tb = stats.get(b.id)?.lastAttemptAt ?? 0;
    return ta - tb || Math.random() - 0.5;
  });

  const out: string[] = [];
  let wi = 0;
  let ri = 0;
  while (out.length < size && (wi < weak.length || ri < rest.length)) {
    for (let k = 0; k < 2 && wi < weak.length && out.length < size; k++) out.push(weak[wi++]!.id);
    if (ri < rest.length && out.length < size) out.push(rest[ri++]!.id);
  }
  return out;
}

export function startSession(size: number, stats: Map<string, QuestionStat>) {
  state = {
    active: true,
    size,
    queue: buildQueue(stats, size),
    index: 0,
    startedAt: Date.now(),
    results: [],
  };
  emit();
}

/** Próxima questão da sessão (undefined se encerrada ou concluída). */
export function sessionNextId(): string | undefined {
  if (!state.active) return undefined;
  return state.queue[state.index];
}

/** Registra o resultado da questão atual e avança a fila. */
export function completeSessionItem(result: SessionResult) {
  if (!state.active) return;
  state = { ...state, index: state.index + 1, results: [...state.results, result] };
  emit();
}

export function sessionFinished(): boolean {
  return state.active && state.index >= state.queue.length;
}

export function endSession() {
  state = IDLE;
  emit();
}

const getSnapshot = () => state;

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, () => IDLE);
}
