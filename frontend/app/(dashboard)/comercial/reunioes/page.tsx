"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

interface Produto { id: string; nome: string; }
interface Reuniao {
  id: string; produto_id: string; aluno_nome: string | null; aluno_email: string | null;
  vendedor: string | null; data_agendada: string; data_realizada: string | null;
  no_show: boolean; resultou_em_venda: boolean; observacao: string | null;
}
interface NoShowStats {
  produto_id: string; ano: number; mes: number;
  reunioes_agendadas: number; no_shows: number; realizadas: number; vendas_via_reuniao: number;
  taxa_no_show: number | null; taxa_reuniao_venda: number | null;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const pct = (v: number | null) => v == null ? "—" : (v * 100).toFixed(1) + "%";

function statusOf(r: Reuniao): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (r.resultou_em_venda) return { label: "Venda", variant: "default" };
  if (r.no_show) return { label: "No-show", variant: "destructive" };
  if (r.data_realizada) return { label: "Realizada", variant: "secondary" };
  return { label: "Agendada", variant: "outline" };
}

export default function ReunioesPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [stats, setStats] = useState<NoShowStats[]>([]);
  const [filtroProduto, setFiltroProduto] = useState("todos");
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    produto_id: "", aluno_nome: "", aluno_email: "", vendedor: "",
    data_agendada: new Date().toISOString().slice(0, 10),
    observacao: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    const inicio = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
    const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);
    params.set("data_inicio", inicio);
    params.set("data_fim", fim);
    if (filtroProduto !== "todos") params.set("produto_id", filtroProduto);
    try {
      const [r, s] = await Promise.all([
        api.get<Reuniao[]>(`/comercial/reunioes?${params}`),
        api.get<NoShowStats[]>(`/comercial/dashboard/no-show?ano=${ano}&mes=${mes}` +
          (filtroProduto !== "todos" ? `&produto_id=${filtroProduto}` : "")),
      ]);
      setReunioes(r);
      setStats(s);
    } catch {
      toast.error("Erro ao carregar reuniões");
    }
  }, [ano, mes, filtroProduto]);

  useEffect(() => {
    api.get<Produto[]>("/produtos?ativo=true").then(setProdutos).catch(() => toast.error("Erro ao carregar produtos"));
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const agg = stats.reduce(
    (acc, s) => ({
      agendadas: acc.agendadas + s.reunioes_agendadas,
      realizadas: acc.realizadas + s.realizadas,
      no_shows: acc.no_shows + s.no_shows,
      vendas: acc.vendas + s.vendas_via_reuniao,
    }),
    { agendadas: 0, realizadas: 0, no_shows: 0, vendas: 0 },
  );
  const taxaNoShow = agg.agendadas > 0 ? agg.no_shows / agg.agendadas : null;
  const taxaVenda = agg.realizadas > 0 ? agg.vendas / agg.realizadas : null;

  function nomeProduto(id: string) { return produtos.find((p) => p.id === id)?.nome ?? "—"; }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/comercial/reunioes", {
        produto_id: form.produto_id,
        aluno_nome: form.aluno_nome || null,
        aluno_email: form.aluno_email || null,
        vendedor: form.vendedor || null,
        data_agendada: form.data_agendada,
        observacao: form.observacao || null,
      });
      toast.success("Reunião criada");
      setOpen(false);
      setForm({ produto_id: "", aluno_nome: "", aluno_email: "", vendedor: "",
        data_agendada: new Date().toISOString().slice(0, 10), observacao: "" });
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchStatus(id: string, body: Partial<Reuniao>) {
    try {
      await api.patch(`/comercial/reunioes/${id}`, body);
      toast.success("Status atualizado");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reuniões</h1>
        <div className="flex gap-2 items-center">
          <Select value={filtroProduto} onValueChange={(v) => setFiltroProduto(v ?? "todos")}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v ?? MES_ATUAL))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v ?? ANO_ATUAL))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[ANO_ATUAL-1, ANO_ATUAL, ANO_ATUAL+1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>Nova Reunião</DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <Label>Produto</Label>
                  <Select value={form.produto_id} onValueChange={(v) => setForm({...form, produto_id: v ?? ""})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Aluno</Label>
                  <Input value={form.aluno_nome} onChange={(e) => setForm({...form, aluno_nome: e.target.value})} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.aluno_email} onChange={(e) => setForm({...form, aluno_email: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data Agendada</Label>
                    <Input type="date" required value={form.data_agendada} onChange={(e) => setForm({...form, data_agendada: e.target.value})} />
                  </div>
                  <div>
                    <Label>Vendedor</Label>
                    <Input value={form.vendedor} onChange={(e) => setForm({...form, vendedor: e.target.value})} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !form.produto_id}>
                  {submitting ? "Salvando..." : "Criar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Reuniões Agendadas</p>
          <p className="text-2xl font-bold">{agg.agendadas}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {agg.realizadas} realizada(s) · {agg.vendas} venda(s)
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">% No-Show</p>
          <p className="text-2xl font-bold">{pct(taxaNoShow)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Taxa Reunião → Venda</p>
          <p className="text-2xl font-bold">{pct(taxaVenda)}</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data Agendada</TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reunioes.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhuma reunião no período
              </TableCell></TableRow>
            ) : reunioes.map((r) => {
              const s = statusOf(r);
              const isAgendada = !r.data_realizada && !r.no_show && !r.resultou_em_venda;
              const isRealizada = !!r.data_realizada && !r.resultou_em_venda;
              return (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.data_agendada).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="font-medium">{r.aluno_nome || "—"}</TableCell>
                  <TableCell>{nomeProduto(r.produto_id)}</TableCell>
                  <TableCell>{r.vendedor || "—"}</TableCell>
                  <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    {isAgendada && (
                      <>
                        <Button variant="ghost" size="sm"
                          onClick={() => patchStatus(r.id, { data_realizada: new Date().toISOString().slice(0, 10) })}>
                          Realizada
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => patchStatus(r.id, { no_show: true })}>
                          No-show
                        </Button>
                      </>
                    )}
                    {isRealizada && (
                      <Button variant="ghost" size="sm"
                        onClick={() => patchStatus(r.id, { resultou_em_venda: true })}>
                        Marcar Venda
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
