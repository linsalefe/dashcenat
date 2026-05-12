"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  FrentePeriodoOut,
  FrentePeriodoUpdate,
  FrentePeriodoCreate,
} from "@/lib/types/marketing-frentes";
import {
  parseDecimal,
  parseInputDecimal,
  parseInputInteiro,
} from "@/lib/types/marketing-frentes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma?: FrentePeriodoOut | null;
  ano: number;
  mes: number;
  onSaved: () => void;
}

interface FormState {
  evento_nome: string;
  meta_leads: string;
  leads: string;
  meta_ligacao: string;
  ligacao: string;
  meta_sql: string;
  sql_reuniao: string;
  meta_reuniao: string;
  reuniao_realizada: string;
  meta_vendas: string;
  vendas: string;
  meta_receita: string;
  receita: string;
  ticket_medio: string;
  no_show_pct: string;
}

const FORM_INICIAL: FormState = {
  evento_nome: "",
  meta_leads: "0", leads: "0",
  meta_ligacao: "0", ligacao: "0",
  meta_sql: "0", sql_reuniao: "0",
  meta_reuniao: "0", reuniao_realizada: "0",
  meta_vendas: "0", vendas: "0",
  meta_receita: "0", receita: "0",
  ticket_medio: "",
  no_show_pct: "",
};

const FUNIL_ROWS: {
  label: string;
  meta: keyof FormState;
  realizado: keyof FormState;
}[] = [
  { label: "Leads",   meta: "meta_leads",   realizado: "leads" },
  { label: "Ligação", meta: "meta_ligacao", realizado: "ligacao" },
  { label: "SQL",     meta: "meta_sql",     realizado: "sql_reuniao" },
  { label: "Reunião", meta: "meta_reuniao", realizado: "reuniao_realizada" },
  { label: "Vendas",  meta: "meta_vendas",  realizado: "vendas" },
];

export function TurmaDialog({
  open,
  onOpenChange,
  turma,
  ano,
  mes,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const isEdit = !!turma;

  useEffect(() => {
    if (turma) {
      setForm({
        evento_nome: turma.evento_nome,
        meta_leads: String(turma.meta_leads ?? 0),
        leads: String(turma.leads ?? 0),
        meta_ligacao: String(turma.meta_ligacao ?? 0),
        ligacao: String(turma.ligacao ?? 0),
        meta_sql: String(turma.meta_sql ?? 0),
        sql_reuniao: String(turma.sql_reuniao ?? 0),
        meta_reuniao: String(turma.meta_reuniao ?? 0),
        reuniao_realizada: String(turma.reuniao_realizada ?? 0),
        meta_vendas: String(turma.meta_vendas ?? 0),
        vendas: String(turma.vendas ?? 0),
        meta_receita: String(parseDecimal(turma.meta_receita)),
        receita: String(parseDecimal(turma.receita)),
        ticket_medio: turma.ticket_medio
          ? String(parseDecimal(turma.ticket_medio))
          : "",
        no_show_pct: turma.no_show_pct
          ? String(parseDecimal(turma.no_show_pct))
          : "",
      });
    } else {
      setForm(FORM_INICIAL);
    }
  }, [turma, open]);

  function setField<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.evento_nome.trim()) {
      toast.error("Nome da turma é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const numerico = {
        meta_leads: parseInputInteiro(form.meta_leads) ?? 0,
        leads: parseInputInteiro(form.leads) ?? 0,
        meta_ligacao: parseInputInteiro(form.meta_ligacao) ?? 0,
        ligacao: parseInputInteiro(form.ligacao) ?? 0,
        meta_sql: parseInputInteiro(form.meta_sql) ?? 0,
        sql_reuniao: parseInputInteiro(form.sql_reuniao) ?? 0,
        meta_reuniao: parseInputInteiro(form.meta_reuniao) ?? 0,
        reuniao_realizada: parseInputInteiro(form.reuniao_realizada) ?? 0,
        meta_vendas: parseInputInteiro(form.meta_vendas) ?? 0,
        vendas: parseInputInteiro(form.vendas) ?? 0,
        meta_inscritos: parseInputInteiro(form.meta_vendas) ?? 0,
        inscritos: parseInputInteiro(form.vendas) ?? 0,
        meta_receita: parseInputDecimal(form.meta_receita) ?? 0,
        receita: parseInputDecimal(form.receita) ?? 0,
        ticket_medio: parseInputDecimal(form.ticket_medio),
        no_show_pct: parseInputDecimal(form.no_show_pct),
      };

      if (isEdit && turma) {
        const payload: FrentePeriodoUpdate = numerico;
        await api.patch(`/frente-periodo/${turma.id}`, payload);
        toast.success("Turma atualizada");
      } else {
        const payload: FrentePeriodoCreate = {
          frente: "pos",
          ano,
          mes,
          evento_nome: form.evento_nome.trim(),
          ...numerico,
        };
        await api.post("/frente-periodo", payload);
        toast.success("Turma criada");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao salvar: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Turma" : "Nova Turma de Pós-Graduação"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Atualizar ${turma?.evento_nome} em ${mes}/${ano}`
              : `Cadastrar nova turma em ${mes}/${ano}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="evento_nome">Nome da Turma *</Label>
            <Input
              id="evento_nome"
              value={form.evento_nome}
              onChange={(e) => setField("evento_nome", e.target.value)}
              disabled={isEdit}
              placeholder="Ex: Especialização em Psicologia Hospitalar"
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Nome não pode ser alterado. Para trocar, exclua e crie novo.
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Funil Comercial</h4>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 mb-2 text-xs text-muted-foreground font-medium">
              <span>Meta</span>
              <span className="w-16 text-center">Etapa</span>
              <span>Realizado</span>
            </div>

            {FUNIL_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2"
              >
                <Input
                  type="number"
                  min="0"
                  value={form[row.meta]}
                  onChange={(e) => setField(row.meta, e.target.value)}
                />
                <span className="text-xs font-medium text-muted-foreground w-16 text-center">
                  {row.label}
                </span>
                <Input
                  type="number"
                  min="0"
                  value={form[row.realizado]}
                  onChange={(e) => setField(row.realizado, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Receita & Financeiro</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="meta_receita">Meta de Receita (R$)</Label>
                <Input
                  id="meta_receita"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.meta_receita}
                  onChange={(e) => setField("meta_receita", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receita">Receita Realizada (R$)</Label>
                <Input
                  id="receita"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.receita}
                  onChange={(e) => setField("receita", e.target.value)}
                />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="ticket_medio">Ticket Médio (R$)</Label>
                <Input
                  id="ticket_medio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ticket_medio}
                  onChange={(e) => setField("ticket_medio", e.target.value)}
                  placeholder="Vazio = não calcular"
                />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="no_show_pct">
                  % No Show (0,00 a 1,00 — ex: 0,60 = 60%)
                </Label>
                <Input
                  id="no_show_pct"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.no_show_pct}
                  onChange={(e) => setField("no_show_pct", e.target.value)}
                  placeholder="Vazio = sem dado"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Salvar Alterações" : "Criar Turma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
