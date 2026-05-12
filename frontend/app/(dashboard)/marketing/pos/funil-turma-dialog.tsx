"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FunilCone3D } from "@/components/overview/funil-cone-3d";
import type { FrentePeriodoOut } from "@/lib/types/marketing-frentes";
import { formatarMoeda } from "@/lib/types/marketing-frentes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma: FrentePeriodoOut | null;
  mes: number;
  ano: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function FunilTurmaDialog({
  open,
  onOpenChange,
  turma,
  mes,
  ano,
}: Props) {
  if (!turma) return null;

  const etapas = [
    { nome: "Leads",   valor: turma.leads ?? 0,             meta: turma.meta_leads ?? null },
    { nome: "Ligação", valor: turma.ligacao ?? 0,           meta: turma.meta_ligacao ?? null },
    { nome: "SQL",     valor: turma.sql_reuniao ?? 0,       meta: turma.meta_sql ?? null },
    { nome: "Reunião", valor: turma.reuniao_realizada ?? 0, meta: turma.meta_reuniao ?? null },
    { nome: "Vendas",  valor: turma.vendas ?? 0,            meta: turma.meta_vendas ?? null },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Funil — {turma.evento_nome}</DialogTitle>
          <DialogDescription>
            Conversão da turma em {MESES[mes - 1]}/{ano}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <FunilCone3D etapas={etapas} />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Receita</p>
            <p className="text-lg font-bold tabular-nums">
              {formatarMoeda(turma.receita)}
            </p>
            <p className="text-xs text-muted-foreground">
              de meta {formatarMoeda(turma.meta_receita)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Investimento em Ads</p>
            <p className="text-lg font-bold tabular-nums">
              {formatarMoeda(turma.investimento_ads)}
            </p>
            {turma.ticket_medio && (
              <p className="text-xs text-muted-foreground">
                Ticket médio: {formatarMoeda(turma.ticket_medio)}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
