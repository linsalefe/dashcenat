"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_PALETTE, chartGridStyle, chartTooltipStyle } from "@/lib/chart-palette";
import type { DoityAnaliseSerie } from "@/lib/types/doity";

interface Props {
  serie: DoityAnaliseSerie[];
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fmtDataLong = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function rotuloDia(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return fmtData.format(dt).replace(".", "");
}

function rotuloDiaCompleto(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return fmtDataLong.format(dt);
}

export function DoityVendasDiarias({ serie }: Props) {
  if (!serie.length) {
    return (
      <div className="h-[320px] flex items-center justify-center text-muted-foreground">
        Sem inscrições registradas pro período
      </div>
    );
  }

  const data = serie.map((p) => ({
    data: p.data,
    rotulo: rotuloDia(p.data),
    inscricoes: p.inscricoes,
    pagas: p.pagas,
    receita: Number(p.receita || 0),
  }));

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="doityIns" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_PALETTE[0]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_PALETTE[0]} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="doityPag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_PALETTE[1]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_PALETTE[1]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...chartGridStyle} />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            {...chartTooltipStyle}
            labelFormatter={(_, payload) => {
              const iso = (payload?.[0]?.payload as { data?: string } | undefined)?.data;
              return iso ? rotuloDiaCompleto(iso) : "";
            }}
            formatter={(value, name, item) => {
              const n = typeof value === "number" ? value : Number(value);
              const label = String(name);
              if (label === "Receita") return [fmtMoeda.format(n), label];
              const payload = item?.payload as { receita?: number } | undefined;
              if (label === "Inscrições" && payload?.receita != null) {
                return [
                  `${n.toLocaleString("pt-BR")} (${fmtMoeda.format(payload.receita)})`,
                  label,
                ];
              }
              return [n.toLocaleString("pt-BR"), label];
            }}
          />
          <Area
            type="monotone"
            dataKey="inscricoes"
            name="Inscrições"
            stroke={CHART_PALETTE[0]}
            strokeWidth={2}
            fill="url(#doityIns)"
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="pagas"
            name="Pagas"
            stroke={CHART_PALETTE[1]}
            strokeWidth={2}
            fill="url(#doityPag)"
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
