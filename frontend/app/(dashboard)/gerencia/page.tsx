"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  RefreshCw,
  Settings2,
  UserX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { GerenciaResponsavelBars } from "@/components/charts/gerencia-responsavel-bars";
import { GerenciaTendencia } from "@/components/charts/gerencia-tendencia";
import {
  fmtData,
  gerencia,
  nomesResponsaveis,
  type Board,
  type PorResponsavel,
  type Projeto,
  type Resumo,
  type TendenciaPonto,
} from "@/lib/gerencia";

const TODOS = "__todos__";

type Kpi = {
  label: string;
  valor: number;
  hint: string;
  icon: typeof ListTodo;
  tone: "muted" | "primary" | "destructive" | "success";
};

function KpiCard({ kpi, loading }: { kpi: Kpi; loading: boolean }) {
  const Icon = kpi.icon;
  const toneText: Record<Kpi["tone"], string> = {
    muted: "text-muted-foreground",
    primary: "text-primary",
    destructive: "text-destructive",
    success: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-muted-foreground">{kpi.label}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1.5" />
            ) : (
              <p className="text-3xl font-semibold tracking-tight mt-1 tabular-nums">
                {kpi.valor.toLocaleString("pt-BR")}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/80 mt-1">{kpi.hint}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <Icon className={`w-[18px] h-[18px] ${toneText[kpi.tone]}`} strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GerenciaPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [sel, setSel] = useState<string>(TODOS);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [atrasadas, setAtrasadas] = useState<Projeto[]>([]);
  const [porResp, setPorResp] = useState<PorResponsavel[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const boardId = sel === TODOS ? null : sel;

  useEffect(() => {
    gerencia
      .boards({ incluido: true, ativo: true })
      .then(setBoards)
      .catch(() => toast.error("Falha ao carregar boards"));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, a, p, t] = await Promise.all([
        gerencia.resumo(boardId),
        gerencia.atrasadas(boardId, 100),
        gerencia.porResponsavel(boardId),
        gerencia.tendencia(boardId),
      ]);
      setResumo(r);
      setAtrasadas(a);
      setPorResp(p);
      setTendencia(t);
    } catch {
      toast.error("Falha ao carregar dados de gerência");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function sincronizar() {
    setSyncing(true);
    const alvo = boardId ? "board selecionado" : "todos os boards";
    toast.info(`Sincronizando ${alvo}…`);
    try {
      const r = await gerencia.sync(boardId);
      toast.success(
        `Sync concluído: ${r.boards_ok}/${r.boards} boards, ${r.total_itens.toLocaleString("pt-BR")} itens`,
      );
      await carregar();
    } catch {
      toast.error("Falha ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const kpis: Kpi[] = [
    { label: "Em andamento", valor: resumo?.em_andamento ?? 0, hint: "tarefas ativas", icon: Activity, tone: "primary" },
    { label: "Atrasadas", valor: resumo?.atrasadas ?? 0, hint: "prazo vencido, não concluídas", icon: AlertTriangle, tone: "destructive" },
    { label: "Concluídas", valor: resumo?.concluidas ?? 0, hint: "finalizadas", icon: CheckCircle2, tone: "success" },
    { label: "Sem responsável", valor: resumo?.sem_responsavel ?? 0, hint: "ninguém atribuído", icon: UserX, tone: "muted" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* barra de controle */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sel} onValueChange={(v) => setSel(v ?? TODOS)}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecionar board" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os boards ({boards.length})</SelectItem>
            {boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-sm text-muted-foreground">
          {resumo ? (
            <>
              <span className="font-medium text-foreground tabular-nums">{resumo.total.toLocaleString("pt-BR")}</span>{" "}
              tarefas · {resumo.boards} board{resumo.boards === 1 ? "" : "s"}
            </>
          ) : (
            "—"
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/gerencia/boards" />}>
            <Settings2 className="w-4 h-4" />
            Boards
          </Button>
          <Button size="sm" onClick={sincronizar} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} kpi={k} loading={loading && !resumo} />
        ))}
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Carga por responsável</CardTitle>
          </CardHeader>
          <CardContent>
            <GerenciaResponsavelBars itens={porResp} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendência no tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <GerenciaTendencia pontos={tendencia} />
          </CardContent>
        </Card>
      </div>

      {/* atrasadas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tarefas atrasadas</CardTitle>
          <Badge variant="outline" className="text-destructive border-destructive/30">
            {atrasadas.length}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px] text-right">Atraso</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-[110px]">Prazo</TableHead>
                  <TableHead>Board</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && atrasadas.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : atrasadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma tarefa atrasada 🎉
                    </TableCell>
                  </TableRow>
                ) : (
                  atrasadas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium text-destructive">{t.dias_atraso}d</span>
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate" title={t.nome ?? ""}>
                        {t.nome || "—"}
                        {t.status && (
                          <span className="ml-2 text-[11px] text-muted-foreground">· {t.status}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[180px] truncate">
                        {nomesResponsaveis(t.responsaveis)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{fmtData(t.prazo_fim)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={t.board_nome}>
                        {t.board_nome}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
