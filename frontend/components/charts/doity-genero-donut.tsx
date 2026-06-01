"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CHART_PALETTE, chartTooltipStyle } from "@/lib/chart-palette";
import type { DoityAnaliseFacet } from "@/lib/types/doity";

interface Props {
  itens: DoityAnaliseFacet[];
}

export function DoityGeneroDonut({ itens }: Props) {
  if (!itens.length) {
    return (
      <div className="h-[260px] flex items-center justify-center text-muted-foreground">
        Sem dados
      </div>
    );
  }

  const data = itens.map((it) => ({ name: it.chave, value: it.inscricoes }));
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            {...chartTooltipStyle}
            formatter={(value: number, name: string) => {
              const pct = total ? ((value / total) * 100).toFixed(1) : "0";
              return [`${value.toLocaleString("pt-BR")} (${pct}%)`, name];
            }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            stroke="var(--background)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
