"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  RefreshCw,
  Users,
  DollarSign,
  TrendingUp,
  Target,
  MousePointerClick,
  Loader2,
  Edit,
  Plus,
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
import { ChartCard } from "@/components/dashboard/chart-card";
import { FunilCone3D } from "@/components/overview/funil-cone-3d";
import { ReceitaCard } from "@/components/overview/receita-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { EventoDialog } from "./evento-dialog";
import type {
  FrenteDashboardOut,
  DashboardKPI,
  FrentePeriodoOut,
} from "@/lib/types/marketing-frentes";
import {
  formatarKPI,
  formatarMoeda,
  formatarNumero,
  parseDecimal,
} from "@/lib/types/marketing-frentes";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;
const ANOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const KPI_CONFIG: Record<string, { icone: LucideIcon; ordem: number; rotulo?: string }> = {
  "Inscritos":           { icone: Users,             ordem: 1 },
  "Receita":             { icone: DollarSign,        ordem: 2 },
  "Ticket Médio":        { icone: TrendingUp,        ordem: 3 },
  "Investimento em Ads": { icone: Target,            ordem: 4, rotulo: "Investido em Ads" },
  "CPA":                 { icone: MousePointerClick, ordem: 5 },
  "Eventos Ativos":      { icone: Calendar,          ordem: 6 },
};

function metaComparativo(kpi: DashboardKPI): string | undefined {
  if (!kpi.meta) return undefined;
  if (kpi.formato === "moeda") return `Meta: ${formatarMoeda(kpi.meta)}`;
  return `Meta: ${parseDecimal(kpi.meta).toLocaleString("pt-BR")}`;
}

function kpiPorLabel(
  kpis: DashboardKPI[] | undefined,
  label: string,
): DashboardKPI | undefined {
  return kpis?.find((k) => k.label === label);
}

function badgeAtingimento(real: number, meta: number) {
  if (meta <= 0) return <Badge variant="outline">—</Badge>;
  const pct = real / meta;
  const texto = `${(pct * 100).toFixed(0)}%`;
  if (pct >= 0.8)
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        {texto}
      </Badge>
    );
  if (pct >= 0.4)
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        {texto}
      </Badge>
    );
  return (
    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
      {texto}
    </Badge>
  );
}

export default function CongressosPage() {
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);
  const [data, setData] = useState<FrenteDashboardOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<FrentePeriodoOut | null>(
    null,
  );

  function abrirCriar() {
    setEventoEditando(null);
    setDialogOpen(true);
  }

  function abrirEditar(ev: FrentePeriodoOut) {
    setEventoEditando(ev);
    setDialogOpen(true);
  }

  function onSaved() {
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    api
      .get<FrenteDashboardOut>(
        `/frente-periodo/dashboard/congresso?ano=${ano}&mes=${mes}`,
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

  const kpisOrdenados = (data?.kpis ?? [])
    .filter((k) => KPI_CONFIG[k.label])
    .sort((a, b) => KPI_CONFIG[a.label].ordem - KPI_CONFIG[b.label].ordem);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center shadow-md">
            <Calendar className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Congressos</h1>
            <p className="text-sm text-muted-foreground">
              Funil de mídia paga, metas e resultados por evento
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
            className="bg-violet-600 hover:bg-violet-700 text-white"
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <KPICard key={i} label="" value="" loading index={i} />
            ))
          : kpisOrdenados.map((kpi, i) => {
              const cfg = KPI_CONFIG[kpi.label];
              const Icone = cfg.icone;
              return (
                <KPICard
                  key={kpi.label}
                  label={cfg.rotulo ?? kpi.label}
                  value={formatarKPI(kpi)}
                  icon={Icone}
                  previousValue={metaComparativo(kpi)}
                  index={i}
                />
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Funil de Mídia Paga"
          description="Alcance → Cliques → Visitantes LP → Checkout → Compras"
          loading={loading}
          className="lg:col-span-2"
        >
          <FunilCone3D
            etapas={(data?.funil ?? []).map((e) => ({
              nome: e.nome,
              valor: parseDecimal(e.realizado),
              meta: e.meta != null ? parseDecimal(e.meta) : null,
            }))}
          />
        </ChartCard>

        {loading ? (
          <Skeleton className="h-[200px] w-full rounded-2xl" />
        ) : (
          (() => {
            const kpiReceita = kpiPorLabel(data?.kpis, "Receita");
            return (
              <ReceitaCard
                label="Receita"
                valor={formatarMoeda(kpiReceita?.valor)}
                meta={
                  kpiReceita?.meta
                    ? formatarMoeda(kpiReceita.meta)
                    : undefined
                }
                descricao="Receita total dos Congressos no período"
                icon={DollarSign}
                gradient="bg-gradient-to-br from-violet-600 to-purple-800"
                index={0}
              />
            );
          })()
        )}
      </div>

      <ChartCard
        title="Eventos no Período"
        description={`${data?.eventos.length ?? 0} eventos ativos em ${MESES[mes - 1]}/${ano}`}
        loading={loading}
        actions={
          <Button
            size="sm"
            onClick={abrirCriar}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" /> Novo Evento
          </Button>
        }
      >
        {data && data.eventos.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">
              Nenhum evento cadastrado em {MESES[mes - 1]}/{ano}
            </p>
            <p className="text-sm mt-1">
              Clique em &quot;Novo Evento&quot; para começar
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead className="text-center">Inscritos</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Investido</TableHead>
                  <TableHead className="text-center">Compras</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.eventos ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell
                      className="max-w-[320px] truncate font-medium"
                      title={e.evento_nome}
                    >
                      {e.evento_nome}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold tabular-nums">
                          {formatarNumero(e.inscritos)} /{" "}
                          {formatarNumero(e.meta_inscritos)}
                        </span>
                        {badgeAtingimento(e.inscritos, e.meta_inscritos)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-semibold">
                        {formatarMoeda(e.receita)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Meta: {formatarMoeda(e.meta_receita)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.ticket_medio ? formatarMoeda(e.ticket_medio) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarMoeda(e.investimento_ads)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {formatarNumero(e.compras)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirEditar(e)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ChartCard>

      <EventoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        evento={eventoEditando}
        ano={ano}
        mes={mes}
        onSaved={onSaved}
      />
    </div>
  );
}
