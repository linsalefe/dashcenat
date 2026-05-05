"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

export function ReceitaCard({
  label, valor, meta, descricao, icon: Icon, gradient, index,
}: {
  label: string;
  valor: string;
  meta?: string;
  descricao: string;
  icon: LucideIcon;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="relative group"
    >
      <div className={`absolute inset-0 rounded-2xl opacity-90 ${gradient}`} />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent" />
      <div className="absolute inset-px rounded-2xl bg-gradient-to-br from-white/5 to-transparent" />
      <div className="relative p-5 text-white">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/70 font-semibold">{label}</span>
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
          </div>
        </div>
        <p className="text-3xl font-extrabold tabular-nums tracking-tight leading-none mb-1.5">
          {valor}
        </p>
        <p className="text-[11px] text-white/80 leading-snug">{descricao}</p>
        {meta && (
          <div className="mt-3 pt-3 border-t border-white/15 text-[10px] text-white/70">
            Meta: <span className="text-white/90 font-semibold">{meta}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
