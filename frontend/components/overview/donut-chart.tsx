"use client";

import { motion } from "framer-motion";

interface DonutData {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  title,
  data,
  centerLabel,
  centerValue,
}: {
  title: string;
  data: DonutData[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="card p-5 bg-card border border-border rounded-xl shadow-[var(--shadow-xs)]">
      <h4 className="text-[var(--font-size-body)] font-semibold mb-4 text-foreground">{title}</h4>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 200 200" className="w-44 h-44 -rotate-90">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="22" opacity="0.3"/>
          {data.map((d, i) => {
            const dash = (d.value / total) * circumference;
            const offset = -cumulativeOffset;
            cumulativeOffset += dash;
            return (
              <motion.circle
                key={i}
                cx="100" cy="100" r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="22"
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${dash} ${circumference}` }}
                transition={{ duration: 1, delay: i * 0.15 }}
              />
            );
          })}
          <g transform="rotate(90 100 100)">
            <text x="100" y="95" textAnchor="middle"
              className="fill-foreground" fontSize="22" fontWeight="700"
              style={{ fontFamily: "Inter, sans-serif" }}>
              {centerValue}
            </text>
            <text x="100" y="115" textAnchor="middle"
              className="fill-muted-foreground" fontSize="10" fontWeight="500"
              style={{ fontFamily: "Inter, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {centerLabel}
            </text>
          </g>
        </svg>

        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }}/>
                <span className="text-foreground truncate">{d.label}</span>
              </div>
              <span className="tabular-nums font-semibold text-foreground ml-2">
                {((d.value/total)*100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
