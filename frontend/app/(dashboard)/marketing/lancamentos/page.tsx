"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Lancamento {
  id: string;
  ano: number;
  mes: number;
  nome: string;
  investimento_resultado: number | null;
  receita_resultado: number | null;
  leads_total: number;
  mqls_resultado: number | null;
  cpl_resultado: number | null;
}

const FORM_INICIAL = {
  nome: "",
  ano: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  investimento_meta: "",
  investimento_resultado: "",
  leads_meta: "",
  leads_organico: "",
  leads_pago: "",
  leads_total: "",
  cpl_meta: "",
  cpl_resultado: "",
  mqls_meta: "",
  mqls_resultado: "",
  alunos_meta: "",
  alunos_resultado: "",
  receita_meta: "",
  receita_resultado: "",
  observacao: "",
};

export default function LancamentosPage() {
  const [data, setData] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const load = () => {
    setLoading(true);
    api
      .get<Lancamento[]>("/lancamentos")
      .then(setData)
      .catch(() => toast.error("Erro ao carregar"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onSubmit = async () => {
    if (!form.nome) {
      toast.error("Nome é obrigatório");
      return;
    }
    const body: Record<string, unknown> = {
      nome: form.nome,
      ano: Number(form.ano),
      mes: Number(form.mes),
      observacao: form.observacao || null,
    };
    for (const k of [
      "investimento_meta",
      "investimento_resultado",
      "leads_meta",
      "leads_organico",
      "leads_pago",
      "leads_total",
      "cpl_meta",
      "cpl_resultado",
      "mqls_meta",
      "mqls_resultado",
      "alunos_meta",
      "alunos_resultado",
      "receita_meta",
      "receita_resultado",
    ] as const) {
      const val = form[k];
      if (val !== "" && val !== undefined) {
        body[k] = Number(val);
      }
    }
    try {
      if (editing) {
        await api.patch(`/lancamentos/${editing.id}`, body);
        toast.success("Atualizado");
      } else {
        await api.post("/lancamentos", body);
        toast.success("Criado");
      }
      setOpen(false);
      setEditing(null);
      setForm(FORM_INICIAL);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir lançamento?")) return;
    try {
      await api.delete(`/lancamentos/${id}`);
      toast.success("Removido");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Imersões, workshops e campanhas com aulas/engajamento.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={<Button />}
            onClick={() => {
              setEditing(null);
              setForm(FORM_INICIAL);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Novo
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"} lançamento</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Imersão Abril"
                />
              </div>
              <div>
                <Label>Ano *</Label>
                <Input
                  type="number"
                  value={form.ano}
                  onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Mês *</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.mes}
                  onChange={(e) => setForm({ ...form, mes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Investimento Meta (R$)</Label>
                <Input
                  value={form.investimento_meta}
                  onChange={(e) => setForm({ ...form, investimento_meta: e.target.value })}
                />
              </div>
              <div>
                <Label>Investimento Resultado (R$)</Label>
                <Input
                  value={form.investimento_resultado}
                  onChange={(e) =>
                    setForm({ ...form, investimento_resultado: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Leads Meta</Label>
                <Input
                  value={form.leads_meta}
                  onChange={(e) => setForm({ ...form, leads_meta: e.target.value })}
                />
              </div>
              <div>
                <Label>Leads Total Resultado</Label>
                <Input
                  value={form.leads_total}
                  onChange={(e) => setForm({ ...form, leads_total: e.target.value })}
                />
              </div>
              <div>
                <Label>Leads Orgânicos</Label>
                <Input
                  value={form.leads_organico}
                  onChange={(e) => setForm({ ...form, leads_organico: e.target.value })}
                />
              </div>
              <div>
                <Label>Leads Pagos</Label>
                <Input
                  value={form.leads_pago}
                  onChange={(e) => setForm({ ...form, leads_pago: e.target.value })}
                />
              </div>
              <div>
                <Label>CPL Meta</Label>
                <Input
                  value={form.cpl_meta}
                  onChange={(e) => setForm({ ...form, cpl_meta: e.target.value })}
                />
              </div>
              <div>
                <Label>CPL Resultado</Label>
                <Input
                  value={form.cpl_resultado}
                  onChange={(e) => setForm({ ...form, cpl_resultado: e.target.value })}
                />
              </div>
              <div>
                <Label>MQLs Meta</Label>
                <Input
                  value={form.mqls_meta}
                  onChange={(e) => setForm({ ...form, mqls_meta: e.target.value })}
                />
              </div>
              <div>
                <Label>MQLs Resultado</Label>
                <Input
                  value={form.mqls_resultado}
                  onChange={(e) => setForm({ ...form, mqls_resultado: e.target.value })}
                />
              </div>
              <div>
                <Label>Receita Meta</Label>
                <Input
                  value={form.receita_meta}
                  onChange={(e) => setForm({ ...form, receita_meta: e.target.value })}
                />
              </div>
              <div>
                <Label>Receita Resultado</Label>
                <Input
                  value={form.receita_resultado}
                  onChange={(e) => setForm({ ...form, receita_resultado: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Observação</Label>
                <Textarea
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={onSubmit} className="mt-4">
              Salvar
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">MQLs</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento. Crie o primeiro.
                </TableCell>
              </TableRow>
            ) : (
              data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    {l.ano}-{l.mes.toString().padStart(2, "0")}
                  </TableCell>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.investimento_resultado
                      ? `R$ ${Number(l.investimento_resultado).toLocaleString("pt-BR")}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.receita_resultado
                      ? `R$ ${Number(l.receita_resultado).toLocaleString("pt-BR")}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.leads_total || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.mqls_resultado || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.cpl_resultado ? `R$ ${Number(l.cpl_resultado).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(l);
                          setForm({
                            nome: l.nome,
                            ano: l.ano,
                            mes: l.mes,
                            investimento_meta: "",
                            investimento_resultado: l.investimento_resultado?.toString() || "",
                            leads_meta: "",
                            leads_organico: "",
                            leads_pago: "",
                            leads_total: l.leads_total?.toString() || "",
                            cpl_meta: "",
                            cpl_resultado: l.cpl_resultado?.toString() || "",
                            mqls_meta: "",
                            mqls_resultado: l.mqls_resultado?.toString() || "",
                            alunos_meta: "",
                            alunos_resultado: "",
                            receita_meta: "",
                            receita_resultado: l.receita_resultado?.toString() || "",
                            observacao: "",
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(l.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
