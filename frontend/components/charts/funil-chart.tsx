"use client";

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";

export interface FunilEtapa {
  etapa_id: number;
  codigo: string;
  nome: string;
  ordem: number;
  meta: number | null;
  resultado: number | null;
}

interface Props {
  etapas: FunilEtapa[];
}

import { CHART_PALETTE } from "@/lib/chart-palette";

const COLORS = CHART_PALETTE;

export function FunilChart({ etapas }: Props) {
  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const data = sorted.map((e, i) => ({
    name: e.nome,
    value: Number(e.resultado ?? 0),
    fill: COLORS[i % COLORS.length],
  }));

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        Sem dados pro período selecionado
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "Resultado"]} />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList position="right" fill="var(--foreground)" stroke="none" dataKey="name" className="text-sm font-medium" />
            <LabelList
              position="center"
              fill="#fff"
              stroke="none"
              dataKey="value"
              formatter={(v: number) => v.toLocaleString("pt-BR")}
              className="text-base font-bold"
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
