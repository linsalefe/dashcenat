import { Construction } from "lucide-react";

interface Props {
  titulo: string;
  sprint: number;
  descricao?: string;
}

export function EmConstrucao({ titulo, sprint, descricao }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-[var(--font-size-h1)] font-bold tracking-tight">{titulo}</h1>

      <div className="rounded-xl border bg-card p-12 shadow-[var(--shadow-xs)]">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Construction className="w-7 h-7 text-primary" strokeWidth={1.75} />
          </div>
          <h2 className="text-[var(--font-size-h2)] font-semibold text-foreground mb-2">
            Em construção
          </h2>
          <p className="text-[var(--font-size-body)] text-muted-foreground leading-relaxed">
            {descricao || `Esta página será implementada na Sprint ${sprint}.`}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Sprint {sprint}
          </div>
        </div>
      </div>
    </div>
  );
}
