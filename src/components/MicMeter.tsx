import { cn } from "@/lib/utils";

interface MicMeterProps {
  /** Nível do sinal de 0 (silêncio) a 1 (pico). */
  level: number;
  bars?: number;
}

/** Medidor de nível do microfone em barras verticais. */
export function MicMeter({ level, bars = 16 }: MicMeterProps) {
  const lit = Math.round(Math.max(0, Math.min(1, level)) * bars);
  return (
    <div role="img" aria-label="Nível do microfone" className="flex items-end gap-1" aria-hidden={false}>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-4 w-1 rounded-full transition-colors duration-75",
            i < lit ? "bg-primary" : "bg-secondary",
          )}
        />
      ))}
    </div>
  );
}
