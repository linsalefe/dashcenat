"use client";

import { motion } from "framer-motion";
import {
  GraduationCap, Calendar, Users, Zap, Award, Globe2,
  TrendingUp, DollarSign, Target, Eye, MousePointerClick,
  Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceitaCard } from "@/components/overview/receita-card";
import { FunilCone3D } from "@/components/overview/funil-cone-3d";
import { DonutChart } from "@/components/overview/donut-chart";

/* ════════════════════════════════════════════════
   DADOS · ABRIL 2026 — Hardcoded para apresentação
   ════════════════════════════════════════════════ */

const RECEITAS = [
  { label: "Pós-Graduação",   valor: "R$ 635.083", meta: "158 alunos · 79,1%", desc: "125 vendas · ticket R$ 5.080", icon: GraduationCap, gradient: "bg-gradient-to-br from-blue-600 to-blue-800" },
  { label: "Congressos",      valor: "R$ 104.833", meta: "R$ 206.664 · 50,7%", desc: "529 inscritos · 5 eventos",     icon: Calendar,       gradient: "bg-gradient-to-br from-violet-600 to-purple-800" },
  { label: "Comunidade",      valor: "R$ 28.220",  meta: "Sem meta",            desc: "93 vendas Hotmart",             icon: Users,          gradient: "bg-gradient-to-br from-fuchsia-600 to-pink-700" },
  { label: "Imersão Abril",   valor: "R$ 27.716",  meta: "R$ 43.695 · 63,4%",   desc: "5.950 leads · 125 MQLs",        icon: Zap,            gradient: "bg-gradient-to-br from-amber-500 to-orange-700" },
  { label: "Cursos Livres",   valor: "R$ 6.499",   meta: "R$ 58.200 · 11,2%",   desc: "67 alunos · CPA R$ 31",         icon: Award,          gradient: "bg-gradient-to-br from-rose-500 to-red-700" },
  { label: "Intercâmbio",     valor: "R$ 2.600",   meta: "Sem meta",            desc: "Receita complementar",          icon: Globe2,         gradient: "bg-gradient-to-br from-teal-500 to-emerald-700" },
];

const DIST_META = [
  { label: "Captação Pós",            value: 24500, color: "#3b82f6" },
  { label: "[VENDAS] Conversão",      value: 15252, color: "#10b981" },
  { label: "Imersão / Lançamento",    value: 7295,  color: "#f59e0b" },
  { label: "Outros (testes, alcance)", value: 8049, color: "#94a3b8" },
];

const ORIGEM_LEADS = [
  { label: "Tráfego Pago",    value: 5175, color: "#3b82f6" },
  { label: "Orgânico",        value: 1050, color: "#10b981" },
  { label: "Direto / Outros", value: 470,  color: "#f59e0b" },
];

const CAT_PRODUTO = [
  { label: "Pós-Graduação",   value: 635083, color: "#1d4ed8" },
  { label: "Congressos",      value: 104833, color: "#7c3aed" },
  { label: "Comunidade",      value: 28220,  color: "#db2777" },
  { label: "Imersão",         value: 27716,  color: "#d97706" },
  { label: "Cursos + Outros", value: 9099,   color: "#94a3b8" },
];

const TOP_CAMPANHAS = [
  { nome: "Comunidade Promo",          invest: 9021, receita: 29800, roas: 3.30 },
  { nome: "Congresso Online BP",       invest: 3207, receita: 12551, roas: 3.91 },
  { nome: "Cong. Infanto Fortaleza#3", invest: 1113, receita: 7268,  roas: 6.53 },
  { nome: "Cong. Infanto Fortaleza",   invest: 1181, receita: 6652,  roas: 5.63 },
  { nome: "Congresso Rio Mar",         invest: 391,  receita: 6565,  roas: 16.77 },
];

const TOP_EVENTOS = [
  { nome: "VIII Infantojuvenil — Fortaleza/CE",   inscritos: 117, receita: 34086 },
  { nome: "VI Boas Práticas — Belém/PA",          inscritos: 104, receita: 19463 },
  { nome: "VII Saúde Mental — Pop. Vulnerab.",    inscritos: 93,  receita: 17827 },
  { nome: "IX Internacional — IPUB/UFRJ",         inscritos: 62,  receita: 16730 },
  { nome: "VII Online Boas Práticas",             inscritos: 153, receita: 16727 },
];

