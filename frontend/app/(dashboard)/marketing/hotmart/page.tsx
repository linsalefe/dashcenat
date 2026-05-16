"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DollarSign,
  ShoppingCart,
  Link as LinkIcon,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Repeat,
  Clock,
  Search,
  Package,
  Activity,
  Sparkles,
  MousePointerClick,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// ============================================================
// Tipos
// ============================================================

interface Config {
  configurado: boolean;
  ativo: boolean;
  client_id_mask: string | null;
  has_secret: boolean;
  has_basic_token: boolean;
  has_hottok: boolean;
  ultimo_sync: string | null;
  ultimo_sync_status: string | null;
  ultimo_sync_erro: string | null;
  ultimo_sync_total: number;
}

interface Stats {
  receita_total: number;
  vendas_count: number;
  ticket_medio: number;
  matched_pct: number;
  receita_por_dia: { data: string; receita: number; vendas: number }[];
  top_produtos: { produto: string; vendas: number; receita: number }[];
  top_campaigns: { campaign: string; vendas: number; receita: number }[];
  top_ctas: { cta: string; vendas: number; receita: number }[];
}

interface Venda {
  id: string;
  transacao: string;
  produto: string;
  preco_total: number;
  faturamento_liquido: number;
  taxa_hotmart: number | null;
  data_venda: string | null;
  status: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  meio_pagamento: string | null;
  is_subscription: boolean | null;
  commission_as: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  matched_via: string | null;
  cta: string | null;
}

type Segmento = "todos" | "cursos" | "comunidade";

