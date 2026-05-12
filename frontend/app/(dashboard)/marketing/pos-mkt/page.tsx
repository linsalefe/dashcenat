"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  RefreshCw,
  Eye,
  MousePointerClick,
  Target,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  PercentSquare,
  Calendar,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KPICard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { FunilCone3D } from "@/components/overview/funil-cone-3d";
import { ReceitaCard } from "@/components/overview/receita-card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { FrenteDashboardOut } from "@/lib/types/marketing-frentes";
import {
  parseDecimal,
  formatarMoeda,
  formatarNumero,
} from "@/lib/types/marketing-frentes";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;
const ANOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

type CampoMidiaNumerico =
  | "alcance"
  | "cliques"
  | "visitantes_lp"
  | "checkout"
  | "compras";

export default function PosMktPage() {
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);
  const [data, setData] = useState<FrenteDashboardOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    api
      .get<FrenteDashboardOut>(
        `/frente-periodo/dashboard/pos?ano=${ano}&mes=${mes}`,
      )
      .then((res) => {
        if (!canceled) setData(res);
      })
      .catch((err: Error) => {
        if (!canceled) {
          toast.error(`Erro ao carregar dashboard: ${err.message}`);
          setData(null);
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [ano, mes, refreshKey]);

  const m = useMemo(() => {
    if (!data) return null;
    const ev = data.eventos;
    const somaInt = (k: CampoMidiaNumerico) =>
      ev.reduce((acc, e) => acc + (e[k] ?? 0), 0);
    const investimento = ev.reduce(
      (acc, e) => acc + parseDecimal(e.investimento_ads),
      0,
    );
    const alcance = somaInt("alcance");
    const cliques = somaInt("cliques");
    const visitantes_lp = somaInt("visitantes_lp");
    const checkout = somaInt("checkout");
    const compras = somaInt("compras");

    const ctr = alcance > 0 ? cliques / alcance : null;
    const cpc = cliques > 0 ? investimento / cliques : null;
    const cpa = compras > 0 ? investimento / compras : null;

    return {
      investimento, alcance, cliques, visitantes_lp, checkout, compras,
      ctr, cpc, cpa,
      turmas: ev.length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-700 flex items-center justify-center shadow-md">
            <Megaphone className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pós - Mkt</h1>
            <p className="text-sm text-muted-foreground">
              Funil de mídia paga por turma da Pós-Graduação
            </p>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Mês</label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((nome, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Ano</label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading || !m
          ? Array.from({ length: 8 }).map((_, i) => (
              <KPICard key={i} label="" value="" loading index={i} />
            ))
          : [
              { label: "Investimento Total", value: formatarMoeda(m.investimento), icon: DollarSign },
              { label: "Alcance Total",       value: formatarNumero(m.alcance),     icon: Eye },
              { label: "Cliques Total",       value: formatarNumero(m.cliques),     icon: MousePointerClick },
              { label: "Compras Total",       value: formatarNumero(m.compras),     icon: ShoppingCart },
              {
                label: "CTR",
                value: m.ctr != null ? `${(m.ctr * 100).toFixed(2)}%` : "—",
                icon: PercentSquare,
              },
              {
                label: "CPC",
                value: m.cpc != null ? formatarMoeda(m.cpc) : "—",
                icon: TrendingUp,
              },
              {
                label: "CPA",
                value: m.cpa != null ? formatarMoeda(m.cpa) : "—",
                icon: Target,
              },
              { label: "Turmas Ativas", value: formatarNumero(m.turmas), icon: Calendar },
            ].map((kpi, i) => (
              <KPICard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                index={i}
              />
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Funil de Mídia Paga — Pós"
          description="Alcance → Cliques → Visitantes LP → Checkout → Compras (todas as 16 turmas somadas)"
          loading={loading}
          className="lg:col-span-2"
        >
          <FunilCone3D
            etapas={
              m
                ? [
                    { nome: "Alcance",       valor: m.alcance,       meta: null },
                    { nome: "Cliques",       valor: m.cliques,       meta: null },
                    { nome: "Visitantes LP", valor: m.visitantes_lp, meta: null },
                    { nome: "Checkout",      valor: m.checkout,      meta: null },
                    { nome: "Compras",       valor: m.compras,       meta: null },
                  ]
                : []
            }
          />
        </ChartCard>

        <ReceitaCard
          label="INVESTIMENTO EM ADS"
          valor={formatarMoeda(m?.investimento ?? 0)}
          descricao={`Total investido em ${MESES[mes - 1]}/${ano}`}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-cyan-500 to-teal-700"
          index={0}
        />
      </div>
    </div>
  );
}
