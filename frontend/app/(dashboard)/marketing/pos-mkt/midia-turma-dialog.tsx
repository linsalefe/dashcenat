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
} from "@/lib/types/marketing-frentes";
import {
  parseDecimal,
  parseInputDecimal,
  parseInputInteiro,
} from "@/lib/types/marketing-frentes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma: FrentePeriodoOut | null;
  onSaved: () => void;
}

interface FormState {
  investimento_ads: string;
  alcance: string;
  cliques: string;
  visitantes_lp: string;
  checkout: string;
  compras: string;
}

const FORM_INICIAL: FormState = {
  investimento_ads: "0",
  alcance: "0",
  cliques: "0",
  visitantes_lp: "0",
  checkout: "0",
  compras: "0",
};

export function MidiaTurmaDialog({
  open,
  onOpenChange,
  turma,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (turma) {
      setForm({
        investimento_ads: String(parseDecimal(turma.investimento_ads)),
        alcance: String(turma.alcance ?? 0),
        cliques: String(turma.cliques ?? 0),
        visitantes_lp: String(turma.visitantes_lp ?? 0),
        checkout: String(turma.checkout ?? 0),
        compras: String(turma.compras ?? 0),
      });
    } else {
      setForm(FORM_INICIAL);
    }
  }, [turma, open]);

  function setField<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!turma) return;
    setSaving(true);
    try {
      const payload: FrentePeriodoUpdate = {
        investimento_ads: parseInputDecimal(form.investimento_ads) ?? 0,
        alcance: parseInputInteiro(form.alcance) ?? 0,
        cliques: parseInputInteiro(form.cliques) ?? 0,
        visitantes_lp: parseInputInteiro(form.visitantes_lp) ?? 0,
        checkout: parseInputInteiro(form.checkout) ?? 0,
        compras: parseInputInteiro(form.compras) ?? 0,
      };
      await api.patch(`/frente-periodo/${turma.id}`, payload);
      toast.success("Mídia paga atualizada");
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
          <DialogTitle>Mídia Paga — {turma?.evento_nome}</DialogTitle>
          <DialogDescription>
            Edite os números do funil de mídia paga desta turma. O dado comercial
            (vendas, leads etc) é mantido pela tela Pós-Graduação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
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

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Funil de Mídia Paga</h4>
            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="checkout">Checkout iniciado</Label>
                <Input
                  id="checkout"
                  type="number"
                  min="0"
                  value={form.checkout}
                  onChange={(e) => setField("checkout", e.target.value)}
                />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="compras">Compras concluídas (Ads)</Label>
                <Input
                  id="compras"
                  type="number"
                  min="0"
                  value={form.compras}
                  onChange={(e) => setField("compras", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Esta é a contagem de compras vindas do pixel/checkout do Ads. Pode
                  divergir das matrículas confirmadas (que ficam na tela Pós-Graduação).
                </p>
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
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
