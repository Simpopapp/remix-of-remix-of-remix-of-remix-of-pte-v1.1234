import { topics } from "@/lib/pte";
import { cn } from "@/lib/utils";

export type StatusFilter = "all" | "untried" | "weak" | "starred";
export type SortMode = "bank" | "weak" | "long";
/** curta: <40 palavras · média: 40–49 · longa: 50+ */
export type SizeFilter = "all" | "short" | "medium" | "long";
/** nunca tentada · fracas: melhor score <70 · boas: melhor score ≥90 */
export type AttemptsFilter = "all" | "never" | "weak" | "good";

interface FilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  topic: string;
  onTopic: (value: string) => void;
  status: StatusFilter;
  onStatus: (value: StatusFilter) => void;
  sort: SortMode;
  onSort: (value: SortMode) => void;
  size: SizeFilter;
  onSize: (value: SizeFilter) => void;
  attempts: AttemptsFilter;
  onAttempts: (value: AttemptsFilter) => void;
  resultCount: number;
  visibleCount: number;
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "untried", label: "Não tentadas" },
  { value: "weak", label: "Precisam de treino" },
  { value: "starred", label: "★ Difíceis" },
];

const sortOptions: { value: SortMode; label: string }[] = [
  { value: "bank", label: "Ordem do banco" },
  { value: "weak", label: "Mais difíceis" },
  { value: "long", label: "Mais longas" },
];

const sizeOptions: { value: SizeFilter; label: string }[] = [
  { value: "all", label: "Todos os tamanhos" },
  { value: "short", label: "Curta (<40 palavras)" },
  { value: "medium", label: "Média (40–49)" },
  { value: "long", label: "Longa (50+)" },
];

const attemptsOptions: { value: AttemptsFilter; label: string }[] = [
  { value: "all", label: "Todas as tentativas" },
  { value: "never", label: "Nunca tentada" },
  { value: "weak", label: "Fracas (<70%)" },
  { value: "good", label: "Boas (≥90%)" },
];

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder="Buscar no texto das questões…"
          className="min-w-56 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring"
        />
        <select
          value={props.status}
          onChange={(e) => props.onStatus(e.target.value as StatusFilter)}
          aria-label="Filtrar por status"
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={props.sort}
          onChange={(e) => props.onSort(e.target.value as SortMode)}
          aria-label="Ordenar"
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={props.size}
          onChange={(e) => props.onSize(e.target.value as SizeFilter)}
          aria-label="Filtrar por tamanho"
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {sizeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={props.attempts}
          onChange={(e) => props.onAttempts(e.target.value as AttemptsFilter)}
          aria-label="Filtrar por tentativas"
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          {attemptsOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => props.onTopic("")}
          className={cn(
            "rounded-full px-3 py-1 text-xs transition-colors",
            props.topic === "" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          Todos os tópicos
        </button>
        {topics.map((t) => (
          <button
            key={t.topic}
            type="button"
            onClick={() => props.onTopic(props.topic === t.topic ? "" : t.topic)}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              props.topic === t.topic
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {t.topic} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando {Math.min(props.visibleCount, props.resultCount)} de {props.resultCount}{" "}
        questão(ões)
      </p>
    </div>
  );
}
