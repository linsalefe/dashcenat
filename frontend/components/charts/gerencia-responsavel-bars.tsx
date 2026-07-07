"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { chartTooltipStyle } from "@/lib/chart-palette";
import type { PorResponsavel } from "@/lib/gerencia";

interface Props {
  itens: PorResponsavel[];
}

// Segmentos que particionam o total (sem double-count): concluídas + atrasadas + em dia.
const COR_CONCLUIDA = "#059669"; // success
const COR_EM_DIA = "#3B82F6"; // primary/processing
const COR_ATRASADA = "#E11D48"; // destructive

export function GerenciaResponsavelBars({ itens }: Props) {
  if (!itens.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
        Sem dados de carga por responsável
      </div>
    );
  }

  const data = [...itens]
    .sort((a, b) => b.total - a.total)
    .slice(0, 14)
    .map((r) => ({
      nome: r.nome.length > 22 ? r.nome.slice(0, 21) + "…" : r.nome,
      concluidas: r.concluidas,
      atrasadas: r.atrasadas,
      em_dia: Math.max(0, r.total - r.concluidas - r.atrasadas),
      total: r.total,
    }));

  const altura = Math.max(240, 40 + data.length * 30);
  const maior = Math.max(...data.map((d) => d.total));

  return (
    <div className="w-full" style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <XAxis type="number" hide allowDecimals={false} domain={[0, Math.ceil(maior * 1.1)]} />
          <YAxis
            type="category"
            dataKey="nome"
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
            width={150}
          />
          <Tooltip
            {...chartTooltipStyle}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value: number, name: string) => [value.toLocaleString("pt-BR"), name]}
          />
          <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={COR_CONCLUIDA} radius={[4, 0, 0, 4]} />
          <Bar dataKey="em_dia" name="Em dia" stackId="a" fill={COR_EM_DIA} />
          <Bar dataKey="atrasadas" name="Atrasadas" stackId="a" fill={COR_ATRASADA} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
