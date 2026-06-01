"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_PALETTE, chartTooltipStyle } from "@/lib/chart-palette";
import type { DoityAnaliseFacet } from "@/lib/types/doity";

interface Props {
  itens: DoityAnaliseFacet[];
  /** altura mínima do gráfico (px) — se faltar dado, ajusta-se ao número de barras */
  alturaMin?: number;
}

export function DoityFacetBars({ itens, alturaMin = 220 }: Props) {
  if (!itens.length) {
    return (
      <div className="h-[180px] flex items-center justify-center text-muted-foreground">
        Sem dados
      </div>
    );
  }

  const data = itens.map((it) => ({
    chave: it.chave,
    inscricoes: it.inscricoes,
    pagas: it.pagas,
  }));
  const altura = Math.max(alturaMin, 36 + data.length * 28);
  const maior = Math.max(...data.map((d) => d.inscricoes));

  return (
    <div className="w-full" style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
        >
          <XAxis type="number" hide allowDecimals={false} domain={[0, Math.ceil(maior * 1.1)]} />
          <YAxis
            type="category"
            dataKey="chave"
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
            width={140}
          />
          <Tooltip
            {...chartTooltipStyle}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value: number, name: string) => [value.toLocaleString("pt-BR"), name]}
          />
          <Bar dataKey="inscricoes" name="Inscrições" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
            <LabelList
              dataKey="inscricoes"
              position="right"
              fill="var(--foreground)"
              fontSize={11}
              formatter={(v: number) => v.toLocaleString("pt-BR")}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
