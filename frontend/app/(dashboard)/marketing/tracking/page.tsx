"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  MousePointer,
  Target,
  DollarSign,
  Users,
  Percent,
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
}
interface StatLinha {
  chave: string;
  pageviews: number;
  cliques: number;
  conversoes: number;
  receita: number;
}
interface StatSerie {
  data: string;
  pageviews: number;
  cliques: number;
  conversoes: number;
  receita: number;
}
interface StatsResponse {
  totais: StatTotais;
  por_source: StatLinha[];
  por_campaign: StatLinha[];
  por_produto: StatLinha[];
  serie_diaria: StatSerie[];
}

const PERIODOS = [
  { dias: 7, label: "7d" },
  { dias: 30, label: "30d" },
  { dias: 90, label: "90d" },
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function TrackingPage() {
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

  return (
    <div className="space-y-6">
      {/* Header + período */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tracking</h2>
          <p className="text-sm text-muted-foreground">
            Pageviews, cliques e conversões das landing pages
          </p>
        </div>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI icon={Eye} label="Pageviews" value={t?.pageviews ?? 0} loading={loading} />
        <KPI icon={Users} label="Visitantes únicos" value={t?.visitantes_unicos ?? 0} loading={loading} />
        <KPI icon={MousePointer} label="Cliques" value={t?.cliques ?? 0} loading={loading} />
        <KPI icon={Target} label="Conversões" value={t?.conversoes ?? 0} loading={loading} />
        <KPI icon={Percent} label="Taxa conv." value={`${t?.taxa_conversao ?? 0}%`} loading={loading} />
        <KPI icon={DollarSign} label="Receita" value={brl(Number(t?.receita ?? 0))} loading={loading} />
      </div>

      {/* Gráfico série */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium">Série diária</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.serie_diaria ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="data" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="pageviews" name="Pageviews" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cliques" name="Cliques" stroke="#a855f7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="conversoes" name="Conversões" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabelas: source, campaign, produto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TabelaAgreg titulo="Por utm_source" linhas={data?.por_source ?? []} />
        <TabelaAgreg titulo="Por utm_campaign" linhas={data?.por_campaign ?? []} />
        <TabelaAgreg titulo="Por produto" linhas={data?.por_produto ?? []} />
      </div>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  loading: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {loading ? "…" : typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
    </Card>
  );
}

function TabelaAgreg({ titulo, linhas }: { titulo: string; linhas: StatLinha[] }) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-medium">{titulo}</h3>
      <div className="max-h-[360px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead className="text-right">PV</TableHead>
              <TableHead className="text-right">Cliq</TableHead>
              <TableHead className="text-right">Conv</TableHead>
              <TableHead className="text-right">Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Sem dados
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => (
              <TableRow key={l.chave}>
                <TableCell className="font-medium truncate max-w-[180px]" title={l.chave}>
                  {l.chave}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.pageviews}</TableCell>
                <TableCell className="text-right tabular-nums">{l.cliques}</TableCell>
                <TableCell className="text-right tabular-nums">{l.conversoes}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(Number(l.receita))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
