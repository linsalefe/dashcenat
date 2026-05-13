"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Link as LinkIcon,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Repeat,
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
  Legend,
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

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

const SEGMENTOS: { key: Segmento; label: string; descricao: string }[] = [
  { key: "todos", label: "Visão geral", descricao: "Todas as vendas" },
  { key: "cursos", label: "Cursos livres", descricao: "Vendas avulsas (cursos, ebooks, congressos)" },
  { key: "comunidade", label: "Comunidade", descricao: "Assinaturas recorrentes" },
];

// ============================================================
// Página
// ============================================================

export default function HotmartPage() {
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

  return (
    <div className="space-y-5">
      {/* ====== Header ====== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Hotmart</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{mesLabel}</span>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            {segLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge config={config} />

          <Select
            value={`${ano}-${mes}`}
            onValueChange={(v: string | null) => {
              if (!v) return;
              const [a, m] = v.split("-").map(Number);
              setAno(a);
              setMes(m);
            }}
          >
            <SelectTrigger className="h-8 min-w-[160px]">
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

          <Button size="sm" variant="outline" onClick={sincronizar} disabled={syncing}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>

          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" />}>
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
              <strong className="text-sm text-red-700 dark:text-red-400">
                Erro no último sync
              </strong>
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
      <div className="flex gap-1 border-b border-border -mb-px overflow-x-auto">
        {SEGMENTOS.map((s) => {
          const ativo = segmento === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSegmento(s.key)}
              className={
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap " +
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

      {/* ====== KPIs ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          icon={DollarSign}
          tone="emerald"
          label="Receita líquida"
          value={brl(Number(stats?.receita_total ?? 0))}
          loading={loading}
        />
        <KPICard
          icon={ShoppingCart}
          tone="sky"
          label="Vendas"
          value={(stats?.vendas_count ?? 0).toLocaleString("pt-BR")}
          loading={loading}
        />
        <KPICard
          icon={TrendingUp}
          tone="violet"
          label="Ticket médio"
          value={brl(Number(stats?.ticket_medio ?? 0))}
          loading={loading}
        />
        <KPICard
          icon={LinkIcon}
          tone="zinc"
          label="Com UTM"
          value={`${stats?.matched_pct ?? 0}%`}
          loading={loading}
        />
      </div>

      {/* ====== Gráfico ====== */}
      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Receita diária</h3>
          <span className="text-xs text-muted-foreground">{mesLabel}</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats?.receita_por_dia ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="data"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(d: string) => d.slice(8, 10)}
              />
              <YAxis
                yAxisId="left"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => `R$${Math.round(v / 1000)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number | string, name: string) =>
                  name === "Receita" ? brl(Number(value)) : value
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="receita" name="Receita" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                dataKey="vendas"
                name="Vendas"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ====== Top tabelas ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium">Top produtos</h3>
          <TabelaTop linhas={stats?.top_produtos ?? []} chaveProp="produto" />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium">Top campanhas (utm_campaign)</h3>
          <TabelaTop linhas={stats?.top_campaigns ?? []} chaveProp="campaign" />
        </Card>
      </div>

      {/* ====== Vendas ====== */}
      <Card className="p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">
            Vendas <span className="text-muted-foreground font-normal">({vendas.length})</span>
          </h3>
          <span className="text-xs text-muted-foreground">{mesLabel}</span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-[180px]">Cliente</TableHead>
                <TableHead className="w-[180px]">Source / Campaign</TableHead>
                <TableHead className="text-right w-[120px]">Líquido</TableHead>
                <TableHead className="w-[100px]">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma venda neste período/segmento.{" "}
                    <button
                      onClick={sincronizar}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Sincronizar com Hotmart
                    </button>
                  </TableCell>
                </TableRow>
              )}
              {vendas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {dt(v.data_venda)}
                  </TableCell>
                  <TableCell className="font-medium max-w-[260px] truncate" title={v.produto}>
                    {v.produto}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {v.cliente_email || v.cliente_nome || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {v.utm_source ? (
                      <span className="flex items-center gap-1.5">
                        <span>{v.utm_source}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {v.utm_campaign || "—"}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {brl(Number(v.faturamento_liquido ?? 0))}
                  </TableCell>
                  <TableCell>
                    {v.is_subscription ? (
                      <Badge className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/15 text-[10px]">
                        <Repeat className="mr-1 h-2.5 w-2.5" />
                        Assinatura
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Avulsa
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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

const TONES: Record<
  string,
  { bg: string; text: string }
> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  sky:     { bg: "bg-sky-500/10",     text: "text-sky-600 dark:text-sky-400" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400" },
  zinc:    { bg: "bg-zinc-500/10",    text: "text-zinc-600 dark:text-zinc-400" },
};

function KPICard({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: keyof typeof TONES;
  loading: boolean;
}) {
  const t = TONES[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${t.bg}`}>
          <Icon className={`w-5 h-5 ${t.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          <p className="text-xl font-semibold tabular-nums mt-1 truncate" title={value}>
            {loading ? "…" : value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ config }: { config: Config | null }) {
  if (!config) return null;
  if (!config.configurado) {
    return (
      <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/40">
        <XCircle className="mr-1 h-3 w-3" />
        Não configurado
      </Badge>
    );
  }
  if (config.ultimo_sync_status === "erro") {
    return (
      <Badge
        variant="outline"
        className="text-red-700 dark:text-red-400 border-red-500/40"
        title={config.ultimo_sync_erro || ""}
      >
        <XCircle className="mr-1 h-3 w-3" />
        Erro no sync
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
      title={dt(config.ultimo_sync)}
    >
      <CheckCircle2 className="mr-1 h-3 w-3" />
      {config.ultimo_sync ? `Sync: ${dt(config.ultimo_sync)}` : "Configurado"}
    </Badge>
  );
}

function TabelaTop({
  linhas,
  chaveProp,
}: {
  linhas: Array<{ vendas: number; receita: number } & Record<string, unknown>>;
  chaveProp: string;
}) {
  if (linhas.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-6 text-sm">Sem dados</div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{chaveProp}</TableHead>
          <TableHead className="text-right w-[80px]">Vendas</TableHead>
          <TableHead className="text-right w-[120px]">Receita</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l, i) => {
          const chave = String(l[chaveProp] ?? "—");
          return (
            <TableRow key={i}>
              <TableCell className="font-medium max-w-[280px] truncate" title={chave}>
                {chave}
              </TableCell>
              <TableCell className="text-right tabular-nums">{l.vendas}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {brl(Number(l.receita ?? 0))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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

      {/* fake inputs pra absorver autofill */}
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
