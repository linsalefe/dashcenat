"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";

interface Produto { id: string; nome: string; tipo: string; }
interface Etapa { id: number; codigo: string; nome: string; ordem: number; }
interface Resultado { produto_id: string; etapa_id: number; ano: number; mes: number; meta: string | null; resultado: string | null; }

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

type CellState = Record<string, Record<number, { meta: string; resultado: string }>>;

export default function PreencherPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);
  const [cells, setCells] = useState<CellState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Produto[]>("/produtos?ativo=true"),
      api.get<Etapa[]>("/comercial/funil/etapas"),
    ]).then(([prods, eps]) => {
      setProdutos(prods);
      setEtapas(eps.sort((a, b) => a.ordem - b.ordem));
    }).catch(() => toast.error("Erro ao carregar dados"));
  }, []);

  useEffect(() => {
    if (produtos.length === 0) return;
    setLoading(true);
    api.get<Resultado[]>(`/comercial/funil/resultados?ano=${ano}&mes=${mes}`)
      .then((rows) => {
        const next: CellState = {};
        for (const p of produtos) {
          next[p.id] = {};
          for (const e of etapas) next[p.id][e.id] = { meta: "", resultado: "" };
        }
        for (const r of rows) {
          if (next[r.produto_id]?.[r.etapa_id]) {
            next[r.produto_id][r.etapa_id] = {
              meta: r.meta != null ? String(r.meta) : "",
              resultado: r.resultado != null ? String(r.resultado) : "",
            };
          }
        }
        setCells(next);
      })
      .catch(() => toast.error("Erro ao carregar resultados"))
      .finally(() => setLoading(false));
  }, [ano, mes, produtos, etapas]);

  function updateCell(produtoId: string, etapaId: number, field: "meta" | "resultado", value: string) {
    setCells((prev) => ({
      ...prev,
      [produtoId]: {
        ...prev[produtoId],
        [etapaId]: { ...(prev[produtoId]?.[etapaId] ?? { meta: "", resultado: "" }), [field]: value },
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const p of produtos) {
        const etapasData = etapas.map((e) => {
          const cell = cells[p.id]?.[e.id] ?? { meta: "", resultado: "" };
          return {
            etapa_id: e.id,
            meta: cell.meta === "" ? null : Number(cell.meta),
            resultado: cell.resultado === "" ? null : Number(cell.resultado),
          };
        });
        const algoPreenchido = etapasData.some((e) => e.meta !== null || e.resultado !== null);
        if (!algoPreenchido) continue;

        await api.post("/comercial/funil/resultados/bulk", {
          produto_id: p.id, ano, mes, etapas: etapasData,
        });
      }
      toast.success("Mês salvo");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Preencher Funil</h1>
        <div className="flex gap-2 items-center">
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
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar mês inteiro"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-3 font-semibold sticky left-0 bg-zinc-50">Produto</th>
                {etapas.map((e) => (
                  <th key={e.id} className="text-center p-3 font-semibold border-l" colSpan={2}>{e.nome}</th>
                ))}
              </tr>
              <tr className="text-xs text-muted-foreground">
                <th className="p-2 sticky left-0 bg-zinc-50"></th>
                {etapas.map((e) => (
                  <Fragment key={e.id}>
                    <th className="p-2 border-l">Meta</th>
                    <th className="p-2">Result.</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2 font-medium sticky left-0 bg-white">{p.nome}</td>
                  {etapas.map((e) => {
                    const cell = cells[p.id]?.[e.id] ?? { meta: "", resultado: "" };
                    return (
                      <Fragment key={e.id}>
                        <td className="p-1 border-l">
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            value={cell.meta}
                            onChange={(ev) => updateCell(p.id, e.id, "meta", ev.target.value)}
                            className="h-8 text-right text-sm"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            value={cell.resultado}
                            onChange={(ev) => updateCell(p.id, e.id, "resultado", ev.target.value)}
                            className="h-8 text-right text-sm"
                          />
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
