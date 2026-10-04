import { Link } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Início" },
  { to: "/practice", label: "Praticar" },
  { to: "/session", label: "Sessão" },
  { to: "/progress", label: "Progresso" },
  { to: "/settings", label: "Ajustes" },
] as const;

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-baseline gap-2">
          <span className="font-serif text-lg font-semibold tracking-tight">ReadAloud</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">PTE Trainer</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              {...(link.to === "/" ? { activeOptions: { exact: true } } : {})}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-primary font-medium" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
