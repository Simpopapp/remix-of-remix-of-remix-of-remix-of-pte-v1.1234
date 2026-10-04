import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { getQuestion, nextQuestionId, prevQuestionId, questionIndex, questions } from "@/lib/pte";
import {
  attemptsForQuestion,
  computeStats,
  isMasteredStat,
  toggleBookmark,
  useAppState,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/question/$id")({
  head: ({ params }) => {
    const q = getQuestion(params.id);
    const title = q ? `Questão ${q.id.replace("pte-ra-", "")} — ReadAloud Trainer` : "Questão — ReadAloud Trainer";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: q
            ? `Histórico de tentativas da questão ${q.id}: score de conteúdo, ritmo e evolução.`
            : "Detalhe de questão do Read Aloud do PTE.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Histórico de tentativas com score de conteúdo e ritmo.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: QuestionDetailPage,
});

function QuestionDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const app = useAppState();
  const question = getQuestion(id);

  const stats = useMemo(() => computeStats(app), [app]);
  const history = useMemo(() => attemptsForQuestion(app, id), [app, id]);

  if (!question) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <TopNav />
        <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-12 text-center">
          <h1 className="font-serif text-2xl font-semibold">Questão não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O endereço que você abriu não corresponde a nenhuma questão do banco.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate({ to: "/" })}>Voltar ao banco de questões</Button>
          </div>
        </main>
      </div>
    );
  }

  const number = questionIndex(id) + 1;
  const stat = stats.get(id);
  const mastered = isMasteredStat(stat);
  const bookmarked = app.bookmarks.includes(id);

  const scored = history.filter((a) => a.contentScore !== null);
  const sparkPoints = scored
    .slice()
    .reverse()
    .map((a, i, arr) => {
      const x = arr.length === 1 ? 50 : (i / (arr.length - 1)) * 100;
      const y = 100 - (a.contentScore ?? 0);
      return { x, y };
    });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <nav className="flex items-center justify-between py-6 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            ← Banco de questões
          </Link>
          <div className="flex gap-2 text-xs">
            {prevQuestionId(id) ? (
              <Link
                to="/question/$id"
                params={{ id: prevQuestionId(id)! }}
                className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="rounded-md border border-border/50 px-2 py-1 text-muted-foreground/40">← Anterior</span>
            )}
            {nextQuestionId(id) ? (
              <Link
                to="/question/$id"
                params={{ id: nextQuestionId(id)! }}
                className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
              >
                Próxima →
              </Link>
            ) : (
              <span className="rounded-md border border-border/50 px-2 py-1 text-muted-foreground/40">Próxima →</span>
            )}
          </div>
        </nav>

        {/* Cabeçalho da questão */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Questão {String(number).padStart(3, "0")} · {question.topic}
          </p>
          <p className="mt-3 font-serif text-xl leading-relaxed">{question.text}</p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5">{question.topic}</span>
            <span>{question.wordCount} palavras</span>
            <span>· {history.length} tentativa(s)</span>
            {stat?.bestContent !== null && stat?.bestContent !== undefined && (
              <span>· melhor {stat.bestContent}%</span>
            )}
            {mastered && <span className="text-success">· dominada ✓</span>}
          </p>
          {question.gradingNotes && (
            <p className="mt-3 text-xs text-muted-foreground">Nota de correção: {question.gradingNotes}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => navigate({ to: "/practice", search: { q: id } })}>
              Praticar esta questão
            </Button>
            <Button variant="outline" onClick={() => toggleBookmark(id)}>
              {bookmarked ? "★ Remover das difíceis" : "☆ Marcar como difícil"}
            </Button>
          </div>
        </section>

        {/* Resumo + sparkline */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Evolução do score de conteúdo</h2>
          {sparkPoints.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma tentativa com score ainda — pratique para ver a curva aqui.
            </p>
          ) : sparkPoints.length === 1 ? (
            <p className="mt-3 text-sm tabular-nums">
              Primeira tentativa: <span className="font-medium">{scored[0]?.contentScore}%</span>
              {scored[0]?.wpm !== null && scored[0]?.wpm !== undefined && (
                <span className="text-muted-foreground"> · {scored[0]?.wpm} ppm</span>
              )}
            </p>
          ) : (
            <div className="mt-3 h-20 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <polyline
                  points={sparkPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
                {sparkPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="var(--color-primary)" />
                ))}
              </svg>
            </div>
          )}
        </section>

        {/* Histórico */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Histórico de tentativas</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nunca tentada — seja a primeira vez.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/50">
              {history.map((a, i) => (
                <li key={`${a.qid}-${a.ts}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {new Date(a.ts).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                      {a.mode === "manual" ? "manual" : "voz"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      a.contentScore === null
                        ? "text-muted-foreground"
                        : a.contentScore >= 90
                          ? "text-success"
                          : "text-warning",
                    )}
                  >
                    {a.contentScore === null ? "sem score" : `${a.contentScore}%`}
                    {a.wpm !== null && a.wpm > 0 && (
                      <span className="text-muted-foreground"> · {a.wpm} ppm</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Veja também o banco completo ({questions.length} questões) na página inicial.
          </p>
        </section>
      </main>
    </div>
  );
}