// ============================================================
// Helpers
// ============================================================

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function ultimosMeses(n: number): { ano: number; mes: number; label: string }[] {
  const hoje = new Date();
  const out: { ano: number; mes: number; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    out.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return out;
}

const brl = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brlShort = (v: number) => {
  const n = v ?? 0;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return brl(n);
};

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

const SEGMENTOS: { key: Segmento; label: string; descricao: string }[] = [
  { key: "todos", label: "Visão geral", descricao: "Todas as vendas" },
  { key: "cursos", label: "Cursos livres", descricao: "Vendas avulsas (cursos, ebooks, congressos)" },
  { key: "comunidade", label: "Comunidade", descricao: "Assinaturas recorrentes" },
];

const STATUS_CORES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  APPROVED:   { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", dot: "#10b981", label: "Aprovada" },
  COMPLETE:   { bg: "bg-sky-500/10",     text: "text-sky-700 dark:text-sky-400",         dot: "#0ea5e9", label: "Completa" },
  REFUNDED:   { bg: "bg-rose-500/10",    text: "text-rose-700 dark:text-rose-400",       dot: "#f43f5e", label: "Reembolsada" },
  CHARGEBACK: { bg: "bg-orange-500/10",  text: "text-orange-700 dark:text-orange-400",   dot: "#f97316", label: "Chargeback" },
  CANCELED:   { bg: "bg-zinc-500/10",    text: "text-zinc-700 dark:text-zinc-400",       dot: "#71717a", label: "Cancelada" },
};

const statusInfo = (s: string | null) =>
  (s && STATUS_CORES[s]) || { bg: "bg-zinc-500/10", text: "text-zinc-700", dot: "#71717a", label: s || "—" };

// ============================================================
// Página
// ============================================================

export default function HotmartPage() {
  const searchParams = useSearchParams();

  // Filtros vindos da URL (do /marketing/tracking)
  const initialBusca = useMemo(() => {
    if (!searchParams) return "";
    return (
      searchParams.get("utm_source") ||
      searchParams.get("utm_campaign") ||
      searchParams.get("produto") ||
      searchParams.get("cta") ||
      ""
    );
  }, [searchParams]);

  const meses = useMemo(() => ultimosMeses(12), []);
  const [ano, setAno] = useState<number>(meses[0].ano);
  const [mes, setMes] = useState<number>(meses[0].mes);
  const [segmento, setSegmento] = useState<Segmento>("todos");
  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const [busca, setBusca] = useState(initialBusca);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Quando a URL muda (link de tracking), reaplica busca
  useEffect(() => {
    setBusca(initialBusca);
  }, [initialBusca]);

  const mesLabel = useMemo(
    () => meses.find((m) => m.ano === ano && m.mes === mes)?.label ?? `${mes}/${ano}`,
    [meses, ano, mes],
  );
  const segLabel = SEGMENTOS.find((s) => s.key === segmento)?.descricao ?? "";

  async function load() {
    setLoading(true);
    try {
      const qs = `ano=${ano}&mes=${mes}&segmento=${segmento}`;
      const [c, s, v] = await Promise.all([
        api.get<Config>("/hotmart/config"),
        api.get<Stats>(`/hotmart/stats?${qs}`).catch(() => null),
        api.get<Venda[]>(`/hotmart/vendas?${qs}&limit=500`).catch(() => [] as Venda[]),
      ]);
      setConfig(c);
      setStats(s);
      setVendas(v);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes, segmento]);

  async function sincronizar() {
    if (!config?.configurado) {
      toast.error("Configure as credenciais primeiro");
      setConfigOpen(true);
      return;
    }
    setSyncing(true);
    try {
      const inicio = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 1);
      const agora = new Date();
      const fim = fimMes > agora ? agora : fimMes;
      const res = await api.post<{ total: number; novos: number; matched: number }>(
        "/hotmart/sync",
        { start_date: inicio.toISOString(), end_date: fim.toISOString() },
      );
      toast.success(
        `Sync ok: ${res.total} processadas · ${res.novos} novas · ${res.matched} com UTM`,
      );
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no sync");
    } finally {
      setSyncing(false);
    }
  }

  // ----- Derivados client-side -----
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; receita: number }> = {};
    for (const v of vendas) {
      const s = v.status || "—";
      if (!counts[s]) counts[s] = { count: 0, receita: 0 };
      counts[s].count += 1;
      counts[s].receita += Number(v.faturamento_liquido) || 0;
    }
    return Object.entries(counts)
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [vendas]);

  const tipoBreakdown = useMemo(() => {
    let assin = 0;
    let avulsa = 0;
    let receitaAssin = 0;
    let receitaAvulsa = 0;
    for (const v of vendas) {
      const liq = Number(v.faturamento_liquido) || 0;
      if (v.is_subscription) {
        assin++;
        receitaAssin += liq;
      } else {
        avulsa++;
        receitaAvulsa += liq;
      }
    }
    return { assin, avulsa, receitaAssin, receitaAvulsa };
  }, [vendas]);

  const vendasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return vendas.filter((v) => {
      if (filtroStatus !== "todos" && (v.status || "") !== filtroStatus) return false;
      if (!q) return true;
      return (
        (v.produto || "").toLowerCase().includes(q) ||
        (v.cliente_email || "").toLowerCase().includes(q) ||
        (v.cliente_nome || "").toLowerCase().includes(q) ||
        (v.transacao || "").toLowerCase().includes(q) ||
        (v.utm_campaign || "").toLowerCase().includes(q) ||
        (v.utm_source || "").toLowerCase().includes(q) ||
        (v.cta || "").toLowerCase().includes(q)
      );
    });
  }, [vendas, busca, filtroStatus]);

  return (
    <div className="space-y-5">
      {/* ====== Header ====== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Hotmart</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm font-medium">{mesLabel}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-sm text-muted-foreground">{segLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={`${ano}-${mes}`}
            onValueChange={(v: string | null) => {
              if (!v) return;
              const [a, m] = v.split("-").map(Number);
              setAno(a);
              setMes(m);
            }}
          >
            <SelectTrigger className="h-9 min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={`${m.ano}-${m.mes}`} value={`${m.ano}-${m.mes}`}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" onClick={sincronizar} disabled={syncing} className="h-9">
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>

          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="h-9" />}>
              <Settings className="mr-2 h-3.5 w-3.5" />
              Configurar
            </DialogTrigger>
            <ConfigDialog
              config={config}
              onSaved={() => {
                setConfigOpen(false);
                load();
              }}
            />
          </Dialog>
        </div>
      </div>

      {/* ====== Banners ====== */}
      {!config?.configurado && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong className="text-sm">Hotmart não configurado</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cole seu Client ID + Client Secret pra começar a puxar as vendas.
              </p>
            </div>
            <Button size="sm" onClick={() => setConfigOpen(true)}>
              Configurar
            </Button>
          </div>
        </Card>
      )}

      {config?.configurado && config?.ultimo_sync_status === "erro" && (
        <Card className="p-4 border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong className="text-sm text-red-700 dark:text-red-400">Erro no último sync</strong>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
                {config?.ultimo_sync_erro}
              </p>
              {config?.ultimo_sync_erro?.toLowerCase().includes("invalid_client") && (
                <p className="text-xs mt-2">
                  ⚠️ Credenciais inválidas ou revogadas. Crie nova em{" "}
                  <strong>Hotmart → Credenciais do Desenvolvedor</strong> e atualize aqui.
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
              Reconfigurar
            </Button>
          </div>
        </Card>
      )}

      {/* ====== Abas ====== */}
      <div className="flex items-center gap-1 border-b border-border -mb-px overflow-x-auto">
        {SEGMENTOS.map((s) => {
          const ativo = segmento === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSegmento(s.key)}
              className={
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap " +
                (ativo
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ====== Hero KPI + Sync card ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-6 bg-gradient-to-br from-emerald-500/[0.07] via-emerald-500/[0.02] to-transparent border-emerald-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              <DollarSign className="h-3.5 w-3.5" />
              Receita líquida
            </div>
            <div className="mt-3 text-4xl font-semibold tabular-nums tracking-tight">
              {loading ? <span className="text-muted-foreground/40">…</span> : brl(Number(stats?.receita_total ?? 0))}
            </div>
            <div className="mt-2 flex items-baseline gap-4 text-xs text-muted-foreground flex-wrap">
              <span>{stats?.vendas_count ?? 0} vendas</span>
              <span>
                Ticket: <span className="text-foreground font-medium">{brl(Number(stats?.ticket_medio ?? 0))}</span>
              </span>
              <span>{stats?.matched_pct ?? 0}% com UTM</span>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        </Card>

        <SyncInfoCard config={config} />
      </div>

      {/* ====== KPIs secundários ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SmallKPI
          icon={ShoppingCart}
          tone="sky"
          label="Vendas"
          value={(stats?.vendas_count ?? 0).toLocaleString("pt-BR")}
          sub={`${tipoBreakdown.avulsa} avulsas · ${tipoBreakdown.assin} assin.`}
          loading={loading}
        />
        <SmallKPI
          icon={Repeat}
          tone="violet"
          label="Assinaturas"
          value={brl(tipoBreakdown.receitaAssin)}
          sub={tipoBreakdown.assin > 0 ? `${tipoBreakdown.assin} transações` : "—"}
          loading={loading}
        />
        <SmallKPI
          icon={Package}
          tone="amber"
          label="Vendas avulsas"
          value={brl(tipoBreakdown.receitaAvulsa)}
          sub={`${tipoBreakdown.avulsa} transações`}
          loading={loading}
        />
        <SmallKPI
          icon={LinkIcon}
          tone="zinc"
          label="Atribuição UTM"
          value={`${stats?.matched_pct ?? 0}%`}
          sub={`${vendas.filter((v) => v.utm_source).length} de ${vendas.length}`}
          loading={loading}
        />
      </div>

      {/* ====== Receita diária + Status donut ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-medium">Receita diária</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{mesLabel}</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                Receita
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
                Vendas
              </span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats?.receita_por_dia ?? []}>
                <defs>
                  <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="data"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(d: string) => d.slice(8, 10)}
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
                    name === "Receita" ? brl(Number(value)) : String(value)
                  }
                  labelFormatter={(label) => `Dia ${String(label).slice(8, 10)}`}
                />
                <Bar
                  yAxisId="left"
                  dataKey="receita"
                  name="Receita"
                  fill="url(#gradReceita)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="right"
                  dataKey="vendas"
                  name="Vendas"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: "#0ea5e9" }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3">
            <h3 className="text-sm font-medium">Status das vendas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Distribuição no mês</p>
          </div>
          <StatusDonut data={statusBreakdown} loading={loading} />
        </Card>
      </div>

      {/* ====== Top produtos / campanhas / CTAs ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Top produtos</h3>
          </div>
          <BarrasHorizontais linhas={stats?.top_produtos ?? []} chaveProp="produto" cor="#10b981" />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Top campanhas</h3>
            <span className="text-xs text-muted-foreground ml-auto">utm_campaign</span>
          </div>
          <BarrasHorizontais linhas={stats?.top_campaigns ?? []} chaveProp="campaign" cor="#0ea5e9" />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Top CTAs</h3>
            <span className="text-xs text-muted-foreground ml-auto">botão clicado</span>
          </div>
          <BarrasHorizontais linhas={stats?.top_ctas ?? []} chaveProp="cta" cor="#a855f7" />
        </Card>
      </div>

      {/* ====== Vendas ====== */}
      <Card className="overflow-hidden">
        <div className="p-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">
              Vendas{" "}
              <span className="text-muted-foreground font-normal ml-1">
                ({vendasFiltradas.length}
                {vendasFiltradas.length !== vendas.length && ` de ${vendas.length}`})
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{mesLabel}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar produto, cliente, campanha…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 pl-8 w-[280px]"
              />
            </div>
            <Select
              value={filtroStatus}
              onValueChange={(v: string | null) => setFiltroStatus(v || "todos")}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.keys(STATUS_CORES).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CORES[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto border-t">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[120px]">Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-[180px]">Cliente</TableHead>
                <TableHead className="w-[180px]">UTM</TableHead>
                <TableHead className="w-[140px]">CTA</TableHead>
                <TableHead className="text-right w-[120px]">Líquido</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    {vendas.length === 0 ? (
                      <>
                        Nenhuma venda neste período/segmento.{" "}
                        <button
                          onClick={sincronizar}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Sincronizar com Hotmart
                        </button>
                      </>
                    ) : (
                      <>Nenhuma venda corresponde ao filtro.</>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {vendasFiltradas.map((v) => {
                const st = statusInfo(v.status);
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {dt(v.data_venda)}
                    </TableCell>
                    <TableCell className="font-medium max-w-[280px]">
                      <div className="flex items-center gap-2">
                        {v.is_subscription && (
                          <Repeat className="h-3 w-3 text-violet-500 flex-shrink-0" aria-label="Assinatura" />
                        )}
                        <span className="truncate" title={v.produto}>{v.produto}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground truncate max-w-[180px]"
                      title={v.cliente_email || v.cliente_nome || ""}
                    >
                      {v.cliente_email || v.cliente_nome || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {v.utm_source ? (
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="truncate" title={`${v.utm_source} / ${v.utm_campaign}`}>
                            {v.utm_source}
                          </span>
                          {v.utm_campaign && (
                            <Badge variant="outline" className="text-[10px] w-fit max-w-full truncate">
                              {v.utm_campaign}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {v.cta ? (
                        <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400 truncate max-w-full" title={v.cta}>
                          <MousePointerClick className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
                          <span className="truncate">{v.cta}</span>
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {brl(Number(v.faturamento_liquido ?? 0))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.text}`}>
                        <span
                          className="w-1.5 h-1.5 rounded-full mr-1.5"
                          style={{ backgroundColor: st.dot }}
                        />
                        {st.label}
                      </Badge>
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
// Sub-componentes
// ============================================================

const TONES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  sky:     { bg: "bg-sky-500/10",     text: "text-sky-600 dark:text-sky-400" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-400" },
  zinc:    { bg: "bg-zinc-500/10",    text: "text-zinc-600 dark:text-zinc-400" },
};

function SmallKPI({
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
          <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">Processadas</div>
            <div className="text-xs font-medium">
              {(config.ultimo_sync_total || 0).toLocaleString("pt-BR")} vendas
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">Próximo agendado</div>
            <div className="text-xs font-medium">diário · 03:00 UTC</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatusDonut({
  data,
  loading,
}: {
  data: { status: string; count: number; receita: number }[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">…</div>;
  }
  if (data.length === 0) {
    return <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>;
  }

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <div className="h-44 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.status} fill={statusInfo(d.status).dot} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | string, _name: string, item: { payload?: { status?: string } }) => [
                `${value} vendas`,
                statusInfo(item?.payload?.status || null).label,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-xl font-semibold tabular-nums">{total}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">total</div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {data.map((d) => {
          const info = statusInfo(d.status);
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.status} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: info.dot }}
                />
                <span className="truncate">{info.label}</span>
              </div>
              <div className="flex items-center gap-2 tabular-nums text-muted-foreground flex-shrink-0">
                <span>{d.count}</span>
                <span className="w-9 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarrasHorizontais({
  linhas,
  chaveProp,
  cor,
}: {
  linhas: Array<{ vendas: number; receita: number } & Record<string, unknown>>;
  chaveProp: string;
  cor: string;
}) {
  if (linhas.length === 0) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Sem dados</div>;
  }

  const max = Math.max(...linhas.map((l) => Number(l.receita) || 0), 1);

  return (
    <div className="space-y-3">
      {linhas.slice(0, 8).map((l, i) => {
        const chave = String(l[chaveProp] ?? "—");
        const receita = Number(l.receita) || 0;
        const pct = (receita / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <div className="text-xs font-medium truncate min-w-0 flex-1" title={chave}>
                {chave}
              </div>
              <div className="text-xs tabular-nums flex items-center gap-3 flex-shrink-0">
                <span className="text-muted-foreground">{l.vendas}</span>
                <span className="font-medium">{brl(receita)}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: cor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Dialog de configuração (mantém anti-autofill)
// ============================================================

function ConfigDialog({
  config,
  onSaved,
}: {
  config: Config | null;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [basicToken, setBasicToken] = useState("");
  const [hottok, setHottok] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      const body: Record<string, string | boolean> = {};
      if (clientId) body.client_id = clientId;
      if (clientSecret) body.client_secret = clientSecret;
      if (basicToken) body.basic_token = basicToken;
      if (hottok) body.hottok = hottok;
      body.ativo = true;

      await api.put("/hotmart/config", body);
      toast.success("Credenciais salvas");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Configurar Hotmart</DialogTitle>
      </DialogHeader>

      <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden />
      <input type="password" name="password" autoComplete="current-password" className="hidden" tabIndex={-1} aria-hidden />

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Obtenha em <strong>Hotmart → Ferramentas → Credenciais do Desenvolvedor</strong>.
          Valores existentes não são exibidos — deixe em branco pra manter.
        </p>

        <div>
          <Label className="text-xs">
            Client ID{" "}
            {config?.client_id_mask && (
              <span className="text-muted-foreground ml-2 font-mono">
                atual: {config.client_id_mask}
              </span>
            )}
          </Label>
          <Input
            name="hotmart_cid"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={config?.client_id_mask ? "(manter atual)" : "Cole o Client ID"}
            className="font-mono text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">
            Client Secret{" "}
            {config?.has_secret && (
              <span className="text-muted-foreground ml-2">configurado ✓</span>
            )}
          </Label>
          <Input
            name="hotmart_secret"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={config?.has_secret ? "(manter atual)" : "Cole o Client Secret"}
            className="font-mono text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">
            Basic Token (opcional){" "}
            {config?.has_basic_token && (
              <span className="text-muted-foreground ml-2">configurado ✓</span>
            )}
          </Label>
          <Input
            name="hotmart_basic"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={basicToken}
            onChange={(e) => setBasicToken(e.target.value)}
            placeholder={config?.has_basic_token ? "(manter atual)" : "Cole o Basic Token (se usar)"}
            className="font-mono text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">
            Hottok (webhook){" "}
            {config?.has_hottok && (
              <span className="text-muted-foreground ml-2">configurado ✓</span>
            )}
          </Label>
          <Input
            name="hotmart_hottok"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={hottok}
            onChange={(e) => setHottok(e.target.value)}
            placeholder={config?.has_hottok ? "(manter atual)" : "Token de validação do webhook"}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Webhook URL:{" "}
            <code className="px-1 bg-muted rounded">
              https://dash.cenatdata.online/api/v1/hotmart/webhook
            </code>
          </p>
        </div>

        <Button onClick={salvar} disabled={saving} className="w-full">
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </DialogContent>
  );
}
