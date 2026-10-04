import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PassageToolbarProps {
  scale: number;
  maxScale: number;
  onScale: (next: number) => void;
  showHard: boolean;
  onToggleHard: () => void;
  focus: boolean;
  onToggleFocus: () => void;
}

/** Controles de leitura do passage: tamanho da fonte, palavras difíceis, modo foco e impressão. */
export function PassageToolbar({
  scale,
  maxScale,
  onScale,
  showHard,
  onToggleHard,
  focus,
  onToggleFocus,
}: PassageToolbarProps) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Diminuir tamanho da fonte"
          disabled={scale <= 0}
          onClick={() => onScale(scale - 1)}
        >
          A−
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Aumentar tamanho da fonte"
          disabled={scale >= maxScale}
          onClick={() => onScale(scale + 1)}
        >
          A+
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={showHard}
          className={cn(!showHard && "text-muted-foreground")}
          onClick={onToggleHard}
        >
          Palavras difíceis
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={focus}
          className={cn(!focus && "text-muted-foreground")}
          onClick={onToggleFocus}
        >
          Modo foco
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>
    </div>
  );
}
