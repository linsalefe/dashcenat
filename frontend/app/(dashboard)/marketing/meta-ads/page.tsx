"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Activity,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  DateRangePicker,
  type DateRange,
  dateRangeHelpers,
  presetRange,
} from "@/components/date-range-picker";

// ============================================================
// Tipos
// ============================================================

interface Config {
  configurado: boolean;
  ativo: boolean;
  ad_account_ids: string[];
  access_token_mask: string | null;
  token_expires_at: string | null;
  dias_para_expirar: number | null;
  ultimo_sync: string | null;
  ultimo_sync_status: string | null;
  ultimo_sync_erro: string | null;
  ultimo_sync_total: number;
}

interface CampanhaKPI {
  campaign_id: string;
  campaign_name: string;
  objetivo: string | null;
  status: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  landing_page_views: number;
  initiate_checkout: number;
  purchases: number;
  purchase_value: number;
  roas: number | null;
  taxa_pagina_para_checkout: number | null;
  taxa_conversao_checkout: number | null;
  cpa: number | null;
  resultados: number;
  custo_por_resultado: number | null;
  taxa_cadastro: number | null;
}

interface SerieDiaVendas {
  data: string;
  spend: number;
  purchases: number;
  purchase_value: number;
}

interface SerieDiaLeads {
  data: string;
  spend: number;
  resultados: number;
}

interface Stats {
  periodo_inicio: string;
  periodo_fim: string;
  spend_total: number;
  purchase_value_total: number;
  roas_geral: number | null;
  campanhas_vendas: CampanhaKPI[];
  campanhas_leads: CampanhaKPI[];
  serie_diaria_vendas: SerieDiaVendas[];
  serie_diaria_leads: SerieDiaLeads[];
}

interface AdAccountInfo {
  id: string;
  name: string | null;
  account_status: number | null;
  currency: string | null;
}

type Aba = "vendas" | "leads";

// ============================================================
// Helpers
// ============================================================

const brl = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brlShort = (v: number) => {
  const n = v ?? 0;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return brl(n);
};

const num = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR");

const pct = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : `${(v * 100).toFixed(casas)}%`;

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

const dtRelativo = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
};

const STATUS_CAMPANHA: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", label: "Ativa" },
  PAUSED: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", label: "Pausada" },
  DELETED: { bg: "bg-zinc-500/10", text: "text-zinc-600 dark:text-zinc-400", label: "Deletada" },
  ARCHIVED: { bg: "bg-zinc-500/10", text: "text-zinc-600 dark:text-zinc-400", label: "Arquivada" },
  CAMPAIGN_PAUSED: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", label: "Pausada" },
};

function statusInfo(s: string | null) {
  return (
    (s && STATUS_CAMPANHA[s.toUpperCase()]) || {
      bg: "bg-zinc-500/10",
      text: "text-zinc-600",
      label: s || "—",
    }
  );
}

function roasBadge(roas: number | null) {
  if (roas == null) return { class: "text-muted-foreground", icon: null };
  if (roas >= 2) return { class: "text-emerald-700 dark:text-emerald-400 font-medium", icon: TrendingUp };
  if (roas < 1) return { class: "text-red-700 dark:text-red-400 font-medium", icon: TrendingDown };
  return { class: "text-foreground", icon: null };
}

// ============================================================
// Página
// ============================================================