const FUNIL = [
  { etapa: "Leads",    resultado: 745, meta: 670 },
  { etapa: "Ligações", resultado: 266, meta: 375 },
  { etapa: "SQL",      resultado: 168, meta: 275 },
  { etapa: "Reuniões", resultado: 143, meta: 228 },
  { etapa: "Vendas",   resultado: 125, meta: 158 },
];

const TAXAS = [
  { de: "Lead",    para: "Ligação", pct: 35.7 },
  { de: "Ligação", para: "SQL",     pct: 63.2 },
  { de: "SQL",     para: "Reunião", pct: 85.1 },
  { de: "Reunião", para: "Venda",   pct: 87.4 },
  { de: "Lead",    para: "Venda",   pct: 16.8 },
];

/* ════════════════════════════════════════════════
   PÁGINA
   ════════════════════════════════════════════════ */

export default function OverviewPage() {
  return (
    <div className="space-y-12 -mt-2 pb-8" data-density="medium">

      {/* ════════ HERO ════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 p-8 lg:p-12 text-white"
      >
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute -bottom-1/3 -left-1/4 w-[500px] h-[500px] bg-violet-500/15 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}/>

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-blue-200 font-semibold">
                Resultados · Abril 2026
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-none mb-3"
            >
              R$ <AnimatedNumber value={804951} duration={1500} />
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              className="text-blue-200/80 text-base lg:text-lg max-w-xl leading-relaxed">
              Receita total bruta do mês entre <strong className="text-white">6 frentes ativas</strong>:
              pós-graduação, congressos, comunidade, lançamento Imersão, cursos livres e intercâmbio.
            </motion.p>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
              className="flex flex-wrap gap-2 mt-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
                <TrendingUp className="w-3 h-3" /> ROAS bruto 14,61×
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold">
                <Target className="w-3 h-3" /> Lead → Venda 16,8%
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-200 text-xs font-semibold">
                <Sparkles className="w-3 h-3" /> 745 leads (+11% acima da meta)
              </span>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5 space-y-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-blue-200 font-semibold">Meta Ads · Performance</p>
            <div>
              <p className="text-5xl font-extrabold tabular-nums leading-none">3,96<span className="text-2xl text-blue-200">×</span></p>
              <p className="text-xs text-blue-200/80 mt-1">ROAS rastreado pixel</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
              <div>
                <p className="text-[10px] text-blue-300/80 uppercase tracking-wider">Investido</p>
                <p className="text-base font-bold tabular-nums">R$ 55.096</p>
              </div>
              <div>
                <p className="text-[10px] text-blue-300/80 uppercase tracking-wider">Receita Meta</p>
                <p className="text-base font-bold tabular-nums">R$ 87.596</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ════════ RECEITA POR FRENTE ════════ */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Frentes ativas</p>
            <h2 className="text-2xl font-bold tracking-tight">Receita por frente · Abril</h2>
          </div>
          <span className="text-xs text-muted-foreground">6 frentes · R$ 804.951</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {RECEITAS.map((r, i) => (
            <ReceitaCard
              key={r.label}
              label={r.label}
              valor={r.valor}
              meta={r.meta}
              descricao={r.desc}
              icon={r.icon}
              gradient={r.gradient}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* ════════ FUNIL COMERCIAL CONE 3D ════════ */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Comercial · Pós-Graduação</p>
            <h2 className="text-2xl font-bold tracking-tight">Funil de Vendas</h2>
          </div>
          <Badge variant="outline" className="text-xs">Lead → Venda 16,8%</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 shadow-[var(--shadow-xs)]">
            <h3 className="text-sm font-semibold mb-2 text-foreground">Conversão por etapa</h3>
            <p className="text-xs text-muted-foreground mb-4">5 etapas · 745 leads · 125 vendas</p>
            <FunilCone3D />
          </Card>

          <div className="space-y-4">
            {FUNIL.map((f, i) => {
              const pct = (f.resultado / f.meta) * 100;
              const cores = ["bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-emerald-500"];
              return (
                <motion.div
                  key={f.etapa}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="p-4 shadow-[var(--shadow-xs)]">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm font-semibold text-foreground">{f.etapa}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold tabular-nums">{f.resultado}</span>
                        <span className="text-xs text-muted-foreground">/ {f.meta}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }}
                        className={`h-full ${cores[i]} ${pct >= 100 ? '' : 'rounded-r-full'}`}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {pct >= 100 ? "✓ acima da meta" : `${pct.toFixed(1)}% da meta`}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Taxas */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          {TAXAS.map((t, i) => (
            <motion.div
              key={`${t.de}-${t.para}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.06 }}
            >
              <Card className={`p-3 shadow-[var(--shadow-xs)] ${i === 4 ? 'bg-blue-50 dark:bg-blue-950 border-blue-200' : ''}`}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t.de} → {t.para}</p>
                <p className={`text-xl font-bold tabular-nums mt-1 ${i === 4 ? 'text-blue-700' : ''}`}>{t.pct}%</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════ 3 DONUTS ════════ */}
      <section>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Distribuição</p>
          <h2 className="text-2xl font-bold tracking-tight">De onde vem · Onde vai</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DonutChart
            title="Investimento Meta · por categoria"
            data={DIST_META}
            centerLabel="Investido"
            centerValue="R$ 55k"
          />
          <DonutChart
            title="Origem dos Leads"
            data={ORIGEM_LEADS}
            centerLabel="Leads"
            centerValue="6.695"
          />
          <DonutChart
            title="Receita por categoria"
            data={CAT_PRODUTO}
            centerLabel="Receita"
            centerValue="R$ 805k"
          />
        </div>
      </section>

      {/* ════════ META ADS ════════ */}
      <section>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Marketing · Mídia Paga</p>
            <h2 className="text-2xl font-bold tracking-tight">Meta Ads — Abril</h2>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-emerald-500 hover:bg-emerald-600">ROAS pixel 3,96×</Badge>
            <Badge variant="outline">61 campanhas</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          <KPICard label="Investimento" value="R$ 55.096" icon={DollarSign} index={0} />
          <KPICard label="Impressões" value="4,23M" icon={Eye} index={1} />
          <KPICard label="Cliques" value="49.714" icon={MousePointerClick} index={2} />
          <KPICard label="CTR" value="1,18%" icon={TrendingUp} index={3} />
          <KPICard label="CPC" value="R$ 1,11" icon={Target} index={4} />
          <KPICard label="Compras Pixel" value={409} icon={Award} index={5} />
        </div>

        {/* Top campanhas — bar chart horizontal */}
        <Card className="p-6 shadow-[var(--shadow-xs)]">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Top 5 Campanhas — Receita Rastreada</h3>
            <span className="text-xs text-muted-foreground">17 com pixel ativo · ROAS médio 3,96×</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={TOP_CAMPANHAS} layout="vertical" margin={{ left: 0, right: 60, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} width={170} />
              <Tooltip
                contentStyle={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Receita"]}
              />
              <Bar dataKey="receita" radius={[0, 6, 6, 0]}>
                {TOP_CAMPANHAS.map((_, i) => (
                  <Cell key={i} fill={["#3b82f6","#0d9488","#7c3aed","#d97706","#10b981"][i]} />
                ))}
                <LabelList
                  dataKey="roas"
                  position="right"
                  formatter={(v: number) => `${v.toFixed(2)}×`}
                  style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ════════ TOP EVENTOS ════════ */}
      <section>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Eventos</p>
          <h2 className="text-2xl font-bold tracking-tight">Top 5 Congressos · Receita</h2>
        </div>

        <Card className="p-6 shadow-[var(--shadow-xs)]">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={TOP_EVENTOS} layout="vertical" margin={{ left: 0, right: 60, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} width={250} />
              <Tooltip
                contentStyle={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, n: string) => [n === "receita" ? `R$ ${v.toLocaleString("pt-BR")}` : v, n === "receita" ? "Receita" : "Inscritos"]}
              />
              <Bar dataKey="receita" fill="#7c3aed" radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey="inscritos"
                  position="right"
                  formatter={(v: number) => `${v} inscritos`}
                  style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ════════ DETALHE: Imersão + Cursos Livres ════════ */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Imersão */}
          <Card className="p-6 shadow-[var(--shadow-xs)]">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] text-amber-700 font-semibold">Lançamento</p>
                <h3 className="text-lg font-bold">Imersão Abril</h3>
              </div>
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white">63% da meta</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Investimento</p>
                <p className="text-xl font-bold tabular-nums">R$ 15.000</p>
                <p className="text-[10px] text-emerald-700">100% meta ✓</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Receita</p>
                <p className="text-xl font-bold tabular-nums">R$ 27.716</p>
                <p className="text-[10px] text-amber-700">63% meta R$ 43.695</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Leads</p>
                <p className="text-xl font-bold tabular-nums">5.950</p>
                <p className="text-[10px] text-amber-700">39,7% meta 15k</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CPL</p>
                <p className="text-xl font-bold tabular-nums">R$ 3,06</p>
                <p className="text-[10px] text-rose-700">2,55× meta R$ 1,20</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Engajamento das Aulas</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span>Aula 1</span><span className="font-mono text-muted-foreground">730 simul · 1.800 ao vivo</span></div>
                <div className="flex justify-between"><span>Aula 2</span><span className="font-mono text-muted-foreground">430 simul · 1.100 ao vivo</span></div>
                <div className="flex justify-between"><span>Aula 3</span><span className="font-mono text-muted-foreground">407 simul</span></div>
                <div className="flex justify-between font-semibold pt-2 border-t border-border"><span>Grupo WhatsApp</span><span className="font-mono">4.000 (67,2%)</span></div>
                <div className="flex justify-between font-semibold"><span>Pesquisa respondida</span><span className="font-mono">1.032 (17,3%)</span></div>
              </div>
            </div>
          </Card>

          {/* Cursos Livres */}
          <Card className="p-6 shadow-[var(--shadow-xs)]">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] text-rose-700 font-semibold">Educação Continuada</p>
                <h3 className="text-lg font-bold">Cursos Livres</h3>
              </div>
              <Badge className="bg-rose-500 hover:bg-rose-600 text-white">11% da meta</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Alunos</p>
                <p className="text-xl font-bold tabular-nums">67 / 600</p>
                <p className="text-[10px] text-rose-700">11,2% meta</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Receita</p>
                <p className="text-xl font-bold tabular-nums">R$ 6.499</p>
                <p className="text-[10px] text-rose-700">11,2% meta</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CPA</p>
                <p className="text-xl font-bold tabular-nums">R$ 31,34</p>
                <p className="text-[10px] text-emerald-700">98% meta R$ 32 ✓</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Anúncio</p>
                <p className="text-xl font-bold tabular-nums">R$ 2.100</p>
                <p className="text-[10px] text-muted-foreground">17% meta R$ 12.480</p>
              </div>
            </div>

            <div className="border-t border-border pt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">LL</p>
                <p className="text-lg font-bold tabular-nums">R$ 2.579</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">% LL</p>
                <p className="text-lg font-bold tabular-nums">39,7%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Imp.+CF</p>
                <p className="text-lg font-bold tabular-nums">R$ 1.819</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">⚠️ Volume baixo:</strong> investimento de mídia rodou só 17% do planejado.
                CPA dentro da meta sugere que <em>escalar investimento</em> mantém custo saudável.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ════════ INSIGHTS FINAIS ════════ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 border-l-4 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-[var(--shadow-xs)]">
          <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">📈 Destaque positivo</p>
          <p className="text-sm leading-relaxed">
            <strong>Topo do funil bateu meta pela primeira vez:</strong> 745 leads (+11% acima de 670).
            ROAS de mídia paga em <strong>14,61× bruto</strong> — cada R$ 1 investido gerou R$ 14,61 em receita total.
            Top campanha (Comunidade Promo) trouxe <strong>R$ 29,8k</strong> com R$ 9k de investimento.
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-[var(--shadow-xs)]">
          <p className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold mb-1">🎯 Foco do mês seguinte</p>
          <p className="text-sm leading-relaxed">
            <strong>Gargalo na qualificação:</strong> Lead → Ligação só 35,7% (de 745 leads, só 266 receberam ligação).
            As etapas seguintes do funil (Liga→SQL→Reu→Venda) estão saudáveis acima de 85% cada — o problema é capacidade
            de cobertura de qualificação. <strong>Recomendação: ampliar SDRs e velocidade de primeira tentativa.</strong>
          </p>
        </Card>
      </section>

    </div>
  );
}
