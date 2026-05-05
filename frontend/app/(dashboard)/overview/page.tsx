"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Calendar,
  Users,
  Zap,
  Award,
  Globe2,
  TrendingUp,
  DollarSign,
  Target,
  Eye,
  MousePointerClick,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReceitaCard } from "@/components/overview/receita-card";
import { FunilCone3D } from "@/components/overview/funil-cone-3d";
import { api } from "@/lib/api";

const FRENTES_VISUAL: Record<
  string,
  { icon: typeof GraduationCap; gradient: string }
> = {
  "Pós-Graduação": {
    icon: GraduationCap,
    gradient: "bg-gradient-to-br from-blue-600 to-blue-800",
  },
  Congressos: {
    icon: Calendar,
    gradient: "bg-gradient-to-br from-violet-600 to-purple-800",
  },
  Comunidade: {
    icon: Users,
    gradient: "bg-gradient-to-br from-fuchsia-600 to-pink-700",
  },
  Imersão: {
    icon: Zap,
    gradient: "bg-gradient-to-br from-amber-500 to-orange-700",
  },
  "Cursos Livres": {
    icon: Award,
    gradient: "bg-gradient-to-br from-rose-500 to-red-700",
  },
  Intercâmbio: {
    icon: Globe2,
    gradient: "bg-gradient-to-br from-teal-500 to-emerald-700",
  },
};

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const ANO_ATUAL = new Date().getFullYear();

interface Overview {
  ano: number;
  mes: number;
  has_data: boolean;
  receita_total: number;
  roas_bruto: number | null;
  frentes: {
    label: string;
    valor: number;
    quantidade: number;
    detalhe: string | null;
  }[];
  funil_comercial: {
    nome: string;
    resultado: number;
    meta: number | null;
    taxa_anterior: number | null;
  }[];
  funil_taxas: Record<string, number>;
  meta_ads: {
    investimento: number;
    impressoes: number;
    alcance: number;
    cliques: number;
    ctr: number | null;
    cpm: number | null;
    cpc: number | null;
    leads: number;
    leads_imersao: number;
    compras_pixel: number;
    receita_pixel: number;
    roas_pixel: number | null;
    n_campanhas: number;
  } | null;
  top_campanhas: {
    nome: string;
    investimento: number;
    receita: number;
    roas: number;
  }[];
  top_eventos: { nome: string; inscritos: number; receita: number }[];
  imersao: {
    nome: string;
    investimento_resultado: number | null;
    receita_resultado: number | null;
    leads_total: number;
    leads_organico: number;
    leads_pago: number;
    cpl_resultado: number | null;
    mqls_resultado: number | null;
    engajamento: Record<string, unknown>;
  } | null;
}

const fmtBRL = (v: number) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

interface PeriodoSelectorProps {
  ano: number;
  mes: number;
  setAno: (n: number) => void;
  setMes: (n: number) => void;
}