export default function MetaAdsPage() {
  // Default: "Este mês"
  const [range, setRange] = useState<DateRange>(() => presetRange("este_mes"));
  const [aba, setAba] = useState<Aba>("vendas");

  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const rangeIso = useMemo(
    () => ({
      since: dateRangeHelpers.isoDate(range.since),
      until: dateRangeHelpers.isoDate(range.until),
    }),
    [range],
  );

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api.get<Config>("/meta-ads/config"),
        api
          .get<Stats>(
            `/meta-ads/stats?since=${rangeIso.since}&until=${rangeIso.until}`,
          )
          .catch(() => null),
      ]);
      setConfig(c);
      setStats(s);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIso.since, rangeIso.until]);

  async function sincronizar() {
    if (!config?.configurado) {
      toast.error("Configure access_token + ad accounts primeiro");
      setConfigOpen(true);
      return;
    }
    setSyncing(true);
    try {
      const res = await api.post<{
        ok: boolean;
        total_linhas: number;
        contas_processadas: number;
        erro: string | null;
      }>("/meta-ads/sync", {
        since: rangeIso.since,
        until: rangeIso.until,
      });
      if (res.ok) {
        toast.success(
          `Sync ok: ${res.total_linhas} linhas em ${res.contas_processadas} contas`,
        );
      } else {
        toast.error(`Sync com erros: ${res.erro ?? "—"}`);
      }
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no sync");
    } finally {
      setSyncing(false);
    }
  }

  const isAdmin = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      return u?.papel === "admin";
    } catch {
      return false;
    }
  }, []);

  // Filtragem por busca
  const campanhasVendas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = stats?.campanhas_vendas ?? [];
    if (!q) return arr;
    return arr.filter((c) => c.campaign_name.toLowerCase().includes(q));
  }, [stats, busca]);

  const campanhasLeads = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = stats?.campanhas_leads ?? [];
    if (!q) return arr;
    return arr.filter((c) => c.campaign_name.toLowerCase().includes(q));
  }, [stats, busca]);

  // Totais consolidados pra hero
  const totaisVendas = useMemo(() => {
    const cs = stats?.campanhas_vendas ?? [];
    return cs.reduce(
      (acc, c) => ({
        spend: acc.spend + Number(c.spend),
        receita: acc.receita + Number(c.purchase_value),
        compras: acc.compras + Number(c.purchases),
        reach: acc.reach + Number(c.reach),
        impressions: acc.impressions + Number(c.impressions),
        clicks: acc.clicks + Number(c.clicks),
        page_views: acc.page_views + Number(c.landing_page_views),
        checkout: acc.checkout + Number(c.initiate_checkout),
      }),
      { spend: 0, receita: 0, compras: 0, reach: 0, impressions: 0, clicks: 0, page_views: 0, checkout: 0 },
    );
  }, [stats]);

  const totaisLeads = useMemo(() => {
    const cs = stats?.campanhas_leads ?? [];
    return cs.reduce(
      (acc, c) => ({
        spend: acc.spend + Number(c.spend),
        resultados: acc.resultados + Number(c.resultados),
        reach: acc.reach + Number(c.reach),
        impressions: acc.impressions + Number(c.impressions),
        clicks: acc.clicks + Number(c.clicks),
        page_views: acc.page_views + Number(c.landing_page_views),
      }),
      { spend: 0, resultados: 0, reach: 0, impressions: 0, clicks: 0, page_views: 0 },
    );
  }, [stats]);

  const roasVendas =
    totaisVendas.spend > 0 ? totaisVendas.receita / totaisVendas.spend : null;
  const ctrVendas =
    totaisVendas.impressions > 0
      ? (totaisVendas.clicks / totaisVendas.impressions) * 100
      : 0;
  const ctrLeads =
    totaisLeads.impressions > 0
      ? (totaisLeads.clicks / totaisLeads.impressions) * 100
      : 0;
  const custoMedioResultado =
    totaisLeads.resultados > 0 ? totaisLeads.spend / totaisLeads.resultados : null;
  const taxaCadastro =
    totaisLeads.page_views > 0
      ? totaisLeads.resultados / totaisLeads.page_views
      : null;
  const taxaPgCheckout =
    totaisVendas.page_views > 0
      ? totaisVendas.checkout / totaisVendas.page_views
      : null;
  const taxaCheckCompra =
    totaisVendas.checkout > 0
      ? totaisVendas.compras / totaisVendas.checkout
      : null;

  // Mediana de custo_por_resultado pra highlight de outliers
  const medianaCusto = useMemo(() => {
    const vals = (stats?.campanhas_leads ?? [])
      .map((c) => Number(c.custo_por_resultado ?? 0))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (vals.length === 0) return 0;
    return vals[Math.floor(vals.length / 2)];
  }, [stats]);

  // Aviso de token expirando
  const avisoToken =
    config?.dias_para_expirar != null && config.dias_para_expirar < 7
      ? config.dias_para_expirar < 0
        ? `Token expirou há ${Math.abs(config.dias_para_expirar)} dias`
        : `Token expira em ${config.dias_para_expirar} dias`
      : null;

  return (
    <div className="space-y-5">
      {/* ====== Header ====== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Meta Ads</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Campanhas de vendas e leads · Meta Marketing API v21
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={(r) => setRange(r)} />

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={sincronizar}
              disabled={syncing}
              className="h-9"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </Button>
          )}

          <Sheet open={configOpen} onOpenChange={setConfigOpen}>
            <SheetTrigger render={<Button size="sm" variant="outline" className="h-9" />}>
              <Settings className="mr-2 h-3.5 w-3.5" />
              Configurar
            </SheetTrigger>
            <ConfigSheet
              config={config}
              isAdmin={isAdmin}
              onSaved={() => {
                setConfigOpen(false);
                load();
              }}
            />
          </Sheet>
        </div>
      </div>

      {/* ====== Banners ====== */}
      {!config?.configurado && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong className="text-sm">Meta Ads não configurado</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cole o System User access token e as ad accounts pra começar a puxar insights.
              </p>
            </div>
            <Button size="sm" onClick={() => setConfigOpen(true)}>
              Configurar
            </Button>
          </div>
        </Card>
      )}

      {avisoToken && config?.configurado && (
        <Card className="p-4 border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong className="text-sm text-red-700 dark:text-red-400">
                {avisoToken}
              </strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gere um novo System User token no Business Manager e atualize aqui antes que o sync pare.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
              Atualizar
            </Button>
          </div>
        </Card>
      )}

      {config?.configurado && config?.ultimo_sync_status === "erro" && (
        <Card className="p-4 border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong className="text-sm text-red-700 dark:text-red-400">
                Erro no último sync
              </strong>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
                {config.ultimo_sync_erro}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
              Reconfigurar
            </Button>
          </div>
        </Card>
      )}

      {/* ====== Tabs ====== */}
      <div className="flex items-center gap-1 border-b border-border -mb-px overflow-x-auto">
        {([
          { key: "vendas" as Aba, label: "Vendas", sub: `${stats?.campanhas_vendas.length ?? 0} campanhas` },
          { key: "leads" as Aba, label: "Leads", sub: `${stats?.campanhas_leads.length ?? 0} campanhas` },
        ]).map((t) => {
          const ativo = aba === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              className={
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap " +
                (ativo
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
              <span className="ml-2 text-[10px] text-muted-foreground">{t.sub}</span>
            </button>
          );
        })}
      </div>

      {aba === "vendas" && (
        <VendasTab
          stats={stats}
          loading={loading}
          totais={totaisVendas}
          roas={roasVendas}
          ctr={ctrVendas}
          taxaPgCheckout={taxaPgCheckout}
          taxaCheckCompra={taxaCheckCompra}
          campanhas={campanhasVendas}
          busca={busca}
          setBusca={setBusca}
          syncInfo={config}
        />
      )}

      {aba === "leads" && (
        <LeadsTab
          stats={stats}
          loading={loading}
          totais={totaisLeads}
          ctr={ctrLeads}
          custoMedio={custoMedioResultado}
          taxaCadastro={taxaCadastro}
          campanhas={campanhasLeads}
          busca={busca}
          setBusca={setBusca}
          syncInfo={config}
          medianaCusto={medianaCusto}
        />
      )}
    </div>
  );
}

