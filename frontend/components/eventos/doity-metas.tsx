"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/chart-palette";
import type { DoityAnaliseMeta, DoityAnaliseTotais } from "@/lib/types/doity";

interface Props {
  totais: DoityAnaliseTotais;
  meta: DoityAnaliseMeta;
}

const fmtNum = new Intl.NumberFormat("pt-BR");
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function cor(pct: number | null | undefined): string {
  if (pct == null) return STATUS_COLORS.neutral;
  if (pct >= 100) return STATUS_COLORS.success;
  if (pct >= 70) return STATUS_COLORS.processing;
  if (pct >= 40) return STATUS_COLORS.pending;
  return STATUS_COLORS.error;
}

function MedidorMeta({
  label,
  realizado,
  meta,
  pct,
  formatador,
}: {
  label: string;
  realizado: string;
  meta: string | null;
  pct: number | null;
  formatador?: (s: string) => string;
}) {
  const corBarra = cor(pct);
  const larguraBarra = pct == null ? 0 : Math.min(100, Math.max(0, pct));

  return (
    <Card className="p-5 border border-border">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[var(--font-size-caption)] text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
        {pct != null && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums"
            style={{ backgroundColor: `${corBarra}1A`, color: corBarra }}
          >
            {pct >= 100 ? "✓ " : ""}
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">
        {formatador ? formatador(realizado) : realizado}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {meta ? <>de {formatador ? formatador(meta) : meta} (meta)</> : <>meta não definida</>}
      </p>
      {meta != null && (
        <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${larguraBarra}%`, backgroundColor: corBarra }}
          />
        </div>
      )}
    </Card>
  );
}

function KpiAux({
  label,
  value,
  alerta = false,
}: {
  label: string;
  value: string;
  alerta?: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-4 border",
        alerta ? "border-destructive/40 bg-destructive/5" : "border-border",
      )}
    >
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums mt-1",
          alerta ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

export function DoityMetas({ totais, meta }: Props) {
  const ticket = totais.ticket_medio ? Number(totais.ticket_medio) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2 grid gap-4">
        <MedidorMeta
          label="Inscritos"
          realizado={fmtNum.format(totais.inscricoes)}
          meta={meta.meta_inscritos != null ? fmtNum.format(meta.meta_inscritos) : null}
          pct={meta.pct_inscritos}
        />
        <MedidorMeta
          label="Receita"
          realizado={fmtMoeda.format(Number(totais.receita || 0))}
          meta={meta.meta_receita != null ? fmtMoeda.format(Number(meta.meta_receita)) : null}
          pct={meta.pct_receita}
        />
      </div>
      <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
        <KpiAux label="Pagas" value={fmtNum.format(totais.pagas)} />
        <KpiAux
          label="Ticket médio"
          value={ticket != null ? fmtMoeda.format(ticket) : "—"}
        />
        <KpiAux label="Gratuitas" value={fmtNum.format(totais.gratuitas)} />
        <KpiAux
          label="Em contestação"
          value={fmtNum.format(totais.em_contestacao)}
          alerta={totais.em_contestacao > 0}
        />
      </div>
    </div>
  );
}
