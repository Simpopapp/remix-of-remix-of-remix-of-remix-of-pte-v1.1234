import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { questions } from "@/lib/pte";
import {
  computeStats,
  computeStreak,
  dailyProgress,
  dayKey,
  resetProgress,
  useAppState,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progresso — ReadAloud Trainer" },
      { name: "description", content: "Seu histórico de leituras, ritmo e evolução no Read Aloud do PTE." },
      { property: "og:title", content: "Progresso — ReadAloud Trainer" },
      { property: "og:description", content: "Seu histórico de leituras e evolução no Read Aloud do PTE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressPage,
});

function heatColor(volume: number): string {
  if (volume === 0) return "bg-secondary";
  if (volume <= 2) return "bg-primary/30";
  if (volume <= 5) return "bg-primary/60";
  return "bg-primary";
}

function ProgressPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const stats = useMemo(() => computeStats(app), [app]);
  const [confirmReset, setConfirmReset] = useState(false);

  const series = useMemo(() => dailyProgress(app, 14), [app]);
  const hasData = series.some((d) => d.trained);
  const todayKey = dayKey(Date.now());

  const topicScores = useMemo(() => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const q of questions) {
      const s = stats.get(q.id);
      if (!s || s.bestContent === null) continue;
      const cur = acc.get(q.topic) ?? { sum: 0, n: 0 };
      acc.set(q.topic, { sum: cur.sum + s.bestContent, n: cur.n + 1 });
    }
    return [...acc.entries()]
      .map(([topic, { sum, n }]) => ({ topic, avg: Math.round(sum / n), n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [stats]);

  const weak = useMemo(() => {
    return questions
      .filter((q) => {
        const s = stats.get(q.id);
        return !s || (s.bestContent ?? 0) < 90;
      })
      .sort((a, b) => {
        const sa = stats.get(a.id)?.bestContent ?? -1;
        const sb = stats.get(b.id)?.bestContent ?? -1;
        return sa - sb;
      })
      .slice(0, 10);
  }, [stats]);

  const recent = [...app.attempts].sort((a, b) => b.ts - a.ts).slice(0, 20);
  const streak = computeStreak(app);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16">
        <div className="flex items-end justify-between py-8">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">Progresso</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {app.attempts.length === 0
                ? "Sua primeira leitura começa o histórico."
                : `${streak} dia(s) de sequência · ${app.attempts.length} tentativa(s) registradas`}
            </p>
          </div>
          <Button onClick={() => navigate({ to: "/practice" })}>Treinar agora</Button>
        </div>

        {/* Evolução 14 dias */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">
            Evolução — últimos 14 dias
          </h2>
          {hasData ? (
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    yAxisId="score"
                    domain={[0, 100]}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <YAxis
                    yAxisId="wpm"
                    orientation="right"
                    domain={[0, "dataMax + 20"]}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelFormatter={(_, payload) => {
                      const day = payload?.[0]?.payload?.day as string | undefined;
                      return day ?? "";
                    }}
                    formatter={(value, name) => {
                      if (name === "volume") return [value, "tentativas"];
                      if (name === "score") return [value === null ? "—" : `${value}%`, "score médio"];
                      return [value === null ? "—" : `${value} ppm`, "WPM médio"];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="score" dataKey="volume" name="volume" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Line
                    yAxisId="score"
                    type="monotone"
                    dataKey="score"
                    name="score"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="wpm"
                    type="monotone"
                    dataKey="wpm"
                    name="wpm"
                    stroke="var(--color-warning)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Treine ao menos um dia para ver os gráficos de score, ritmo e volume.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Linha sólida: score médio de conteúdo (%) · Linha tracejada: WPM médio (eixo direito)
            · Barras: nº de tentativas no dia.
          </p>
        </section>

        {/* Heatmap de dias treinados */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">
            Dias treinados — sequência de {streak} dia(s)
          </h2>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {series.map((d) => (
              <div
                key={d.day}
                title={`${d.day}${d.day === todayKey ? " (hoje)" : ""}: ${d.volume} tentativa(s)`}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-[10px] tabular-nums transition-colors",
                  heatColor(d.volume),
                  d.day === todayKey
                    ? "text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-card"
                    : d.trained
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                )}
              >
                {d.label.slice(3)}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Cada quadrado é um dia dos últimos 14 — quanto mais escuro, mais tentativas. O contorno
            marca hoje.
          </p>
        </section>

        {/* Tópicos */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Melhor score por tópico</h2>
          {topicScores.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sem tentativas ainda.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {topicScores.map((t) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 truncate text-xs text-muted-foreground">{t.topic}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        t.avg >= 90 ? "bg-success" : t.avg >= 70 ? "bg-warning" : "bg-destructive",
                      )}
                      style={{ width: `${t.avg}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums">{t.avg}%</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Precisam de treino */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium text-muted-foreground">Precisam de treino</h2>
            {weak.length === 0 ? (
              <p className="mt-3 text-sm text-success">Tudo dominado por aqui. Excelente.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {weak.map((q) => (
                  <li key={q.id}>
                    <Link
                      to="/question/$id"
                      params={{ id: q.id }}
                      className="block truncate font-serif text-sm text-foreground/85 hover:text-foreground"
                    >
                      {q.text}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Últimas tentativas */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium text-muted-foreground">Últimas tentativas</h2>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma tentativa ainda.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {recent.map((a, i) => (
                  <li key={`${a.qid}-${a.ts}-${i}`} className="flex items-center justify-between gap-2">
                    <Link
                      to="/question/$id"
                      params={{ id: a.qid }}
                      className="truncate text-muted-foreground hover:text-foreground"
                    >
                      {new Date(a.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {a.qid.replace("pte-ra-", "")}
                    </Link>
                    <span className={cn("shrink-0 tabular-nums", a.contentScore === null ? "text-muted-foreground" : a.contentScore >= 90 ? "text-success" : "text-warning")}>
                      {a.contentScore === null ? "sem score" : `${a.contentScore}% · ${a.wpm} ppm`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Zerar */}
        <section className="mt-8 flex items-center justify-between rounded-2xl border border-border/60 p-5">
          <p className="text-sm text-muted-foreground">Zerar apaga todo o histórico, favoritos e sequência.</p>
          {confirmReset ? (
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => resetProgress()}>
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirmReset(true)}>
              Zerar progresso
            </Button>
          )}
        </section>
      </main>
    </div>
  );
}
