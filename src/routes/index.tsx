import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FilterBar, type AttemptsFilter, type SizeFilter, type SortMode, type StatusFilter } from "@/components/FilterBar";
import { ProgressRing } from "@/components/ProgressRing";
import { QuestionRow } from "@/components/QuestionRow";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { questions, TOTAL_QUESTIONS, pickContinueId } from "@/lib/pte";
import {
  attemptedToday,
  averageWpm,
  computeStats,
  computeStreak,
  recentAverage,
  toggleBookmark,
  useAppState,
} from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReadAloud Trainer — treino de Read Aloud do PTE" },
      {
        name: "description",
        content:
          "Pratique as 148 questões de Read Aloud do PTE com correção palavra por palavra, ritmo e progresso.",
      },
      { property: "og:title", content: "ReadAloud Trainer — treino de Read Aloud do PTE" },
      {
        property: "og:description",
        content: "Pratique as 148 questões de Read Aloud do PTE com correção palavra por palavra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const app = useAppState();
  const stats = useMemo(() => computeStats(app), [app]);

  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("bank");
  const [size, setSize] = useState<SizeFilter>("all");
  const [attempts, setAttempts] = useState<AttemptsFilter>("all");
  const [visible, setVisible] = useState(25);

  // Volta ao primeiro lote sempre que um filtro muda
  useEffect(() => {
    setVisible(25);
  }, [search, topic, status, sort, size, attempts]);

  const todayCount = attemptedToday(app);
  const goal = app.settings.dailyGoal;
  const streak = computeStreak(app);
  const avg7 = recentAverage(app, 7);
  const wpm = averageWpm(app);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = questions.filter((q) => {
      if (topic && q.topic !== topic) return false;
      if (needle && !q.text.toLowerCase().includes(needle)) return false;
      if (size === "short" && q.wordCount >= 40) return false;
      if (size === "medium" && (q.wordCount < 40 || q.wordCount >= 50)) return false;
      if (size === "long" && q.wordCount < 50) return false;
      const s = stats.get(q.id);
      if (attempts === "never" && s) return false;
      if (attempts === "weak" && (!s || (s.bestContent ?? 0) >= 70)) return false;
      if (attempts === "good" && (!s || (s.bestContent ?? 0) < 90)) return false;
      if (status === "untried") return !stats.has(q.id);
      if (status === "starred") return app.bookmarks.includes(q.id);
      if (status === "weak") {
        return !s || (s.bestContent ?? 0) < 90;
      }
      return true;
    });
    if (sort === "weak") {
      list = [...list].sort((a, b) => {
        const sa = stats.get(a.id)?.bestContent ?? 999;
        const sb = stats.get(b.id)?.bestContent ?? 999;
        return sa - sb;
      });
    } else if (sort === "long") {
      list = [...list].sort((a, b) => b.wordCount - a.wordCount);
    }
    return list;
  }, [search, topic, status, sort, size, attempts, stats, app.bookmarks]);

  const shown = filtered.slice(0, visible);

  const continueId = pickContinueId(
    (id) => {
      const s = stats.get(id);
      return !!s && (s.bestContent ?? 0) >= 90 && (s.bestWpm ?? 0) >= 120 && (s.bestWpm ?? 0) <= 160;
    },
    (id) => stats.get(id)?.lastAttemptAt ?? 0,
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16">
        {/* Hero */}
        <section className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              {streak > 0 ? `${streak} dia${streak > 1 ? "s" : ""} seguido${streak > 1 ? "s" : ""} de treino` : "Comece sua sequência hoje"}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              Leia em voz alta. <span className="text-primary">Corrija palavra por palavra.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {TOTAL_QUESTIONS} questões oficiais de Read Aloud do PTE, com correção de conteúdo,
              ritmo e modelo de áudio.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="lg" onClick={() => navigate({ to: "/practice", search: { q: continueId } })}>
                {app.attempts.length === 0 ? "Começar agora" : "Continuar treino"}
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate({ to: "/session" })}>
                Sessão de treino
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate({ to: "/progress" })}>
                Ver progresso
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <ProgressRing value={goal > 0 ? todayCount / goal : 0} size={96}>
              <div className="text-center">
                <div className="font-serif text-xl font-semibold">{todayCount}</div>
                <div className="text-[10px] text-muted-foreground">de {goal} hoje</div>
              </div>
            </ProgressRing>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Média 7 dias</dt>
                <dd className="font-medium">{avg7 === null ? "—" : `${avg7}%`}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ritmo médio</dt>
                <dd className="font-medium">{wpm === null ? "—" : `${wpm} ppm`}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Lista */}
        <section className="mt-4 rounded-2xl border border-border bg-card">
          <div className="border-b border-border/60 p-4">
            <FilterBar
              search={search}
              onSearch={setSearch}
              topic={topic}
              onTopic={setTopic}
              status={status}
              onStatus={setStatus}
              sort={sort}
              onSort={setSort}
              size={size}
              onSize={setSize}
              attempts={attempts}
              onAttempts={setAttempts}
              resultCount={filtered.length}
              visibleCount={visible}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma questão encontrada — tente limpar os filtros.
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTopic("");
                    setStatus("all");
                    setSize("all");
                    setAttempts("all");
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {shown.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  number={questions.indexOf(q) + 1}
                  stat={stats.get(q.id)}
                  bookmarked={app.bookmarks.includes(q.id)}
                  onToggleBookmark={toggleBookmark}
                />
              ))}
              {visible < filtered.length && (
                <div className="flex justify-center p-4">
                  <Button variant="outline" onClick={() => setVisible((v) => v + 25)}>
                    Mostrar mais ({filtered.length - visible} restantes)
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
