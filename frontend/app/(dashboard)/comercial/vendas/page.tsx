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
interface Venda {
  id: string; produto_id: string; aluno_nome: string; aluno_email: string | null;
  data_venda: string; valor: string; prazo_recebimento_meses: number | null;
  a_vista: boolean; vendedor: string | null; observacao: string | null;
}
interface TicketMedio {
  produto_id: string; ano: number; mes: number;
  qtd_vendas: number; receita_total: string; ticket_medio: string;
  prazo_medio: number | null; pct_a_vista: number | null;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const brl = (v: string | number | null) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) => v == null ? "—" : (v * 100).toFixed(1) + "%";

export default function VendasPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [tickets, setTickets] = useState<TicketMedio[]>([]);
  const [filtroProduto, setFiltroProduto] = useState("todos");
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    produto_id: "", aluno_nome: "", aluno_email: "",
    data_venda: new Date().toISOString().slice(0, 10),
    valor: "", prazo_recebimento_meses: "", a_vista: false,
    vendedor: "", observacao: "",
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
      const [v, t] = await Promise.all([
        api.get<Venda[]>(`/comercial/vendas?${params}`),
        api.get<TicketMedio[]>(`/comercial/dashboard/ticket-medio?ano=${ano}&mes=${mes}` +
          (filtroProduto !== "todos" ? `&produto_id=${filtroProduto}` : "")),
      ]);
      setVendas(v);
      setTickets(t);
    } catch {
      toast.error("Erro ao carregar vendas");
    }
  }, [ano, mes, filtroProduto]);

  useEffect(() => {
    api.get<Produto[]>("/produtos?ativo=true").then(setProdutos).catch(() => toast.error("Erro ao carregar produtos"));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const agregado = tickets.reduce(
    (acc, t) => ({
      qtd: acc.qtd + t.qtd_vendas,
      receita: acc.receita + Number(t.receita_total),
      ticket_sum: acc.ticket_sum + Number(t.ticket_medio) * t.qtd_vendas,
      prazo_sum: acc.prazo_sum + (t.prazo_medio ?? 0) * t.qtd_vendas,
      a_vista_sum: acc.a_vista_sum + (t.pct_a_vista ?? 0) * t.qtd_vendas,
    }),
    { qtd: 0, receita: 0, ticket_sum: 0, prazo_sum: 0, a_vista_sum: 0 },
  );
  const ticketMedio = agregado.qtd > 0 ? agregado.ticket_sum / agregado.qtd : null;
  const prazoMedio = agregado.qtd > 0 ? agregado.prazo_sum / agregado.qtd : null;
  const pctAVista = agregado.qtd > 0 ? agregado.a_vista_sum / agregado.qtd : null;

  function nomeProduto(id: string) {
    return produtos.find((p) => p.id === id)?.nome ?? "—";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/comercial/vendas", {
        produto_id: form.produto_id,
        aluno_nome: form.aluno_nome,
        aluno_email: form.aluno_email || null,
        data_venda: form.data_venda,
        valor: Number(form.valor),
        prazo_recebimento_meses: form.prazo_recebimento_meses ? Number(form.prazo_recebimento_meses) : null,
        a_vista: form.a_vista,
        vendedor: form.vendedor || null,
        observacao: form.observacao || null,
      });
      toast.success("Venda criada");
      setOpen(false);
      setForm({
        produto_id: "", aluno_nome: "", aluno_email: "",
        data_venda: new Date().toISOString().slice(0, 10),
        valor: "", prazo_recebimento_meses: "", a_vista: false,
        vendedor: "", observacao: "",
      });
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar venda");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Vendas</h1>
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
            <DialogTrigger render={<Button />}>Nova Venda</DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Venda</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label>Produto</Label>
                  <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Aluno</Label>
                  <Input required value={form.aluno_nome} onChange={(e) => setForm({...form, aluno_nome: e.target.value})} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.aluno_email} onChange={(e) => setForm({...form, aluno_email: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data</Label>
                    <Input type="date" required value={form.data_venda} onChange={(e) => setForm({...form, data_venda: e.target.value})} />
                  </div>
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" required value={form.valor} onChange={(e) => setForm({...form, valor: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Prazo (meses)</Label>
                    <Input type="number" value={form.prazo_recebimento_meses} onChange={(e) => setForm({...form, prazo_recebimento_meses: e.target.value})} />
                  </div>
                  <div>
                    <Label>Vendedor</Label>
                    <Input value={form.vendedor} onChange={(e) => setForm({...form, vendedor: e.target.value})} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.a_vista} onChange={(e) => setForm({...form, a_vista: e.target.checked})} />
                  À vista (≤ 4 meses)
                </label>
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
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold">{ticketMedio != null ? brl(ticketMedio) : "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">{agregado.qtd} venda(s)</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">% À Vista</p>
          <p className="text-2xl font-bold">{pct(pctAVista)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Prazo Médio</p>
          <p className="text-2xl font-bold">{prazoMedio != null ? prazoMedio.toFixed(1) + " meses" : "—"}</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>À Vista</TableHead>
              <TableHead>Vendedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendas.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nenhuma venda no período selecionado
              </TableCell></TableRow>
            ) : vendas.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{new Date(v.data_venda).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{v.aluno_nome}</TableCell>
                <TableCell>{nomeProduto(v.produto_id)}</TableCell>
                <TableCell className="text-right">{brl(v.valor)}</TableCell>
                <TableCell>{v.prazo_recebimento_meses ? v.prazo_recebimento_meses + "m" : "—"}</TableCell>
                <TableCell>{v.a_vista ? <Badge>Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                <TableCell>{v.vendedor || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
