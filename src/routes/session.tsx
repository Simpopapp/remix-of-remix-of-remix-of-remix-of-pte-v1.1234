import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { getQuestion } from "@/lib/pte";
import { endSession, sessionFinished, sessionNextId, startSession, useSession } from "@/lib/session";
import { computeStats, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { done?: true } = {};
    if (search["done"] === "1") out.done = true;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Sessão de treino — ReadAloud Trainer" },
      { name: "description", content: "Treine 5, 10 ou 15 questões seguidas, com fila inteligente e resumo final." },
      { property: "og:title", content: "Sessão de treino — ReadAloud Trainer" },
      {
        property: "og:description",
        content: "Treine 5, 10 ou 15 questões seguidas, com fila inteligente e resumo final.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionPage,
});

const sizeOptions = [5, 10, 15];

function SessionPage() {
  const { done } = Route.useSearch();
  const navigate = useNavigate();
  const app = useAppState();
  const session = useSession();
  const [size, setSize] = useState(10);

  // Resumo da sessão concluída
  if (session.active && (done || sessionFinished())) {
    const graded = session.results.filter((r) => r.score !== null);
    const avg = graded.length
      ? Math.round(graded.reduce((sum, r) => sum + (r.score ?? 0), 0) / graded.length)
      : null;
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <TopNav />
        <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Sessão concluída</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
              {session.results.length} questões lidas
            </h1>
            {avg !== null ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Média de conteúdo: <span className="font-medium text-foreground">{avg}%</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Sem scores automáticos nesta sessão.</p>
            )}
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            {session.results.map((r, i) => {
              const q = getQuestion(r.qid);
              return (
                <div
                  key={`${r.qid}-${i}`}
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3",
                    i > 0 && "border-t border-border/60",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground/85">{q?.text ?? r.qid}</span>
                  <span
                    className={cn(
                      "shrink-0 text-sm tabular-nums",
                      r.score === null
                        ? "text-muted-foreground"
                        : r.score >= 90
                          ? "text-success"
                          : r.score >= 70
                            ? "text-warning"
                            : "text-destructive",
                    )}
                  >
                    {r.score === null ? "—" : `${r.score}% · ${r.wpm ?? "—"} ppm`}
                  </span>
                </div>
              );
            })}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              onClick={() => {
                endSession();
                setSize(size);
              }}
            >
              Nova sessão
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate({ to: "/" })}>
              Voltar ao início
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Sessão em andamento
  if (session.active) {
    const nextId = sessionNextId();
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <TopNav />
        <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Sessão em andamento</h1>
          <div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {session.index} de {session.size} concluídas
              </span>
              <span className="tabular-nums">{Math.round((session.index / Math.max(session.size, 1)) * 100)}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(session.index / Math.max(session.size, 1)) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              disabled={!nextId}
              onClick={() => nextId && navigate({ to: "/practice", search: { q: nextId } })}
            >
              Continuar sessão
            </Button>
            <Button size="lg" variant="outline" onClick={() => endSession()}>
              Encerrar sessão
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Configuração
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Sessão de treino</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Questões em sequência, sem voltar ao início: primeiro as que você mais erra, depois revisões espaçadas.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-medium">Quantas questões?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {sizeOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSize(n)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm transition-colors",
                  size === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                Treinar {n}
              </button>
            ))}
          </div>
          <Button
            size="lg"
            className="mt-5"
            onClick={() => {
              startSession(size, computeStats(app));
              const first = sessionNextId();
              if (first) navigate({ to: "/practice", search: { q: first } });
            }}
          >
            Começar sessão de {size}
          </Button>
        </section>
      </main>
    </div>
  );
}
