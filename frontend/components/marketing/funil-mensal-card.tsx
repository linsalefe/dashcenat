"use client";

import { useEffect, useState } from "react";
import { Edit, Loader2 } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { FunilCone3D } from "@/components/overview/funil-cone-3d";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  Frente,
  FunilMensalOut,
  FunilMensalUpdate,
} from "@/lib/types/marketing-frentes";
import {
  parseDecimal,
  formatarMoeda,
  parseInputDecimal,
  parseInputInteiro,
} from "@/lib/types/marketing-frentes";
import { TEMA_BOTAO, type CorBotao } from "./tema-frente";

interface Props {
  frente: Frente;
  ano: number;
  mes: number;
  corBotao: CorBotao;
  refreshKey?: number;
  onSaved?: () => void;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function FunilMensalCard({
  frente,
  ano,
  mes,
  corBotao,
  refreshKey,
  onSaved,
}: Props) {
  const [funil, setFunil] = useState<FunilMensalOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    api
      .get<FunilMensalOut>(`/funil-mensal/${frente}/${ano}/${mes}`)
      .then((r) => {
        if (!canceled) setFunil(r);
      })
      .catch((err: Error) => {
        if (!canceled) toast.error(`Erro ao carregar funil: ${err.message}`);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [frente, ano, mes, refreshKey]);

  const etapas = funil
    ? [
        { nome: "Alcance", valor: funil.alcance, meta: null },
        { nome: "Cliques", valor: funil.cliques, meta: null },
        { nome: "Visitantes LP", valor: funil.visitantes_lp, meta: null },
        { nome: "Checkout", valor: funil.checkout, meta: null },
        { nome: "Compras", valor: funil.compras, meta: null },
      ]
    : [];

  return (
    <>
      <ChartCard
        title={`Funil de Mídia Paga — ${MESES[mes - 1]}/${ano}`}
        description={
          funil
            ? `Investido: ${formatarMoeda(funil.investimento_ads)}`
            : "Carregando..."
        }
        loading={loading}
        actions={
          <Button
            size="sm"
            className={TEMA_BOTAO[corBotao]}
            onClick={() => setDialogOpen(true)}
            disabled={loading || !funil}
          >
            <Edit className="h-4 w-4 mr-1" /> Editar Funil
          </Button>
        }
      >
        <FunilCone3D etapas={etapas} />
      </ChartCard>

      {funil && (
        <EditarFunilDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          funil={funil}
          corBotao={corBotao}
          onSaved={(novo) => {
            setFunil(novo);
            onSaved?.();
          }}
        />
      )}
    </>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  funil: FunilMensalOut;
  corBotao: CorBotao;
  onSaved: (novo: FunilMensalOut) => void;
}

function EditarFunilDialog({
  open,
  onOpenChange,
  funil,
  corBotao,
  onSaved,
}: DialogProps) {
  const [investimento, setInvestimento] = useState("0");
  const [alcance, setAlcance] = useState("0");
  const [cliques, setCliques] = useState("0");
  const [visitantes, setVisitantes] = useState("0");
  const [checkout, setCheckout] = useState("0");
  const [compras, setCompras] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setInvestimento(String(parseDecimal(funil.investimento_ads)));
      setAlcance(String(funil.alcance));
      setCliques(String(funil.cliques));
      setVisitantes(String(funil.visitantes_lp));
      setCheckout(String(funil.checkout));
      setCompras(String(funil.compras));
    }
  }, [open, funil]);

  async function salvar() {
    setSaving(true);
    try {
      const payload: FunilMensalUpdate = {
        investimento_ads: parseInputDecimal(investimento) ?? 0,
        alcance: parseInputInteiro(alcance) ?? 0,
        cliques: parseInputInteiro(cliques) ?? 0,
        visitantes_lp: parseInputInteiro(visitantes) ?? 0,
        checkout: parseInputInteiro(checkout) ?? 0,
        compras: parseInputInteiro(compras) ?? 0,
      };
      const novo = await api.patch<FunilMensalOut>(
        `/funil-mensal/${funil.id}`,
        payload,
      );
      toast.success("Funil atualizado");
      onSaved(novo);
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar Funil de Mídia Paga</DialogTitle>
          <DialogDescription>
            Números agregados de mídia paga deste mês. Alimentam o funil acima
            e os KPIs derivados (CPA, CPC, CTR).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="invest">Investimento em Ads (R$)</Label>
            <Input
              id="invest"
              type="number"
              min="0"
              step="0.01"
              value={investimento}
              onChange={(e) => setInvestimento(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="alc">Alcance</Label>
              <Input
                id="alc"
                type="number"
                min="0"
                value={alcance}
                onChange={(e) => setAlcance(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clk">Cliques</Label>
              <Input
                id="clk"
                type="number"
                min="0"
                value={cliques}
                onChange={(e) => setCliques(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lp">Visitantes LP</Label>
              <Input
                id="lp"
                type="number"
                min="0"
                value={visitantes}
                onChange={(e) => setVisitantes(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ck">Checkout iniciado</Label>
              <Input
                id="ck"
                type="number"
                min="0"
                value={checkout}
                onChange={(e) => setCheckout(e.target.value)}
              />
            </div>
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="cmp">Compras concluídas</Label>
              <Input
                id="cmp"
                type="number"
                min="0"
                value={compras}
                onChange={(e) => setCompras(e.target.value)}
              />
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
            onClick={salvar}
            disabled={saving}
            className={TEMA_BOTAO[corBotao]}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
