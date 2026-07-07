"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartTooltipStyle } from "@/lib/chart-palette";
import { fmtData, type TendenciaPonto } from "@/lib/gerencia";

interface Props {
  pontos: TendenciaPonto[];
}

export function GerenciaTendencia({ pontos }: Props) {
  if (!pontos.length) {
    return (
      <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
        Sem histórico ainda — a tendência acumula a partir dos snapshots diários
      </div>
    );
  }

  const data = pontos.map((p) => ({ ...p, label: fmtData(p.data).slice(0, 5) }));
  const unico = data.length === 1;

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip {...chartTooltipStyle} formatter={(v: number, n: string) => [v.toLocaleString("pt-BR"), n]} />
          <Line type="monotone" dataKey="total" name="Total" stroke="#4F6D91" strokeWidth={2} dot={unico} />
          <Line type="monotone" dataKey="em_andamento" name="Em andamento" stroke="#3B82F6" strokeWidth={2} dot={unico} />
          <Line type="monotone" dataKey="atrasadas" name="Atrasadas" stroke="#E11D48" strokeWidth={2} dot={unico} />
          <Line type="monotone" dataKey="concluidas" name="Concluídas" stroke="#059669" strokeWidth={2} dot={unico} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
