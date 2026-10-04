import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { MicMeter } from "@/components/MicMeter";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { exportBackup, importBackup, updateSettings, useAppState, ACCENT_OPTIONS, type Accent } from "@/lib/storage";
import { useMicCapture } from "@/lib/useMicCapture";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — ReadAloud Trainer" },
      {
        name: "description",
        content: "Prepare seu treino: tempo de preparação, meta diária, velocidade do modelo, sotaque e backup.",
      },
      { property: "og:title", content: "Ajustes — ReadAloud Trainer" },
      {
        property: "og:description",
        content: "Tempo de preparação, meta diária, sotaque do reconhecimento e backup do progresso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const prepOptions = [
  { value: 20, label: "20 s" },
  { value: 30, label: "30 s" },
  { value: 40, label: "40 s (padrão PTE)" },
  { value: 0, label: "Sem contagem" },
];

const goalOptions = [5, 10, 15, 20];
const rateOptions = [
  { value: 1, label: "1.0× (normal)" },
  { value: 0.8, label: "0.8× (mais lento)" },
  { value: 1.2, label: "1.2× (mais rápido)" },
];

function OptionGroup<T extends number | string>({
  title,
  description,
  options,
  current,
  onSelect,
}: {
  title: string;
  description: string;
  options: { value: T; label: string }[];
  current: T;
  onSelect: (value: T) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onSelect(o.value)}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition-colors",
              current === o.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingsPage() {
  const app = useAppState();
  const s = app.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [micMsg, setMicMsg] = useState<string | null>(null);
  const micTest = useMicCapture();
  const { voices } = useSpeechSynthesis();

  const exportar = () => {
    try {
      const blob = new Blob([exportBackup()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `readaloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg("Backup exportado — guarde o arquivo baixado.");
    } catch {
      setBackupMsg("Não foi possível exportar agora.");
    }
  };

  const importar = async (file: File) => {
    try {
      const text = await file.text();
      const result = importBackup(text);
      setBackupMsg(result.ok ? "Progresso restaurado com sucesso." : `Arquivo inválido: ${result.error}`);
    } catch {
      setBackupMsg("Não foi possível ler o arquivo.");
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Ajustes</h1>

        <OptionGroup
          title="Preparação"
          description="Tempo para ler o passage mentalmente antes de gravar (o PTE dá 40 s)."
          options={prepOptions}
          current={s.prepSeconds}
          onSelect={(v) => updateSettings({ prepSeconds: v })}
        />
        <OptionGroup
          title="Meta diária"
          description="Quantas questões diferentes você quer ler por dia."
          options={goalOptions.map((g) => ({ value: g, label: `${g} questões` }))}
          current={s.dailyGoal}
          onSelect={(v) => updateSettings({ dailyGoal: v })}
        />
        <OptionGroup
          title="Velocidade do modelo"
          description="Velocidade padrão ao ouvir o passage lido pela voz do navegador."
          options={rateOptions}
          current={s.modelRate}
          onSelect={(v) => updateSettings({ modelRate: v })}
        />

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-medium">Voz do modelo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Voz do navegador usada ao ouvir o passage. Automática escolhe a melhor voz em inglês disponível.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ voiceURI: "" })}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition-colors",
                s.voiceURI === ""
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              Automática (recomendada)
            </button>
            {voices.map((v) => (
              <button
                key={v.voiceURI}
                type="button"
                onClick={() => updateSettings({ voiceURI: v.voiceURI })}
                className={cn(
                  "max-w-full truncate rounded-full px-4 py-2 text-sm transition-colors",
                  s.voiceURI === v.voiceURI
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {v.name} ({v.lang})
              </button>
            ))}
          </div>
          {voices.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Nenhuma voz em inglês listada ainda — os navegadores costumam carregá-las segundos após abrir a página.
            </p>
          ) : null}
        </section>

        <OptionGroup<"system" | "reduce" | "full">
          title="Animações"
          description={
            'Reduzir animações ajuda quem tem sensibilidade a movimento. "Seguir sistema" usa a preferência do aparelho.'
          }
          options={[
            { value: "system", label: "Seguir sistema" },
            { value: "reduce", label: "Sempre reduzir" },
            { value: "full", label: "Animações completas" },
          ]}
          current={s.motion}
          onSelect={(v) => updateSettings({ motion: v })}
        />
        <OptionGroup<Accent>
          title="Sotaque do reconhecimento"
          description="Sotaque usado para transcrever sua leitura. O PTE usa inglês australiano."
          options={ACCENT_OPTIONS}
          current={s.accent}
          onSelect={(v) => updateSettings({ accent: v })}
        />

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-medium">Teste do microfone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fale normalmente e veja o sinal subir — se as barras ficarem baixas, aproxime-se do microfone antes de
            treinar.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {micTest.recording ? (
              <>
                <MicMeter level={micTest.level} bars={20} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    micTest.stop();
                    setMicMsg(null);
                  }}
                >
                  Parar teste
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMicMsg(null);
                  micTest.start().catch(() => setMicMsg("Não foi possível acessar o microfone — verifique a permissão do navegador."));
                }}
              >
                Testar microfone
              </Button>
            )}
            {micMsg ? <p className="w-full text-sm text-destructive">{micMsg}</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-medium">Backup do progresso</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu histórico vive só neste navegador. Exporte um arquivo JSON para guardar ou levar para outro
            dispositivo — e importe de volta quando quiser.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportar}>
              Exportar backup
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importar(file);
                e.target.value = "";
              }}
            />
          </div>
          {backupMsg ? <p className="mt-3 text-sm text-foreground/85">{backupMsg}</p> : null}
        </section>

        <p className="text-xs text-muted-foreground">
          Tudo é salvo automaticamente neste navegador. Nenhuma conta, nenhum servidor.
        </p>
      </main>
    </div>
  );
}
