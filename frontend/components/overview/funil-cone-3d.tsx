"use client";

import { motion } from "framer-motion";

interface EtapaInput {
  nome: string;
  valor: number;
  meta?: number | null;
}

interface EtapaInternal {
  nome: string;
  valor: number;
  meta: number | null;
  cor: string;
  corDark: string;
}

const CORES_DEFAULT: { cor: string; corDark: string }[] = [
  { cor: "#dc2626", corDark: "#991b1b" },
  { cor: "#ea580c", corDark: "#9a3412" },
  { cor: "#f59e0b", corDark: "#b45309" },
  { cor: "#eab308", corDark: "#854d0e" },
  { cor: "#22c55e", corDark: "#15803d" },
];

const ETAPAS_DEFAULT: EtapaInput[] = [
  { nome: "Leads", valor: 745, meta: 670 },
  { nome: "Ligações", valor: 266, meta: 375 },
  { nome: "SQL", valor: 168, meta: 275 },
  { nome: "Reuniões", valor: 143, meta: 228 },
  { nome: "Vendas", valor: 125, meta: 158 },
];

interface Props {
  etapas?: EtapaInput[];
}

export function FunilCone3D({ etapas: propEtapas }: Props = {}) {
  const input = propEtapas && propEtapas.length > 0 ? propEtapas : ETAPAS_DEFAULT;
  const etapas: EtapaInternal[] = input.map((e, i) => ({
    nome: e.nome,
    valor: e.valor,
    meta: e.meta ?? null,
    cor: CORES_DEFAULT[i % CORES_DEFAULT.length].cor,
    corDark: CORES_DEFAULT[i % CORES_DEFAULT.length].corDark,
  }));

  const maxValor = Math.max(...etapas.map((e) => e.valor), 1);
  const minWidth = 80;
  const maxWidth = 380;
  const viewBoxHeight = etapas.length * 90 + 30;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 600 ${viewBoxHeight}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {etapas.map((e, i) => (
            <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={e.corDark} />
              <stop offset="40%" stopColor={e.cor} />
              <stop offset="100%" stopColor={e.corDark} />
            </linearGradient>
          ))}
          <filter id="shadow">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.2" />
          </filter>
        </defs>

        {etapas.map((e, i) => {
          const widthTop =
            minWidth +
            (maxWidth - minWidth) *
              (etapas[i === 0 ? 0 : i - 1].valor / maxValor);
          const widthBottom =
            minWidth + (maxWidth - minWidth) * (e.valor / maxValor);
          const widthTopReal = i === 0 ? maxWidth : widthTop;
          const yTop = i * 90 + 20;
          const yBottom = yTop + 75;
          const cx = 300;

          const points = `
            ${cx - widthTopReal / 2},${yTop}
            ${cx + widthTopReal / 2},${yTop}
            ${cx + widthBottom / 2},${yBottom}
            ${cx - widthBottom / 2},${yBottom}
          `;

          return (
            <motion.g
              key={`${e.nome}-${i}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              filter="url(#shadow)"
            >
              <polygon points={points} fill={`url(#grad-${i})`} />
              <ellipse
                cx={cx}
                cy={yBottom}
                rx={widthBottom / 2}
                ry="6"
                fill={e.corDark}
                opacity="0.35"
              />
              <text
                x={cx}
                y={yTop + 38}
                textAnchor="middle"
                fill="white"
                fontWeight="700"
                fontSize="22"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {e.valor.toLocaleString("pt-BR")}
              </text>
              <text
                x={cx}
                y={yTop + 58}
                textAnchor="middle"
                fill="white"
                fontWeight="500"
                fontSize="11"
                opacity="0.85"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "0.05em" }}
              >
                {e.nome.toUpperCase()}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
