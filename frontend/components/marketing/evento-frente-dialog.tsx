"use client";

import { useState, useEffect } from "react";
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
  Frente,
  FrentePeriodoOut,
  FrentePeriodoCreate,
  FrentePeriodoUpdate,
} from "@/lib/types/marketing-frentes";
import {
  parseDecimal,
  parseInputDecimal,
  parseInputInteiro,
} from "@/lib/types/marketing-frentes";
import { TEMA_BOTAO, type CorBotao } from "./tema-frente";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: FrentePeriodoOut | null;
  ano: number;
  mes: number;
  frente: Frente;
  labelSingular: string;
  corBotao: CorBotao;
  onSaved: () => void;
}

interface FormState {
  evento_nome: string;
  investimento_ads: string;
  alcance: string;
  cliques: string;
  visitantes_lp: string;
  checkout: string;
  compras: string;
  meta_inscritos: string;
  inscritos: string;
  meta_receita: string;
  receita: string;
  ticket_medio: string;
}

const FORM_INICIAL: FormState = {
  evento_nome: "",
  investimento_ads: "0",
  alcance: "0",
  cliques: "0",
  visitantes_lp: "0",
  checkout: "0",
  compras: "0",
  meta_inscritos: "0",
  inscritos: "0",
  meta_receita: "0",
  receita: "0",
  ticket_medio: "",
};

export function EventoFrenteDialog({
  open,
  onOpenChange,
  evento,
  ano,
  mes,
  frente,
  labelSingular,
  corBotao,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const isEdit = !!evento;
  const labelLower = labelSingular.toLowerCase();

  useEffect(() => {
    if (evento) {
      setForm({
        evento_nome: evento.evento_nome,
        investimento_ads: String(parseDecimal(evento.investimento_ads)),
        alcance: String(evento.alcance ?? 0),
        cliques: String(evento.cliques ?? 0),
        visitantes_lp: String(evento.visitantes_lp ?? 0),
        checkout: String(evento.checkout ?? 0),
        compras: String(evento.compras ?? 0),
        meta_inscritos: String(evento.meta_inscritos ?? 0),
        inscritos: String(evento.inscritos ?? 0),
        meta_receita: String(parseDecimal(evento.meta_receita)),
        receita: String(parseDecimal(evento.receita)),
        ticket_medio: evento.ticket_medio
          ? String(parseDecimal(evento.ticket_medio))
          : "",
      });
    } else {
      setForm(FORM_INICIAL);
    }
  }, [evento, open]);

  function setField<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.evento_nome.trim()) {
      toast.error(`Nome do ${labelLower} é obrigatório`);
      return;
    }
    setSaving(true);
    try {
      const numerico = {
        investimento_ads: parseInputDecimal(form.investimento_ads) ?? 0,
        alcance: parseInputInteiro(form.alcance) ?? 0,
        cliques: parseInputInteiro(form.cliques) ?? 0,
        visitantes_lp: parseInputInteiro(form.visitantes_lp) ?? 0,
        checkout: parseInputInteiro(form.checkout) ?? 0,
        compras: parseInputInteiro(form.compras) ?? 0,
        meta_inscritos: parseInputInteiro(form.meta_inscritos) ?? 0,
        inscritos: parseInputInteiro(form.inscritos) ?? 0,
        meta_receita: parseInputDecimal(form.meta_receita) ?? 0,
        receita: parseInputDecimal(form.receita) ?? 0,
        ticket_medio: parseInputDecimal(form.ticket_medio),
      };

      if (isEdit && evento) {
        const payload: FrentePeriodoUpdate = numerico;
        await api.patch(`/frente-periodo/${evento.id}`, payload);
        toast.success(`${labelSingular} atualizado`);
      } else {
        const payload: FrentePeriodoCreate = {
          frente,
          ano,
          mes,
          evento_nome: form.evento_nome.trim(),
          ...numerico,
        };
        await api.post("/frente-periodo", payload);
        toast.success(`${labelSingular} criado`);
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
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar ${labelSingular}` : `Novo ${labelSingular}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Atualizar dados de ${evento?.evento_nome} em ${mes}/${ano}`
              : `Cadastrar novo ${labelLower} em ${mes}/${ano}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="evento_nome">Nome do {labelSingular} *</Label>
            <Input
              id="evento_nome"
              value={form.evento_nome}
              onChange={(e) => setField("evento_nome", e.target.value)}
              disabled={isEdit}
              placeholder={`Ex: Nome do ${labelLower}...`}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Nome não pode ser alterado. Para trocar, exclua e crie novo.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="meta_inscritos">Meta de Inscritos</Label>
              <Input
                id="meta_inscritos"
                type="number"
                min="0"
                value={form.meta_inscritos}
                onChange={(e) => setField("meta_inscritos", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inscritos">Inscritos Realizados</Label>
              <Input
                id="inscritos"
                type="number"
                min="0"
                value={form.inscritos}
                onChange={(e) => setField("inscritos", e.target.value)}
              />
            </div>
          </div>

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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ticket_medio">Ticket Médio (R$)</Label>
              <Input
                id="ticket_medio"
                type="number"
                min="0"
                step="0.01"
                value={form.ticket_medio}
                onChange={(e) => setField("ticket_medio", e.target.value)}
                placeholder="Auto se vazio"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="investimento_ads">Investimento em Ads (R$)</Label>
              <Input
                id="investimento_ads"
                type="number"
                min="0"
                step="0.01"
                value={form.investimento_ads}
                onChange={(e) => setField("investimento_ads", e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-semibold mb-3">Funil de Mídia Paga</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="alcance">Alcance</Label>
                <Input
                  id="alcance"
                  type="number"
                  min="0"
                  value={form.alcance}
                  onChange={(e) => setField("alcance", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cliques">Cliques</Label>
                <Input
                  id="cliques"
                  type="number"
                  min="0"
                  value={form.cliques}
                  onChange={(e) => setField("cliques", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="visitantes_lp">Visitantes LP</Label>
                <Input
                  id="visitantes_lp"
                  type="number"
                  min="0"
                  value={form.visitantes_lp}
                  onChange={(e) => setField("visitantes_lp", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checkout">Checkout</Label>
                <Input
                  id="checkout"
                  type="number"
                  min="0"
                  value={form.checkout}
                  onChange={(e) => setField("checkout", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="compras">Compras</Label>
                <Input
                  id="compras"
                  type="number"
                  min="0"
                  value={form.compras}
                  onChange={(e) => setField("compras", e.target.value)}
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
            className={TEMA_BOTAO[corBotao]}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Salvar Alterações" : `Criar ${labelSingular}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
