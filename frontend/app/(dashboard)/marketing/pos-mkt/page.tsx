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
import { FunilMensalCard } from "@/components/marketing/funil-mensal-card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { FunilMensalOut } from "@/lib/types/marketing-frentes";
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

export default function PosMktPage() {
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);
  const [funil, setFunil] = useState<FunilMensalOut | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    api
      .get<FunilMensalOut>(`/funil-mensal/pos/${ano}/${mes}`)
      .then((r) => {
        if (!canceled) setFunil(r);
      })
      .catch((err: Error) => {
        if (!canceled) {
          toast.error(`Erro ao carregar funil: ${err.message}`);
          setFunil(null);
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [ano, mes, refreshKey]);

  const kpis = useMemo(() => {
    if (!funil) return null;
    const inv = parseDecimal(funil.investimento_ads);
    const ctr = funil.alcance > 0 ? funil.cliques / funil.alcance : null;
    const cpc = funil.cliques > 0 ? inv / funil.cliques : null;
    const cpa = funil.compras > 0 ? inv / funil.compras : null;
    return {
      investimento: inv,
      alcance: funil.alcance,
      cliques: funil.cliques,
      compras: funil.compras,
      ctr,
      cpc,
      cpa,
    };
  }, [funil]);

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
              Funil de mídia paga mensal da Pós-Graduação
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
        {loading || !kpis
          ? Array.from({ length: 8 }).map((_, i) => (
              <KPICard key={i} label="" value="" loading index={i} />
            ))
          : [
              { label: "Investimento Total", value: formatarMoeda(kpis.investimento), icon: DollarSign },
              { label: "Alcance Total",      value: formatarNumero(kpis.alcance),     icon: Eye },
              { label: "Cliques Total",      value: formatarNumero(kpis.cliques),     icon: MousePointerClick },
              { label: "Compras Total",      value: formatarNumero(kpis.compras),     icon: ShoppingCart },
              {
                label: "CTR",
                value: kpis.ctr != null ? `${(kpis.ctr * 100).toFixed(2)}%` : "—",
                icon: PercentSquare,
              },
              {
                label: "CPC",
                value: kpis.cpc != null ? formatarMoeda(kpis.cpc) : "—",
                icon: TrendingUp,
              },
              {
                label: "CPA",
                value: kpis.cpa != null ? formatarMoeda(kpis.cpa) : "—",
                icon: Target,
              },
              {
                label: "Mês de Referência",
                value: `${MESES[mes - 1]}/${ano}`,
                icon: Megaphone,
              },
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

      <FunilMensalCard
        frente="pos"
        ano={ano}
        mes={mes}
        corBotao="cyan"
        refreshKey={refreshKey}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
