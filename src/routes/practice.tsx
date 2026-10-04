import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MicMeter } from "@/components/MicMeter";
import { PassageText, PASSAGE_SCALE_CLASSES } from "@/components/PassageText";
import { PassageToolbar } from "@/components/PassageToolbar";
import { ProgressRing } from "@/components/ProgressRing";
import { ScorePanel } from "@/components/ScorePanel";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { hardWordIndexes } from "@/lib/difficult";
import { chunkPassage } from "@/lib/shadow";
import { getQuestion, nextQuestionId, prevQuestionId, questionIndex, questions } from "@/lib/pte";
import { gradePassage, type GradeResult, type WordMark, type WordStatus } from "@/lib/scoring";
import { completeSessionItem, sessionFinished, sessionNextId, useSession } from "@/lib/session";
import { recordAttempt, toggleBookmark, updateSettings, useAppState } from "@/lib/storage";
import { useMicCapture } from "@/lib/useMicCapture";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { q?: string | undefined } = {};
    const q = search["q"];
    if (typeof q === "string" && q) out.q = q;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Praticar — ReadAloud Trainer" },
      { name: "description", content: "Leia o passage em voz alta e receba a correção palavra por palavra." },
      { property: "og:title", content: "Praticar — ReadAloud Trainer" },
      {
        property: "og:description",
        content: "Leia o passage em voz alta e receba a correção palavra por palavra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PracticePage,
});

type Phase = "idle" | "prep" | "recording" | "silenceConfirm" | "analyzing" | "result";

const MAX_RECORD_MS = 40000;

