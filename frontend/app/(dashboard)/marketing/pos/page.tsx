"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  RefreshCw,
  Users,
  Phone,
  Target,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Calendar,
  PercentSquare,
  Loader2,
  type LucideIcon,
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
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  FrenteDashboardOut,
  DashboardKPI,
} from "@/lib/types/marketing-frentes";
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

function kpiPorLabel(
  kpis: DashboardKPI[] | undefined,
  label: string,
): DashboardKPI | undefined {
  return kpis?.find((k) => k.label === label);
}

function metaCompar(kpi: DashboardKPI | undefined): string | undefined {
  if (!kpi?.meta) return undefined;
  if (kpi.formato === "moeda") return `Meta: ${formatarMoeda(kpi.meta)}`;
  return `Meta: ${parseDecimal(kpi.meta).toLocaleString("pt-BR")}`;
}

interface CardSpec {
  label: string;
  icon: LucideIcon;
  kpi?: DashboardKPI;
  forceValue?: string;
}

export default function PosPage() {
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

  const taxaConversao = useMemo(() => {
    if (!data) return null;
    const leads = parseDecimal(kpiPorLabel(data.kpis, "Leads Captados")?.valor);
    const vendas = parseDecimal(kpiPorLabel(data.kpis, "Vendas")?.valor);
    if (leads <= 0) return null;
    return vendas / leads;
  }, [data]);

  const noShowMedio = useMemo(() => {
    if (!data || data.eventos.length === 0) return null;
    const valores = data.eventos
      .map((e) => (e.no_show_pct != null ? parseDecimal(e.no_show_pct) : null))
      .filter((v): v is number => v != null);
    if (valores.length === 0) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  }, [data]);

  const cards: CardSpec[] = data
    ? [
        { label: "Vendas Realizadas",  icon: ShoppingBag,    kpi: kpiPorLabel(data.kpis, "Vendas") },
        { label: "Receita",            icon: DollarSign,     kpi: kpiPorLabel(data.kpis, "Receita") },
        { label: "Leads Captados",     icon: Users,          kpi: kpiPorLabel(data.kpis, "Leads Captados") },
        { label: "Ticket Médio",       icon: TrendingUp,     kpi: kpiPorLabel(data.kpis, "Ticket Médio") },
        { label: "Investido em Ads",   icon: Target,         kpi: kpiPorLabel(data.kpis, "Investimento em Ads") },
        { label: "Turmas Ativas",      icon: Calendar,       kpi: kpiPorLabel(data.kpis, "Turmas Ativas") },
        {
          label: "% No Show",
          icon: PercentSquare,
          forceValue: noShowMedio != null ? `${(noShowMedio * 100).toFixed(1)}%` : "—",
        },
        {
          label: "Conv. Lead → Venda",
          icon: Phone,
          forceValue: taxaConversao != null ? `${(taxaConversao * 100).toFixed(2)}%` : "—",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md">
            <GraduationCap className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pós-Graduação</h1>
            <p className="text-sm text-muted-foreground">
              Funil comercial agregado e desempenho por turma
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
            className="bg-blue-600 hover:bg-blue-700 text-white"
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
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <KPICard key={i} label="" value="" loading index={i} />
            ))
          : cards.map((c, i) => {
              if (c.forceValue !== undefined) {
                return (
                  <KPICard
                    key={c.label}
                    label={c.label}
                    value={c.forceValue}
                    icon={c.icon}
                    index={i}
                  />
                );
              }
              const kpi = c.kpi;
              if (!kpi) return null;
              const valor =
                kpi.formato === "moeda"
                  ? formatarMoeda(kpi.valor)
                  : formatarNumero(kpi.valor);
              return (
                <KPICard
                  key={c.label}
                  label={c.label}
                  value={valor}
                  icon={c.icon}
                  previousValue={metaCompar(kpi)}
                  index={i}
                />
              );
            })}
      </div>
    </div>
  );
}
