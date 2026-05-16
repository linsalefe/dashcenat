"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  MousePointer,
  Users,
  Percent,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  Globe2,
  MousePointerClick,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface StatTotais {
  pageviews: number;
  cliques: number;
  conversoes: number;
  receita: number;
  taxa_conversao: number;
  visitantes_unicos: number;
  vendas: number;
  receita_real: number;
  ticket_medio: number;
}
interface StatLinha {
  chave: string;
  pageviews: number;
  cliques: number;
  conversoes: number;
  receita: number;
  vendas: number;
  receita_real: number;
}
interface StatSerie {
  data: string;
  pageviews: number;
  cliques: number;
  conversoes: number;
  receita: number;
  vendas: number;
  receita_real: number;
}
interface StatsResponse {
  totais: StatTotais;
  por_source: StatLinha[];
  por_campaign: StatLinha[];
  por_produto: StatLinha[];
  por_cta: StatLinha[];
  serie_diaria: StatSerie[];
}

const PERIODOS = [
  { dias: 7, label: "7d" },
  { dias: 30, label: "30d" },
  { dias: 90, label: "90d" },
];

const brl = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brlShort = (v: number) => {
  const n = v ?? 0;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return brl(n);
};

export default function TrackingPage() {
  const router = useRouter();
  const [dias, setDias] = useState(30);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<StatsResponse>(`/track/stats?dias=${dias}`);
      setData(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar stats";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  const t = data?.totais;

  const taxaCliqueVenda = useMemo(() => {
    if (!t || !t.cliques) return 0;
    return Math.round(((t.vendas || 0) / t.cliques) * 1000) / 10;
  }, [t]);

  function abrirDetalhe(tipo: "source" | "campaign" | "produto" | "cta", chave: string) {
    const placeholders = new Set(["(direto)", "(sem campanha)", "(sem produto)", "(sem cta)"]);
    if (placeholders.has(chave)) return;
    const qs = new URLSearchParams();
    if (tipo === "source") qs.set("utm_source", chave);
    if (tipo === "campaign") qs.set("utm_campaign", chave);
    if (tipo === "produto") qs.set("produto", chave);
    if (tipo === "cta") qs.set("cta", chave);
    router.push(`/marketing/hotmart?${qs.toString()}`);
  }

  return (
    <div className="space-y-5">
      {/* ====== Header ====== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Tracking — visão geral</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Painel central de marketing. Tráfego e vendas atribuídas por UTM, campanha, produto e CTA.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border bg-muted/30 p-1">
            {PERIODOS.map((p) => (
              <Button
                key={p.dias}
                size="sm"
                variant={dias === p.dias ? "default" : "ghost"}
                onClick={() => setDias(p.dias)}
                className="h-7 px-3"
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ====== Hero KPI ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        <Card className="p-6 bg-gradient-to-br from-emerald-500/[0.07] via-emerald-500/[0.02] to-transparent border-emerald-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              <DollarSign className="h-3.5 w-3.5" />
              Receita atribuída
            </div>
            <div className="mt-3 text-4xl font-semibold tabular-nums tracking-tight">
              {loading ? <span className="text-muted-foreground/40">…</span> : brl(Number(t?.receita_real ?? 0))}
            </div>
            <div className="mt-2 flex items-baseline gap-4 text-xs text-muted-foreground flex-wrap">
              <span>{t?.vendas ?? 0} vendas</span>
              <span>
                Ticket: <span className="text-foreground font-medium">{brl(Number(t?.ticket_medio ?? 0))}</span>
              </span>
              <span>{taxaCliqueVenda}% clique→venda</span>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <TrendingUp className="h-3.5 w-3.5" />
            Top de funil
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] text-muted-foreground">Pageviews</div>
              <div className="text-2xl font-semibold tabular-nums mt-0.5">
                {loading ? "…" : (t?.pageviews ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Visitantes</div>
              <div className="text-2xl font-semibold tabular-nums mt-0.5">
                {loading ? "…" : (t?.visitantes_unicos ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Cliques em CTAs</div>
              <div className="text-2xl font-semibold tabular-nums mt-0.5">
                {loading ? "…" : (t?.cliques ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ====== KPIs secundários ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPISmall icon={Eye} tone="blue" label="Pageviews" value={(t?.pageviews ?? 0).toLocaleString("pt-BR")} loading={loading} />
        <KPISmall icon={Users} tone="violet" label="Visitantes únicos" value={(t?.visitantes_unicos ?? 0).toLocaleString("pt-BR")} loading={loading} />
        <KPISmall icon={MousePointer} tone="amber" label="Cliques" value={(t?.cliques ?? 0).toLocaleString("pt-BR")} loading={loading} />
        <KPISmall icon={Percent} tone="emerald" label="Visit→Venda" value={`${t?.taxa_conversao ?? 0}%`} loading={loading} />
      </div>

      {/* Aviso conversões snippet (se houver) */}
      {(t?.conversoes ?? 0) > 0 && (
        <Card className="p-3 border-blue-500/20 bg-blue-500/5">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Globe2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              Também há <span className="font-medium text-foreground">{t?.conversoes} conversões</span> registradas via{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-[10.5px]">data-conversion</code> no snippet (geralmente páginas de obrigado próprias), totalizando{" "}
              <span className="font-medium text-foreground">{brl(Number(t?.receita ?? 0))}</span>.
            </span>
          </div>
        </Card>
      )}

      {/* ====== Gráfico ====== */}
      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">Série diária</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tráfego (esquerda) vs vendas atribuídas (direita) — últimos {dias} dias
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>Pageviews</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500"></span>Cliques</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>Vendas</span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.serie_diaria ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="data" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, display: "none" }} />
              <Line yAxisId="left" type="monotone" dataKey="pageviews" name="Pageviews" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="cliques" name="Cliques" stroke="#a855f7" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="vendas" name="Vendas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: "#10b981" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ====== Tabelas por dimensão ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TabelaAgreg titulo="Por canal (utm_source)" linhas={data?.por_source ?? []} icon={Globe2} onClickLinha={(c) => abrirDetalhe("source", c)} />
        <TabelaAgreg titulo="Por campanha (utm_campaign)" linhas={data?.por_campaign ?? []} icon={ShoppingCart} onClickLinha={(c) => abrirDetalhe("campaign", c)} />
        <TabelaAgreg titulo="Por produto" linhas={data?.por_produto ?? []} icon={ShoppingCart} onClickLinha={(c) => abrirDetalhe("produto", c)} />
      </div>

      {/* ====== CTAs ====== */}
      <TabelaAgreg
        titulo="Por CTA (botão clicado)"
        descricao="Cliques e vendas por posição do botão na landing page. Clique em uma linha pra ver as vendas em detalhe."
        linhas={data?.por_cta ?? []}
        icon={MousePointerClick}
        onClickLinha={(c) => abrirDetalhe("cta", c)}
        largo
      />
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

const TONES: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
};

function KPISmall({
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
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${t.bg}`}>
          <Icon className={`w-4 h-4 ${t.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5 truncate">{loading ? "…" : value}</p>
        </div>
      </div>
    </Card>
  );
}

function TabelaAgreg({
  titulo,
  descricao,
  linhas,
  icon: Icon,
  onClickLinha,
  largo,
}: {
  titulo: string;
  descricao?: string;
  linhas: StatLinha[];
  icon?: React.ComponentType<{ className?: string }>;
  onClickLinha?: (chave: string) => void;
  largo?: boolean;
}) {
  const placeholders = new Set(["(direto)", "(sem campanha)", "(sem produto)", "(sem cta)"]);
  return (
    <Card className="p-5">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <h3 className="text-sm font-medium">{titulo}</h3>
        </div>
        {descricao && <p className="text-xs text-muted-foreground mt-1">{descricao}</p>}
      </div>
      <div className={largo ? "" : "max-h-[380px] overflow-auto"}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead className="text-right w-[60px]">PV</TableHead>
              <TableHead className="text-right w-[60px]">Cliq</TableHead>
              <TableHead className="text-right w-[70px]">Vendas</TableHead>
              <TableHead className="text-right w-[110px]">Receita</TableHead>
              {onClickLinha && <TableHead className="w-[24px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={onClickLinha ? 6 : 5} className="text-center text-muted-foreground py-8 text-sm">
                  Sem dados no período
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => {
              const isPlaceholder = placeholders.has(l.chave);
              const clicavel = !!onClickLinha && !isPlaceholder && l.vendas > 0;
              return (
                <TableRow
                  key={l.chave}
                  className={clicavel ? "cursor-pointer hover:bg-muted/40" : ""}
                  onClick={() => clicavel && onClickLinha?.(l.chave)}
                >
                  <TableCell
                    className={
                      "font-medium truncate max-w-[200px] " +
                      (isPlaceholder ? "text-muted-foreground italic" : "")
                    }
                    title={l.chave}
                  >
                    {l.chave}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{l.pageviews}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.cliques}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.vendas > 0 ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">{l.vendas}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.receita_real > 0 ? (
                      <span className="font-medium">{brlShort(Number(l.receita_real))}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {onClickLinha && (
                    <TableCell>
                      {clicavel && <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