function PeriodoSelector({ ano, mes, setAno, setMes }: PeriodoSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function OverviewPage() {
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(4);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Overview>(`/overview?ano=${ano}&mes=${mes}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ano, mes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.has_data) {
    return (
      <div className="space-y-6">
        <PeriodoSelector ano={ano} mes={mes} setAno={setAno} setMes={setMes} />
        <Card className="p-12 text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-1">Sem dados pro período</h2>
          <p className="text-sm text-muted-foreground">
            Importe os XLSX em <strong>/configuracoes/import</strong> ou cadastre os
            lançamentos em <strong>/marketing/lancamentos</strong>.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-12 -mt-2 pb-8" data-density="medium">
      <PeriodoSelector ano={ano} mes={mes} setAno={setAno} setMes={setMes} />

      {/* HERO */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 p-8 lg:p-12 text-white"
      >
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-1/3 -left-1/4 w-[500px] h-[500px] bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-blue-200 font-semibold">
                Resultados · {MESES[mes - 1]} {ano}
              </span>
            </div>
            <h1 className="text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-none mb-3">
              R${" "}
              <AnimatedNumber value={Math.round(data.receita_total)} duration={1500} />
            </h1>
            <p className="text-blue-200/80 text-base lg:text-lg max-w-xl leading-relaxed">
              Receita total bruta do mês entre{" "}
              <strong className="text-white">{data.frentes.length} frentes ativas</strong>.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {data.roas_bruto && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
                  <TrendingUp className="w-3 h-3" /> ROAS bruto{" "}
                  {Number(data.roas_bruto).toFixed(2)}×
                </span>
              )}
              {data.funil_taxas.lead_venda !== undefined && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold">
                  <Target className="w-3 h-3" /> Lead → Venda{" "}
                  {(Number(data.funil_taxas.lead_venda) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {data.meta_ads && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5 space-y-4">
              <p className="text-[11px] uppercase tracking-[0.15em] text-blue-200 font-semibold">
                Meta Ads · Performance
              </p>
              <div>
                <p className="text-5xl font-extrabold tabular-nums leading-none">
                  {data.meta_ads.roas_pixel
                    ? Number(data.meta_ads.roas_pixel).toFixed(2)
                    : "—"}
                  <span className="text-2xl text-blue-200">×</span>
                </p>
                <p className="text-xs text-blue-200/80 mt-1">ROAS rastreado pixel</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
                <div>
                  <p className="text-[10px] text-blue-300/80 uppercase tracking-wider">
                    Investido
                  </p>
                  <p className="text-base font-bold tabular-nums">
                    {fmtBRL(data.meta_ads.investimento)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-blue-300/80 uppercase tracking-wider">
                    Receita Meta
                  </p>
                  <p className="text-base font-bold tabular-nums">
                    {fmtBRL(data.meta_ads.receita_pixel)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* FRENTES */}
      {data.frentes.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Receita por frente</h2>
            <span className="text-xs text-muted-foreground">
              {data.frentes.length} frentes · {fmtBRL(data.receita_total)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.frentes.map((f, i) => {
              const visual =
                FRENTES_VISUAL[f.label] || FRENTES_VISUAL["Cursos Livres"];
              return (
                <ReceitaCard
                  key={f.label}
                  label={f.label}
                  valor={
                    f.label === "Imersão"
                      ? `${f.quantidade} MQLs`
                      : fmtBRL(f.valor)
                  }
                  meta={f.detalhe || ""}
                  descricao={f.detalhe || ""}
                  icon={visual.icon}
                  gradient={visual.gradient}
                  index={i}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* FUNIL */}
      {data.funil_comercial.some((f) => f.resultado > 0) && (
        <section>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Funil de Vendas</h2>
            {data.funil_taxas.lead_venda !== undefined && (
              <Badge variant="outline" className="text-xs">
                Lead → Venda{" "}
                {(Number(data.funil_taxas.lead_venda) * 100).toFixed(1)}%
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-2">Conversão por etapa</h3>
              <FunilCone3D
                etapas={data.funil_comercial.map((e) => ({
                  nome: e.nome,
                  valor: e.resultado,
                  meta: e.meta,
                }))}
              />
            </Card>

            <div className="space-y-4">
              {data.funil_comercial.map((f, i) => {
                const pct = f.meta ? (f.resultado / f.meta) * 100 : 100;
                const cores = [
                  "bg-rose-500",
                  "bg-orange-500",
                  "bg-amber-500",
                  "bg-yellow-500",
                  "bg-emerald-500",
                ];
                return (
                  <Card key={f.nome} className="p-4">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm font-semibold">{f.nome}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold tabular-nums">
                          {f.resultado}
                        </span>
                        {f.meta && (
                          <span className="text-xs text-muted-foreground">
                            / {f.meta}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }}
                        className={`h-full ${cores[i % 5]}`}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {pct >= 100
                        ? "✓ acima da meta"
                        : `${pct.toFixed(1)}% da meta`}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* META ADS */}
      {data.meta_ads && (
        <section>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Meta Ads</h2>
            <Badge>{data.meta_ads.n_campanhas} campanhas</Badge>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
            <KPICard
              label="Investimento"
              value={fmtBRL(data.meta_ads.investimento)}
              icon={DollarSign}
              index={0}
            />
            <KPICard
              label="Impressões"
              value={`${(data.meta_ads.impressoes / 1e6).toFixed(2)}M`}
              icon={Eye}
              index={1}
            />
            <KPICard
              label="Cliques"
              value={data.meta_ads.cliques.toLocaleString("pt-BR")}
              icon={MousePointerClick}
              index={2}
            />
            <KPICard
              label="CTR"
              value={
                data.meta_ads.ctr
                  ? `${Number(data.meta_ads.ctr).toFixed(2)}%`
                  : "—"
              }
              icon={TrendingUp}
              index={3}
            />
            <KPICard
              label="CPC"
              value={data.meta_ads.cpc ? fmtBRL(data.meta_ads.cpc) : "—"}
              icon={Target}
              index={4}
            />
            <KPICard
              label="Compras Pixel"
              value={data.meta_ads.compras_pixel}
              icon={Award}
              index={5}
            />
          </div>

          {data.top_campanhas.length > 0 && (
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4">
                Top {data.top_campanhas.length} Campanhas — Receita Rastreada
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.top_campanhas}
                  layout="vertical"
                  margin={{ left: 0, right: 60, top: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.4}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    tick={{ fontSize: 12 }}
                    width={170}
                  />
                  <Tooltip formatter={(v: number) => [fmtBRL(v), "Receita"]} />
                  <Bar dataKey="receita" radius={[0, 6, 6, 0]}>
                    {data.top_campanhas.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          ["#3b82f6", "#0d9488", "#7c3aed", "#d97706", "#10b981"][
                            i % 5
                          ]
                        }
                      />
                    ))}
                    <LabelList
                      dataKey="roas"
                      position="right"
                      formatter={(v: number) => `${Number(v).toFixed(2)}×`}
                      style={{ fontSize: 11, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </section>
      )}

      {/* TOP EVENTOS */}
      {data.top_eventos.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Top Congressos · Receita
          </h2>
          <Card className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.top_eventos}
                layout="vertical"
                margin={{ left: 0, right: 60, top: 10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.4}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 12 }}
                  width={250}
                />
                <Tooltip formatter={(v: number) => [fmtBRL(v), "Receita"]} />
                <Bar dataKey="receita" fill="#7c3aed" radius={[0, 6, 6, 0]}>
                  <LabelList
                    dataKey="inscritos"
                    position="right"
                    formatter={(v: number) => `${v} inscritos`}
                    style={{ fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </section>
      )}

      {/* IMERSÃO */}
      {data.imersao && (
        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Lançamento · {data.imersao.nome}
          </h2>
          <Card className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Investimento
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {data.imersao.investimento_resultado
                    ? fmtBRL(data.imersao.investimento_resultado)
                    : "—"}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Leads Total
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {data.imersao.leads_total.toLocaleString("pt-BR")}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Org {data.imersao.leads_organico} · Pago {data.imersao.leads_pago}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  CPL
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {data.imersao.cpl_resultado
                    ? fmtBRL(data.imersao.cpl_resultado)
                    : "—"}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  MQLs
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {data.imersao.mqls_resultado || "—"}
                </p>
              </div>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
