import { Link } from "@tanstack/react-router";
import type { Question } from "@/lib/pte";
import type { QuestionStat } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface QuestionRowProps {
  question: Question;
  number: number;
  stat: QuestionStat | undefined;
  bookmarked: boolean;
  onToggleBookmark: (qid: string) => void;
}

function statusOf(stat: QuestionStat | undefined): { label: string; dot: string } {
  if (!stat || stat.attempts === 0) return { label: "não tentada", dot: "bg-muted-foreground/40" };
  if ((stat.bestContent ?? 0) >= 90 && (stat.bestWpm ?? 0) >= 120 && (stat.bestWpm ?? 0) <= 160)
    return { label: `dominada · ${stat.bestContent}%`, dot: "bg-success" };
  if ((stat.bestContent ?? 0) >= 90) return { label: `conteúdo ok · ritmo a ajustar`, dot: "bg-warning" };
  return { label: `melhor ${stat.bestContent}%`, dot: "bg-destructive" };
}

export function QuestionRow({ question, number, stat, bookmarked, onToggleBookmark }: QuestionRowProps) {
  const status = statusOf(stat);
  return (
    <div className="group flex items-start gap-3 border-b border-border/50 px-3 py-3 transition-colors last:border-0 hover:bg-secondary/40">
      <span className="w-10 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
        {String(number).padStart(3, "0")}
      </span>
      <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", status.dot)} title={status.label} />
      <Link to="/practice" search={{ q: question.id }} className="min-w-0 flex-1">
        <p className="truncate font-serif text-[15px] leading-snug text-foreground/90 group-hover:text-foreground">
          {question.text}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-secondary px-2 py-0.5">{question.topic}</span>
          <span>{question.wordCount} palavras</span>
          <span>· {status.label}</span>
        </p>
      </Link>
      <Link
        to="/question/$id"
        params={{ id: question.id }}
        aria-label={`Ver histórico da questão ${number}`}
        title="Ver histórico"
        className="mt-1 shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
      >
        ⓘ
      </Link>
      <button
        type="button"
        aria-label={bookmarked ? "Remover das difíceis" : "Marcar como difícil"}
        onClick={() => onToggleBookmark(question.id)}
        className={cn(
          "mt-1 shrink-0 rounded-md px-2 py-1 text-base leading-none transition-colors hover:bg-secondary",
          bookmarked ? "text-primary" : "text-muted-foreground/40",
        )}
      >
        ★
      </button>
    </div>
  );
}
