"use client";

import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FunilChart, type FunilEtapa } from "@/components/charts/funil-chart";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Produto { id: string; nome: string; tipo: string; ativo: boolean; }

interface FunilDashboard {
  produto_id: string | null;
  ano: number;
  mes: number;
  etapas: FunilEtapa[];
  taxa_lead_ligacao: number | null;
  taxa_ligacao_sql: number | null;
  taxa_sql_reuniao: number | null;
  taxa_reuniao_venda: number | null;
  taxa_lead_venda: number | null;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const pct = (v: number | null) => v == null ? "—" : (v * 100).toFixed(1) + "%";
const n = (v: number | null) => v == null ? "—" : Number(v).toLocaleString("pt-BR");

export default function FunilPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState("todos");
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);
  const [data, setData] = useState<FunilDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Produto[]>("/produtos?ativo=true").then(setProdutos)
      .catch(() => toast.error("Erro ao carregar produtos"));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ ano: String(ano), mes: String(mes) });
    if (produtoId !== "todos") params.set("produto_id", produtoId);
    api.get<FunilDashboard>(`/comercial/dashboard/funil?${params}`)
      .then(setData)
      .catch(() => toast.error("Erro ao carregar funil"))
      .finally(() => setLoading(false));
  }, [produtoId, ano, mes]);

  const tx = [
    { label: "Lead → Ligação", value: data?.taxa_lead_ligacao ?? null },
    { label: "Ligação → SQL", value: data?.taxa_ligacao_sql ?? null },
    { label: "SQL → Reunião", value: data?.taxa_sql_reuniao ?? null },
    { label: "Reunião → Venda", value: data?.taxa_reuniao_venda ?? null },
    { label: "Lead → Venda", value: data?.taxa_lead_venda ?? null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Funil Comercial</h1>
        <div className="flex gap-2 items-center">
          <Select value={produtoId} onValueChange={(v) => setProdutoId(v ?? "todos")}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground border rounded-lg bg-white">
              Carregando...
            </div>
          ) : (
            <FunilChart etapas={data?.etapas ?? []} />
          )}
        </div>
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Taxas de Conversão</h2>
            <div className="space-y-2">
              {tx.map((t) => (
                <div key={t.label} className="flex justify-between items-baseline border-b pb-1 last:border-0">
                  <span className="text-sm text-zinc-600">{t.label}</span>
                  <span className="font-semibold">{pct(t.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Resultado</TableHead>
              <TableHead className="text-right">% Meta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.etapas ?? []).map((e) => {
              const meta = Number(e.meta ?? 0);
              const res = Number(e.resultado ?? 0);
              const pctMeta = meta > 0 ? res / meta : null;
              return (
                <TableRow key={e.etapa_id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="text-right">{n(e.meta)}</TableCell>
                  <TableCell className="text-right">{n(e.resultado)}</TableCell>
                  <TableCell className="text-right">{pct(pctMeta)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