function PracticePage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const question = getQuestion(q) ?? questions[0];
  const app = useAppState();
  const settings = app.settings;
  const session = useSession();

  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(settings.prepSeconds);
  const [elapsed, setElapsed] = useState(0);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [modelRate, setModelRate] = useState(settings.modelRate);
  const [shortPrep, setShortPrep] = useState(false);
  const [notGradable, setNotGradable] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualMissed, setManualMissed] = useState<ReadonlySet<number>>(new Set());
  const [manualScore, setManualScore] = useState<number | null>(null);

  // shadowing (modelo lido frase a frase) + replay da própria voz
  const [shadowing, setShadowing] = useState(false);
  const [activeChunk, setActiveChunk] = useState<number | null>(null);
  const [ownPlaying, setOwnPlaying] = useState(false);

  const recognition = useSpeechRecognition();
  const synth = useSpeechSynthesis();
  const mic = useMicCapture();

  const audioRef = useRef<HTMLAudioElement>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const silenceRef = useRef(() => {});
  silenceRef.current = () => setPhase("silenceConfirm");

  const number = question ? questionIndex(question.id) + 1 : 0;
  const chunks = useMemo(() => (question ? chunkPassage(question.words) : []), [question?.id]);
  const hardWords = useMemo(
    () => (question && settings.showHardWords ? new Set(hardWordIndexes(question.words)) : undefined),
    [question?.id, settings.showHardWords],
  );

  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setGrade(null);
    setElapsed(0);
    setPrepLeft(settings.prepSeconds);
    setShortPrep(false);
    setNotGradable(false);
    setManualMode(false);
    setManualMissed(new Set());
    setManualScore(null);
    setShadowing(false);
    setActiveChunk(null);
    setOwnPlaying(false);
    recordedRef.current = false;
    mic.stop();
    mic.clear();
    synth.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, settings.prepSeconds]);

  useEffect(() => {
    resetToIdle();
  }, [resetToIdle]);

  const beginRecording = useCallback(() => {
    setPhase("recording");
    startedAtRef.current = Date.now();
    setElapsed(0);
    mic.start().catch(() => {});
    if (recognition.supported) {
      recognition.start({ onSilence: () => silenceRef.current(), lang: settings.accent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.supported, settings.accent]);

  const resumeRecording = useCallback(() => {
    setPhase("recording");
    if (recognition.supported) {
      recognition.start({ resume: true, onSilence: () => silenceRef.current(), lang: settings.accent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.supported, settings.accent]);

  const finish = useCallback(() => {
    if (phaseRef.current !== "recording" && phaseRef.current !== "silenceConfirm") return;
    recognition.stop();
    mic.stop();
    setPhase("analyzing");
    window.setTimeout(() => {
      const duration = Date.now() - startedAtRef.current;
      const micDenied = recognition.error === "not-allowed" || recognition.error === "network";
      if (!question) return;
      if (micDenied) {
        setGrade(null);
        setPhase("result");
        return;
      }
      if (recognition.supported) {
        const transcript = recognition.getTranscript();
        const g = gradePassage(question.words, transcript, duration, {
          pauses: recognition.getStats().pauses,
        });
        if (!g.gradable) {
          // transcrição curta demais: não registra 0% injusto
          setGrade(null);
          setNotGradable(true);
          setPhase("result");
          return;
        }
        setGrade(g);
        if (!recordedRef.current) {
          recordAttempt({
            qid: question.id,
            mode: "speech",
            contentScore: g.score,
            wpm: g.wpm,
            durationMs: duration,
          });
          recordedRef.current = true;
        }
        if (sessionRef.current.active && sessionNextId() === question.id) {
          completeSessionItem({ qid: question.id, score: g.score, wpm: g.wpm });
        }
      } else {
        setGrade(null);
        if (!recordedRef.current) {
          recordAttempt({ qid: question.id, mode: "manual", contentScore: null, wpm: null, durationMs: duration });
          recordedRef.current = true;
        }
      }
      setPhase("result");
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, recognition]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  // contagem de preparação
  useEffect(() => {
    if (phase !== "prep") return;
    const total = shortPrep ? 3 : settings.prepSeconds;
    if (total === 0) {
      beginRecording();
      return;
    }
    if (prepLeft <= 0) {
      beginRecording();
      return;
    }
    const t = window.setTimeout(() => setPrepLeft((p) => p - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, prepLeft, shortPrep, settings.prepSeconds, beginRecording]);

  // cronômetro da gravação + limite máximo
  useEffect(() => {
    if (phase !== "recording") return;
    const iv = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    return () => window.clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && elapsed >= MAX_RECORD_MS) finishRef.current();
  }, [phase, elapsed]);

  // questão inválida → corrige para a primeira
  useEffect(() => {
    if (!question && questions.length > 0) {
      navigate({ to: "/practice", search: { q: questions[0]!.id }, replace: true });
    }
  }, [question, navigate]);

  // replay da própria voz
  const toggleOwn = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (ownPlaying) {
      el.pause();
      setOwnPlaying(false);
      return;
    }
    if (!mic.url) return;
    if (el.src !== mic.url) el.src = mic.url;
    el.currentTime = 0;
    void el.play();
    setOwnPlaying(true);
  }, [ownPlaying, mic.url]);
  const toggleOwnRef = useRef(toggleOwn);
  toggleOwnRef.current = toggleOwn;

  // shadowing: modelo lido frase a frase, com destaque sincronizado
  const shadowRun = useCallback(
    (i: number) => {
      const chunk = chunks[i];
      if (!chunk) {
        setShadowing(false);
        setActiveChunk(null);
        return;
      }
      setActiveChunk(i);
      synth.speak(chunk.text, modelRate, () => {
        if (phaseRef.current !== "idle" && phaseRef.current !== "result") {
          setShadowing(false);
          setActiveChunk(null);
          return;
        }
        if (i + 1 < chunks.length) shadowRunRef.current(i + 1);
        else {
          setShadowing(false);
          setActiveChunk(null);
        }
      }, settings.voiceURI);
    },
    [chunks, modelRate, synth, settings.voiceURI],
  );
  const shadowRunRef = useRef(shadowRun);
  shadowRunRef.current = shadowRun;

  const startShadowing = useCallback(() => {
    if (chunks.length === 0) return;
    setShadowing(true);
    shadowRunRef.current(0);
  }, [chunks]);

  const shadowStop = useCallback(() => {
    synth.cancel();
    setShadowing(false);
    setActiveChunk(null);
  }, [synth]);

  const micDenied = recognition.error === "not-allowed" || recognition.error === "network";

  const navigateTo = useCallback(
    (id: string) => {
      navigate({ to: "/practice", search: { q: id } });
      // foco gerenciado após a navegação
      window.setTimeout(() => {
        document.querySelector<HTMLElement>("[data-focus-target]")?.focus();
      }, 0);
    },
    [navigate],
  );

  const goNext = useCallback(() => {
    if (!question) return;
    if (sessionRef.current.active) {
      if (sessionFinished()) {
        navigate({ to: "/session", search: { done: true } });
        return;
      }
      const nid = sessionNextId();
      if (nid) {
        navigateTo(nid);
        return;
      }
    }
    const nid = nextQuestionId(question.id);
    if (nid) navigateTo(nid);
  }, [question, navigateTo]);

  const goPrev = useCallback(() => {
    if (!question) return;
    const pid = prevQuestionId(question.id);
    if (pid) navigateTo(pid);
  }, [question, navigateTo]);

  // atalhos de teclado: Espaço inicia/para, setas navegam, R repete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A"].includes(target.tagName) ||
          target.isContentEditable ||
          target.getAttribute("role") === "button")
      ) {
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (phase === "idle") startPrep();
        else if (phase === "recording" || phase === "silenceConfirm") finishRef.current();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (phase === "result" && mic.url) toggleOwnRef.current();
        else if (phase === "idle" || phase === "result") {
          if (synth.speaking) synth.cancel();
          else if (question) synth.speak(question.text, modelRate, undefined, settings.voiceURI);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, question?.id, mic.url, modelRate, goNext, goPrev, synth, question, settings.voiceURI]);

  if (!question) return null;
  const bookmarked = app.bookmarks.includes(question.id);
  const prepTotal = shortPrep ? 3 : settings.prepSeconds;

  const startPrep = () => {
    setGrade(null);
    setElapsed(0);
    setPrepLeft(shortPrep ? 3 : settings.prepSeconds);
    setNotGradable(false);
    setManualMode(false);
    setManualMissed(new Set());
    setManualScore(null);
    setOwnPlaying(false);
    if (shadowing) shadowStop();
    mic.clear();
    setPhase("prep");
    recognition.clearError();
  };

  const toggleManualWord = (i: number) => {
    setManualMissed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const registerManualScore = () => {
    const total = question.words.length;
    const score = Math.round(((total - manualMissed.size) / total) * 100);
    recordAttempt({ qid: question.id, mode: "manual", contentScore: score, wpm: null, durationMs: 0 });
    if (sessionRef.current.active && sessionNextId() === question.id) {
      completeSessionItem({ qid: question.id, score, wpm: null });
    }
    setManualScore(score);
    setManualMode(false);
  };

  const manualMarks: WordMark[] | undefined = manualMode
    ? question.words.map((word, i) => ({
        word,
        status: (manualMissed.has(i) ? "missed" : "hit") as WordStatus,
      }))
    : undefined;

  const sessionProgress = session.active ? Math.round((session.index / Math.max(session.size, 1)) * 100) : 0;
  const activeRange = shadowing && activeChunk !== null ? chunks[activeChunk] : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-44">
        {/* Cabeçalho da questão */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 py-5 transition-opacity",
            settings.focusMode && "opacity-40 focus-within:opacity-100",
          )}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-serif text-base font-semibold text-foreground">
              Questão {number} <span className="text-muted-foreground">/ {questions.length}</span>
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5">{question.topic}</span>
            <span>{question.wordCount} palavras</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Marcar como difícil"
              className={cn("text-base", bookmarked ? "text-primary" : "text-muted-foreground")}
              onClick={() => toggleBookmark(question.id)}
            >
              ★
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={!prevQuestionId(question.id)}
            >
              ← Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={!session.active && !nextQuestionId(question.id)}
            >
              Próxima →
            </Button>
          </div>
        </div>

        {/* Progresso da sessão */}
        {session.active ? (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground" aria-live="polite">
                Sessão · {session.index} de {session.size}
              </span>
              <span className="tabular-nums">{sessionProgress}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${sessionProgress}%` }} />
            </div>
          </div>
        ) : null}

        {/* Passage */}
        <div
          data-focus-target
          tabIndex={-1}
          className={cn(
            "print-area rounded-2xl border border-border bg-card p-6 outline-none md:p-8",
            settings.focusMode && "ring-1 ring-primary/40",
          )}
        >
          <PassageToolbar
            scale={settings.passageScale}
            maxScale={PASSAGE_SCALE_CLASSES.length - 1}
            onScale={(next) => updateSettings({ passageScale: next })}
            showHard={settings.showHardWords}
            onToggleHard={() => updateSettings({ showHardWords: !settings.showHardWords })}
            focus={settings.focusMode}
            onToggleFocus={() => updateSettings({ focusMode: !settings.focusMode })}
          />
          <PassageText
            words={question.words}
            marks={manualMarks ?? (phase === "result" && grade ? grade.marks : undefined)}
            onWordClick={manualMode ? toggleManualWord : undefined}
            activeRange={activeRange}
            hardWords={hardWords}
            karaoke={settings.focusMode}
            scaleClass={PASSAGE_SCALE_CLASSES[settings.passageScale]}
          />
        </div>

        {/* Resultado / instruções */}
        <div className={cn("mt-6 space-y-4 transition-opacity", settings.focusMode && phase !== "result" && "opacity-40")}>
          {phase === "result" && micDenied ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Precisamos do microfone para corrigir sua leitura.</p>
              <p className="mt-1 text-muted-foreground">
                Libere o acesso no ícone de cadeado da barra de endereço e tente de novo.
              </p>
              <Button size="sm" className="mt-3" onClick={startPrep}>
                Tentar de novo
              </Button>
            </div>
          ) : null}
          {phase === "result" && grade ? <ScorePanel grade={grade} /> : null}
          {phase === "result" && notGradable && !manualMode ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-medium">Não foi possível avaliar esta leitura.</p>
              <p className="mt-1 text-muted-foreground">
                A transcrição ficou curta demais — fale mais perto do microfone e tente de novo, ou marque os erros
                você mesmo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={startPrep}>
                  Tentar de novo
                </Button>
                <Button size="sm" variant="outline" onClick={() => setManualMode(true)}>
                  Marcar erros manualmente
                </Button>
              </div>
            </div>
          ) : null}
          {phase === "silenceConfirm" ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-medium">Detectamos uma pausa longa.</p>
              <p className="mt-1 text-muted-foreground">Concluir a leitura agora ou continuar falando?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => finishRef.current()}>
                  Concluir e corrigir
                </Button>
                <Button size="sm" variant="outline" onClick={resumeRecording}>
                  Continuar lendo
                </Button>
              </div>
            </div>
          ) : null}
          {manualMode ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-medium">Toque nas palavras que você errou.</p>
              <p className="mt-1 text-muted-foreground">
                Score previsto:{" "}
                <span className="font-medium text-foreground">
                  {Math.round(((question.words.length - manualMissed.size) / question.words.length) * 100)}%
                </span>{" "}
                · {manualMissed.size} palavra{manualMissed.size === 1 ? "" : "s"} marcada
                {manualMissed.size === 1 ? "" : "s"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={registerManualScore} disabled={manualScore !== null}>
                  Registrar score manual
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setManualMode(false)}>
                  Cancelar
                </Button>
              </div>
              {manualScore !== null ? (
                <p className="mt-3 text-sm font-medium text-success">
                  Score manual registrado: {manualScore}%.
                </p>
              ) : null}
            </div>
          ) : null}
          {phase === "result" && !grade && !notGradable && !micDenied && !manualMode ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Leitura registrada{recognition.supported ? "" : " (este navegador não corrige automaticamente)"}.
              Ouça o modelo e compare a entonação — ou tente de novo.
            </div>
          ) : null}
          {(phase === "idle" || phase === "prep") && question.prompt ? (
            <p className="text-sm italic text-muted-foreground">{question.prompt}</p>
          ) : null}
        </div>
      </main>

      {/* Barra de ação inferior */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="min-w-0 text-sm text-muted-foreground">
            {phase === "idle" && "Preparado? Leia com ritmo natural e articulação clara."}
            {phase === "prep" && "Preparação — leia mentalmente e organize a entonação."}
            {phase === "recording" && (
              <span className="flex flex-wrap items-center gap-2">
                <span className="rec-pulse inline-block h-2.5 w-2.5 rounded-full bg-destructive" />
                Gravando… {(elapsed / 1000).toFixed(1)}s
                <MicMeter level={mic.level} />
              </span>
            )}
            {phase === "silenceConfirm" && "Pausa longa detectada — o que prefere fazer?"}
            {phase === "analyzing" && "Analisando sua leitura…"}
            {phase === "result" && "Revise as palavras destacadas no passage."}
          </div>
          <div className="flex min-w-0 flex-1 basis-0 flex-wrap items-center justify-end gap-2">
            {(phase === "idle" || phase === "result") && (
              <>
                {!shadowing ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      synth.speaking
                        ? synth.cancel()
                        : synth.speak(question.text, modelRate, undefined, settings.voiceURI)
                    }
                  >
                    {synth.speaking ? "Parar modelo" : "Ouvir modelo"}
                  </Button>
                ) : null}
                <Button variant={shadowing ? "destructive" : "outline"} onClick={shadowing ? shadowStop : startShadowing}>
                  {shadowing ? "Parar shadowing" : "Modo shadowing"}
                </Button>
              </>
            )}
            {synth.supported && !shadowing && (phase === "idle" || phase === "result") ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModelRate((r) => (r === 1 ? 0.8 : 1))}
                aria-label="Alternar velocidade do modelo"
              >
                {modelRate}×
              </Button>
            ) : null}

            {phase === "idle" && (
              <Button size="lg" onClick={startPrep}>
                Iniciar preparação
              </Button>
            )}

            {phase === "prep" && (
              <>
                <ProgressRing value={prepTotal > 0 ? 1 - prepLeft / prepTotal : 1} size={56}>
                  <span className="font-serif text-lg font-semibold tabular-nums" aria-live="assertive">
                    {prepTotal === 0 ? "—" : Math.max(0, prepLeft)}
                  </span>
                </ProgressRing>
                <Button size="lg" onClick={beginRecording}>
                  Começar agora
                </Button>
              </>
            )}

            {phase === "recording" && (
              <Button size="lg" variant="destructive" onClick={() => finishRef.current()}>
                {recognition.supported ? "Parar e corrigir" : "Concluir leitura"}
              </Button>
            )}

            {phase === "silenceConfirm" && (
              <>
                <Button variant="outline" onClick={resumeRecording}>
                  Continuar lendo
                </Button>
                <Button size="lg" onClick={() => finishRef.current()}>
                  Concluir e corrigir
                </Button>
              </>
            )}

            {phase === "analyzing" && (
              <Button size="lg" disabled>
                Analisando…
              </Button>
            )}

            {phase === "result" && (
              <>
                {mic.url ? (
                  <Button variant="outline" onClick={toggleOwn}>
                    {ownPlaying ? "Parar minha leitura" : "Ouvir minha leitura"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={startPrep}
                >
                  Tentar de novo
                </Button>
                <Button size="lg" onClick={goNext}>
                  {session.active ? "Próxima da sessão" : "Próxima questão"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Áudio da própria leitura (replay) */}
      <audio ref={audioRef} className="hidden" onEnded={() => setOwnPlaying(false)} />
    </div>
  );
}