// ============================================================
// Tab Vendas
// ============================================================

function VendasTab({
  stats,
  loading,
  totais,
  roas,
  ctr,
  taxaPgCheckout,
  taxaCheckCompra,
  campanhas,
  busca,
  setBusca,
  syncInfo,
}: {
  stats: Stats | null;
  loading: boolean;
  totais: {
    spend: number;
    receita: number;
    compras: number;
    reach: number;
    impressions: number;
    clicks: number;
    page_views: number;
    checkout: number;
  };
  roas: number | null;
  ctr: number;
  taxaPgCheckout: number | null;
  taxaCheckCompra: number | null;
  campanhas: CampanhaKPI[];
  busca: string;
  setBusca: (s: string) => void;
  syncInfo: Config | null;
}) {
  const rb = roasBadge(roas);

  return (
    <div className="space-y-5">
      {/* Hero KPI + Sync ----- */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-6 bg-gradient-to-br from-emerald-500/[0.07] via-emerald-500/[0.02] to-transparent border-emerald-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              <DollarSign className="h-3.5 w-3.5" />
              Investimento total · Vendas
            </div>
            <div className="mt-3 text-4xl font-semibold tabular-nums tracking-tight">
              {loading ? <span className="text-muted-foreground/40">…</span> : brl(totais.spend)}
            </div>
            <div className="mt-2 flex items-baseline gap-4 text-xs text-muted-foreground flex-wrap">
              <span>
                Receita: <span className="text-foreground font-medium">{brl(totais.receita)}</span>
              </span>
              <span>
                ROAS:{" "}
                <span className={rb.class}>
                  {roas == null ? "—" : `${roas.toFixed(2)}x`}
                </span>
              </span>
              <span>
                Vendas: <span className="text-foreground font-medium">{num(totais.compras)}</span>
              </span>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        </Card>

        <SyncInfoCard config={syncInfo} />
      </div>

      {/* KPIs secundários ----- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPISmall
          icon={Users}
          tone="sky"
          label="Alcance · Impressões"
          value={num(totais.reach)}
          sub={`${num(totais.impressions)} imp.`}
          loading={loading}
        />
        <KPISmall
          icon={MousePointerClick}
          tone="violet"
          label="Cliques · CTR"
          value={num(totais.clicks)}
          sub={`${ctr.toFixed(2)}%`}
          loading={loading}
        />
        <KPISmall
          icon={Eye}
          tone="amber"
          label="Pg. Views · → Checkout"
          value={num(totais.page_views)}
          sub={taxaPgCheckout != null ? pct(taxaPgCheckout) : "—"}
          loading={loading}
        />
        <KPISmall
          icon={ShoppingCart}
          tone="zinc"
          label="Checkouts · → Compra"
          value={num(totais.checkout)}
          sub={taxaCheckCompra != null ? pct(taxaCheckCompra) : "—"}
          loading={loading}
        />
      </div>

      {/* Série diária ----- */}
      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">Investimento × Receita diária</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats?.periodo_inicio} → {stats?.periodo_fim}
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
              Spend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
              Receita
            </span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats?.serie_diaria_vendas ?? []}>
              <defs>
                <linearGradient id="gradSpendVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="data"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(d: string) => d.slice(5)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => brlShort(v)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => brlShort(v)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                }}
                formatter={(value: number | string, name: string) =>
                  name === "Spend" || name === "Receita" ? brl(Number(value)) : String(value)
                }
              />
              <Bar
                yAxisId="left"
                dataKey="spend"
                name="Spend"
                fill="url(#gradSpendVendas)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Line
                yAxisId="right"
                dataKey="purchase_value"
                name="Receita"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabela campanhas ----- */}
      <Card className="overflow-hidden">
        <div className="p-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">
              Por campanha · Vendas{" "}
              <span className="text-muted-foreground font-normal ml-1">
                ({campanhas.length})
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ROAS &lt; 1 sinaliza prejuízo; &gt;= 2 é zona saudável
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 w-[280px]"
            />
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto border-t">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="text-right w-[110px]">Spend</TableHead>
                <TableHead className="text-right w-[90px]">Alcance</TableHead>
                <TableHead className="text-right w-[80px]">Cliques</TableHead>
                <TableHead className="text-right w-[70px]">CTR</TableHead>
                <TableHead className="text-right w-[80px]">Pg.Views</TableHead>
                <TableHead className="text-right w-[80px]">Check.</TableHead>
                <TableHead className="text-right w-[80px]">Vendas</TableHead>
                <TableHead className="text-right w-[110px]">Receita</TableHead>
                <TableHead className="text-right w-[80px]">ROAS</TableHead>
                <TableHead className="text-right w-[110px]">CPA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                    Nenhuma campanha de vendas no período.
                  </TableCell>
                </TableRow>
              )}
              {campanhas.map((c) => {
                const rb = roasBadge(c.roas);
                const RBIcon = rb.icon;
                const st = statusInfo(c.status);
                return (
                  <TableRow key={c.campaign_id}>
                    <TableCell className="font-medium max-w-[280px]">
                      <span className="truncate block" title={c.campaign_name}>
                        {c.campaign_name}
                      </span>
                      {c.objetivo && (
                        <span className="text-[10px] text-muted-foreground">
                          {c.objetivo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.text}`}>
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(Number(c.spend))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {num(c.reach)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(c.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(c.ctr).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(c.landing_page_views)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(c.initiate_checkout)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                      {num(c.purchases)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(Number(c.purchase_value))}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${rb.class}`}>
                      <span className="inline-flex items-center gap-1">
                        {RBIcon && <RBIcon className="h-3 w-3" />}
                        {c.roas == null ? "—" : `${c.roas.toFixed(2)}x`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.cpa == null ? "—" : brl(Number(c.cpa))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Tab Leads
// ============================================================

function LeadsTab({
  stats,
  loading,
  totais,
  ctr,
  custoMedio,
  taxaCadastro,
  campanhas,
  busca,
  setBusca,
  syncInfo,
  medianaCusto,
}: {
  stats: Stats | null;
  loading: boolean;
  totais: {
    spend: number;
    resultados: number;
    reach: number;
    impressions: number;
    clicks: number;
    page_views: number;
  };
  ctr: number;
  custoMedio: number | null;
  taxaCadastro: number | null;
  campanhas: CampanhaKPI[];
  busca: string;
  setBusca: (s: string) => void;
  syncInfo: Config | null;
  medianaCusto: number;
}) {
  return (
    <div className="space-y-5">
      {/* Hero ----- */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-500/[0.07] via-blue-500/[0.02] to-transparent border-blue-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              <Target className="h-3.5 w-3.5" />
              Investimento total · Leads
            </div>
            <div className="mt-3 text-4xl font-semibold tabular-nums tracking-tight">
              {loading ? <span className="text-muted-foreground/40">…</span> : brl(totais.spend)}
            </div>
            <div className="mt-2 flex items-baseline gap-4 text-xs text-muted-foreground flex-wrap">
              <span>
                Resultados:{" "}
                <span className="text-foreground font-medium">{num(totais.resultados)}</span>
              </span>
              <span>
                Custo/Resultado:{" "}
                <span className="text-foreground font-medium">
                  {custoMedio == null ? "—" : brl(custoMedio)}
                </span>
              </span>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        </Card>

        <SyncInfoCard config={syncInfo} />
      </div>

      {/* KPIs ----- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPISmall
          icon={Users}
          tone="sky"
          label="Alcance · Impressões"
          value={num(totais.reach)}
          sub={`${num(totais.impressions)} imp.`}
          loading={loading}
        />
        <KPISmall
          icon={MousePointerClick}
          tone="violet"
          label="Cliques · CTR"
          value={num(totais.clicks)}
          sub={`${ctr.toFixed(2)}%`}
          loading={loading}
        />
        <KPISmall
          icon={Eye}
          tone="amber"
          label="Pg. Views"
          value={num(totais.page_views)}
          sub={`em ${campanhas.length} campanhas`}
          loading={loading}
        />
        <KPISmall
          icon={Activity}
          tone="emerald"
          label="Taxa de cadastro média"
          value={taxaCadastro == null ? "—" : pct(taxaCadastro)}
          sub={taxaCadastro != null ? "resultados / page views" : undefined}
          loading={loading}
        />
      </div>

      {/* Série diária ----- */}
      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">Investimento × Resultados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats?.periodo_inicio} → {stats?.periodo_fim}
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
              Spend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
              Resultados
            </span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats?.serie_diaria_leads ?? []}>
              <defs>
                <linearGradient id="gradSpendLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="data"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(d: string) => d.slice(5)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => brlShort(v)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                }}
                formatter={(value: number | string, name: string) =>
                  name === "Spend" ? brl(Number(value)) : String(value)
                }
              />
              <Bar
                yAxisId="left"
                dataKey="spend"
                name="Spend"
                fill="url(#gradSpendLeads)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Line
                yAxisId="right"
                dataKey="resultados"
                name="Resultados"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabela ----- */}
      <Card className="overflow-hidden">
        <div className="p-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">
              Por campanha · Leads{" "}
              <span className="text-muted-foreground font-normal ml-1">
                ({campanhas.length})
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              &ldquo;Resultados&rdquo; = soma de todas as custom conversions atribuídas à campanha
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 w-[280px]"
            />
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto border-t">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="text-right w-[110px]">Spend</TableHead>
                <TableHead className="text-right w-[90px]">Alcance</TableHead>
                <TableHead className="text-right w-[80px]">Cliques</TableHead>
                <TableHead className="text-right w-[70px]">CTR</TableHead>
                <TableHead className="text-right w-[80px]">Pg.Views</TableHead>
                <TableHead className="text-right w-[100px]">Result.</TableHead>
                <TableHead className="text-right w-[120px]">Custo/Result.</TableHead>
                <TableHead className="text-right w-[110px]">Tx. cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                    Nenhuma campanha de leads no período.
                  </TableCell>
                </TableRow>
              )}
              {campanhas.map((c) => {
                const st = statusInfo(c.status);
                const custo = Number(c.custo_por_resultado ?? 0);
                // Outlier: 2x acima da mediana
                const outlier = medianaCusto > 0 && custo > medianaCusto * 2;
                return (
                  <TableRow
                    key={c.campaign_id}
                    className={outlier ? "bg-amber-500/5" : ""}
                  >
                    <TableCell className="font-medium max-w-[280px]">
                      <span className="truncate block" title={c.campaign_name}>
                        {c.campaign_name}
                      </span>
                      {c.objetivo && (
                        <span className="text-[10px] text-muted-foreground">
                          {c.objetivo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.text}`}>
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(Number(c.spend))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {num(c.reach)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(c.clicks)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(c.ctr).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(c.landing_page_views)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-blue-700 dark:text-blue-400">
                      {num(c.resultados)}
                    </TableCell>
                    <TableCell
                      className={
                        "text-right tabular-nums " +
                        (outlier ? "text-amber-700 dark:text-amber-400 font-medium" : "")
                      }
                    >
                      {c.custo_por_resultado == null ? "—" : brl(Number(c.custo_por_resultado))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.taxa_cadastro == null ? "—" : pct(c.taxa_cadastro)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Sub-componentes compartilhados
// ============================================================

const TONES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  sky: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400" },
  zinc: { bg: "bg-zinc-500/10", text: "text-zinc-600 dark:text-zinc-400" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
};

function KPISmall({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TONES;
  loading: boolean;
}) {
  const t = TONES[tone];
  return (
    <Card className="p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${t.bg}`}>
          <Icon className={`w-4 h-4 ${t.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5 truncate" title={value}>
            {loading ? "…" : value}
          </p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function SyncInfoCard({ config }: { config: Config | null }) {
  if (!config) {
    return (
      <Card className="p-4">
        <div className="text-xs text-muted-foreground">Carregando…</div>
      </Card>
    );
  }

  const naoConfig = !config.configurado;
  const erro = config.ultimo_sync_status === "erro";
  const parcial = config.ultimo_sync_status === "parcial";

  return (
    <Card className={`p-4 ${naoConfig ? "border-amber-500/30" : erro ? "border-red-500/30" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status do sync
        </span>
        {naoConfig ? (
          <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px]">
            <XCircle className="mr-1 h-2.5 w-2.5" />
            não config.
          </Badge>
        ) : erro ? (
          <Badge variant="outline" className="text-red-700 dark:text-red-400 border-red-500/40 text-[10px]">
            <XCircle className="mr-1 h-2.5 w-2.5" />
            erro
          </Badge>
        ) : parcial ? (
          <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px]">
            <AlertCircle className="mr-1 h-2.5 w-2.5" />
            parcial
          </Badge>
        ) : (
          <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/40 text-[10px]">
            <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
            ok
          </Badge>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">Último sync</div>
            <div className="text-xs font-medium" title={dt(config.ultimo_sync)}>
              {config.ultimo_sync ? dtRelativo(config.ultimo_sync) : "—"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">Processadas</div>
            <div className="text-xs font-medium">
              {(config.ultimo_sync_total || 0).toLocaleString("pt-BR")} linhas
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">Agendado</div>
            <div className="text-xs font-medium">a cada 1h · últimos 7d</div>
          </div>
        </div>

        {config.ad_account_ids.length > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Zap className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground leading-tight">Ad accounts</div>
              <div className="text-xs font-medium">{config.ad_account_ids.length}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Sheet de configuração
// ============================================================

function ConfigSheet({
  config,
  isAdmin,
  onSaved,
}: {
  config: Config | null;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [accountsRaw, setAccountsRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AdAccountInfo[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDias, setSyncDias] = useState(7);

  useEffect(() => {
    // Quando abre o sheet, popula textarea com accounts já salvas (não exibe token, é mascarado)
    if (config?.ad_account_ids?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccountsRaw(config.ad_account_ids.join("\n"));
    }
  }, [config]);

  function parseAccounts(): string[] {
    return accountsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function salvar() {
    if (!isAdmin) {
      toast.error("Apenas admins podem alterar credenciais");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ativo: true };
      if (accessToken.trim()) body.access_token = accessToken.trim();
      const accs = parseAccounts();
      if (accs.length > 0) body.ad_account_ids = accs;
      await api.put("/meta-ads/config", body);
      toast.success("Configuração salva");
      setAccessToken("");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function testar() {
    setTesting(true);
    setTestResult(null);
    try {
      // Se o usuário acabou de colar um token mas ainda não salvou, salva primeiro
      if (accessToken.trim() && isAdmin) {
        await api.put("/meta-ads/config", {
          access_token: accessToken.trim(),
          ativo: true,
        });
      }
      const res = await api.get<AdAccountInfo[]>("/meta-ads/ad-accounts");
      setTestResult(res);
      toast.success(`Conexão ok — ${res.length} contas encontradas`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha no teste");
    } finally {
      setTesting(false);
    }
  }

  async function sincronizar() {
    setSyncing(true);
    try {
      const hoje = new Date();
      const since = new Date(hoje);
      since.setDate(since.getDate() - syncDias);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const res = await api.post<{
        ok: boolean;
        total_linhas: number;
        contas_processadas: number;
        erro: string | null;
      }>("/meta-ads/sync", { since: iso(since), until: iso(hoje) });
      if (res.ok) {
        toast.success(
          `Sync: ${res.total_linhas} linhas · ${res.contas_processadas} contas`,
        );
        onSaved();
      } else {
        toast.error(`Sync falhou: ${res.erro ?? "—"}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no sync");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Configurar Meta Ads</SheetTitle>
      </SheetHeader>

      {/* Anti-autofill */}
      <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden />
      <input type="password" name="password" autoComplete="current-password" className="hidden" tabIndex={-1} aria-hidden />

      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Obtenha em <strong>Business Manager → Configurações → Usuários do sistema</strong>.
          Use System User token de longa duração com permissões ads_read.
        </p>

        {!isAdmin && (
          <Card className="p-3 border-amber-500/40 bg-amber-500/5">
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Apenas admins podem alterar credenciais. Você pode visualizar a configuração atual.
            </p>
          </Card>
        )}

        <div>
          <Label className="text-xs">
            Access Token{" "}
            {config?.access_token_mask && (
              <span className="text-muted-foreground ml-2 font-mono">
                atual: {config.access_token_mask}
              </span>
            )}
          </Label>
          <Input
            name="meta_at"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={config?.access_token_mask ? "(manter atual)" : "Cole o System User token"}
            className="font-mono text-xs"
            disabled={!isAdmin}
          />
          {config?.token_expires_at && (
            <p
              className={
                "mt-1 text-[11px] " +
                (config.dias_para_expirar != null && config.dias_para_expirar < 7
                  ? "text-red-700 dark:text-red-400"
                  : "text-muted-foreground")
              }
            >
              Expira em {dt(config.token_expires_at)}
              {config.dias_para_expirar != null && (
                <span className="ml-1">
                  ({config.dias_para_expirar < 0
                    ? `há ${Math.abs(config.dias_para_expirar)} dias`
                    : `em ${config.dias_para_expirar} dias`})
                </span>
              )}
            </p>
          )}
        </div>

        <div>
          <Label className="text-xs">Ad Account IDs</Label>
          <Textarea
            value={accountsRaw}
            onChange={(e) => setAccountsRaw(e.target.value)}
            placeholder="act_1234567890&#10;act_9876543210"
            className="font-mono text-xs min-h-[80px]"
            disabled={!isAdmin}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Um por linha ou separados por vírgula. Prefixo <code>act_</code> é adicionado automaticamente.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={salvar}
            disabled={saving || !isAdmin}
            className="flex-1"
            size="sm"
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            onClick={testar}
            disabled={testing || !isAdmin}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {testing ? "Testando…" : "Testar conexão"}
          </Button>
        </div>

        {testResult && (
          <Card className="p-3 bg-emerald-500/5 border-emerald-500/40">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
              {testResult.length} ad accounts disponíveis no token:
            </p>
            <ul className="space-y-1 text-[11px]">
              {testResult.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <code className="text-muted-foreground">{a.id}</code>
                  <span className="truncate">{a.name || "—"}</span>
                  {a.currency && (
                    <Badge variant="outline" className="text-[9px]">
                      {a.currency}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="border-t pt-4 space-y-2">
          <p className="text-xs font-medium">Sincronizar agora</p>
          <div className="flex gap-2 items-center">
            <Select
              value={String(syncDias)}
              onValueChange={(v: string | null) => v && setSyncDias(Number(v))}
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 dias</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={sincronizar}
              disabled={syncing || !isAdmin || !config?.configurado}
              size="sm"
            >
              {syncing ? "…" : "Rodar"}
            </Button>
          </div>
        </div>
      </div>
    </SheetContent>
  );
}
