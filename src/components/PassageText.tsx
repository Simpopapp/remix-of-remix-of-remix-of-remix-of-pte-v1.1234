import type { WordMark } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/** Tamanhos de fonte do passage (A− / A+ no toolbar). Índice 1 = padrão. */
export const PASSAGE_SCALE_CLASSES = [
  "text-[20px] md:text-[24px]",
  "text-[26px] md:text-[30px]",
  "text-[30px] md:text-[35px]",
  "text-[34px] md:text-[40px]",
] as const;

interface PassageTextProps {
  words: string[];
  /** Quando presente, renderiza o mapa de correção (hit/missed/substituted/moved). */
  marks: WordMark[] | undefined;
  compact?: boolean;
  /** Modo manual: toque nas palavras para marcar/desmarcar erros. */
  onWordClick?: ((index: number) => void) | undefined;
  /** Shadowing: destaque sincronizado do trecho sendo lido pelo modelo. */
  activeRange?: { from: number; to: number } | undefined;
  /** Palavras longas/pouco frequentes pré-destacadas (só quando não há correção). */
  hardWords?: ReadonlySet<number> | undefined;
  /** Modo foco (karaokê): escurece as palavras fora do trecho ativo. */
  karaoke?: boolean | undefined;
  /** Classes de tamanho da fonte (PASSAGE_SCALE_CLASSES). Ignorado em compact. */
  scaleClass?: string | undefined;
}

const markClasses: Record<WordMark["status"], string> = {
  hit: "text-foreground",
  missed: "text-muted-foreground/60 line-through decoration-destructive/70 decoration-2",
  substituted: "text-warning",
  moved: "text-info underline decoration-dotted",
};

export function PassageText({
  words,
  marks,
  compact,
  onWordClick,
  activeRange,
  hardWords,
  karaoke,
  scaleClass,
}: PassageTextProps) {
  const sizeClasses = compact ? "text-lg leading-relaxed md:text-xl" : (scaleClass ?? "text-[26px] md:text-[30px]");
  return (
    <p
      className={cn(
        "font-serif leading-[1.75] tracking-[0.01em] text-balance",
        sizeClasses,
        karaoke && "transition-colors duration-300",
      )}
    >
      {words.map((word, i) => {
        const mark = marks?.[i];
        const inActive = !!activeRange && i >= activeRange.from && i <= activeRange.to;
        const dimmed = karaoke && !!activeRange && !inActive;
        const hard = !marks && hardWords?.has(i);
        return (
          <span
            key={`${word}-${i}`}
            role={onWordClick ? "button" : undefined}
            tabIndex={onWordClick ? 0 : undefined}
            onClick={onWordClick ? () => onWordClick(i) : undefined}
            onKeyDown={
              onWordClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onWordClick(i);
                    }
                  }
                : undefined
            }
            className={cn(
              "inline-block whitespace-pre",
              mark && "word-mark rounded-sm px-0.5",
              mark && markClasses[mark.status],
              onWordClick && "cursor-pointer rounded-sm px-0.5 hover:bg-secondary",
              dimmed && "text-muted-foreground/30",
              hard && "underline decoration-warning/70 decoration-wavy decoration-2 underline-offset-4",
              inActive && "bg-primary/15",
            )}
            {...(onWordClick ? { "data-word": "" } : {})}
            style={mark ? { animationDelay: `${Math.min(i * 18, 900)}ms` } : undefined}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}
