"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

interface Intercambio {
  id: string;
  nome_aluno: string;
  valor: number;
  data_venda: string;
  observacao: string | null;
}

export default function IntercambioPage() {
  const [data, setData] = useState<Intercambio[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome_aluno: "",
    valor: "",
    data_venda: "",
    observacao: "",
  });

  const load = () => {
    setLoading(true);
    api
      .get<Intercambio[]>("/intercambio")
      .then(setData)
      .catch(() => toast.error("Erro ao carregar"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onSubmit = async () => {
    if (!form.nome_aluno || !form.valor || !form.data_venda) {
      toast.error("Preencha nome, valor e data");
      return;
    }
    try {
      await api.post("/intercambio", {
        nome_aluno: form.nome_aluno,
        valor: Number(form.valor),
        data_venda: form.data_venda,
        observacao: form.observacao || null,
      });
      toast.success("Adicionado");
      setOpen(false);
      setForm({ nome_aluno: "", valor: "", data_venda: "", observacao: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir registro?")) return;
    try {
      await api.delete(`/intercambio/${id}`);
      toast.success("Removido");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const total = data.reduce((s, i) => s + Number(i.valor), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intercâmbio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receita complementar de programas de intercâmbio.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="w-4 h-4 mr-2" /> Novo registro
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo registro de Intercâmbio</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome do aluno *</Label>
                <Input
                  value={form.nome_aluno}
                  onChange={(e) => setForm({ ...form, nome_aluno: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data da venda *</Label>
                  <Input
                    type="date"
                    value={form.data_venda}
                    onChange={(e) => setForm({ ...form, data_venda: e.target.value })}
                  />
                </div>
              </div>
              <div>
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

      <Card className="p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Total acumulado
        </p>
        <p className="text-3xl font-bold tabular-nums">
          R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{data.length} registros</p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum registro.
                </TableCell>
              </TableRow>
            ) : (
              data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.data_venda}</TableCell>
                  <TableCell>{i.nome_aluno}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    R${" "}
                    {Number(i.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.observacao || "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(i.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    </Button>
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
