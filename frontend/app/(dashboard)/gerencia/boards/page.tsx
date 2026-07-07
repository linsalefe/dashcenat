"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDataHora, gerencia, type Board } from "@/lib/gerencia";

function ConfiancaBadge({ c }: { c: string | null }) {
  if (!c) return <span className="text-muted-foreground">—</span>;
  const alta = c.includes("alta");
  const baixa = c.includes("baixa");
  const cls = alta
    ? "text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
    : baixa
      ? "text-amber-600 border-amber-500/30 dark:text-amber-400"
      : "text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`${cls} font-normal`}>
      {c}
    </Badge>
  );
}

function colDetectada(b: Board, chave: "status" | "prazo" | "responsavel"): string {
  const map = (b.overrides?.colunas as Record<string, { title?: string }>)?.[chave]
    ?? (b.colunas_map?.[chave] as { title?: string } | undefined);
  return map?.title ?? "—";
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [soIncluidos, setSoIncluidos] = useState(false);
  const [editando, setEditando] = useState<Board | null>(null);
  const [overridesTexto, setOverridesTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      setBoards(await gerencia.boards({ ativo: true }));
    } catch {
      toast.error("Falha ao carregar boards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return boards.filter(
      (b) =>
        (!soIncluidos || b.incluido) &&
        (!q || b.nome.toLowerCase().includes(q) || (b.workspace ?? "").toLowerCase().includes(q)),
    );
  }, [boards, busca, soIncluidos]);

  async function toggleIncluido(b: Board, valor: boolean) {
    // otimista
    setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, incluido: valor } : x)));
    try {
      await gerencia.patchBoard(b.id, { incluido: valor });
      toast.success(`${b.nome}: ${valor ? "incluído" : "silenciado"}`);
    } catch {
      toast.error("Falha ao atualizar — revertendo");
      setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, incluido: !valor } : x)));
    }
  }

  function abrirEdicao(b: Board) {
    setEditando(b);
    setOverridesTexto(JSON.stringify(b.overrides ?? {}, null, 2));
  }

  async function salvarOverrides() {
    if (!editando) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = overridesTexto.trim() ? JSON.parse(overridesTexto) : {};
      if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    } catch {
      toast.error("JSON inválido — overrides deve ser um objeto");
      return;
    }
    setSalvando(true);
    try {
      const atualizado = await gerencia.patchBoard(editando.id, { overrides: parsed });
      setBoards((prev) => prev.map((x) => (x.id === atualizado.id ? atualizado : x)));
      toast.success("Overrides salvos");
      setEditando(null);
    } catch {
      toast.error("Falha ao salvar overrides");
    } finally {
      setSalvando(false);
    }
  }

  const incluidos = boards.filter((b) => b.incluido).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/gerencia" />}>
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{incluidos}</span> incluídos de{" "}
          <span className="tabular-nums">{boards.length}</span> boards descobertos
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Buscar board…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-[220px]"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={soIncluidos}
              onCheckedChange={(v) => setSoIncluidos(v === true)}
            />
            só incluídos
          </label>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px] text-center">Incluir</TableHead>
                  <TableHead>Board</TableHead>
                  <TableHead className="w-[120px]">Workspace</TableHead>
                  <TableHead className="w-[70px] text-right">Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-[140px]">Confiança</TableHead>
                  <TableHead className="w-[130px]">Último sync</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Nenhum board com esse filtro
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((b) => (
                    <TableRow key={b.id} className={b.incluido ? "" : "opacity-60"}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={b.incluido}
                          onCheckedChange={(v) => toggleIncluido(b, v === true)}
                        />
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate font-medium" title={b.nome}>
                        {b.nome}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.workspace ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {b.total_itens}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{colDetectada(b, "status")}</TableCell>
                      <TableCell className="text-muted-foreground">{colDetectada(b, "prazo")}</TableCell>
                      <TableCell className="text-muted-foreground">{colDetectada(b, "responsavel")}</TableCell>
                      <TableCell>
                        <ConfiancaBadge c={b.confianca_classificacao} />
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground tabular-nums">
                        {fmtDataHora(b.ultimo_sync)}
                        {b.ultimo_sync_status && b.ultimo_sync_status !== "ok" && (
                          <span className="ml-1 text-destructive">({b.ultimo_sync_status})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => abrirEdicao(b)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corrigir classificação — {editando?.nome}</DialogTitle>
            <DialogDescription>
              Overrides (JSON) sobrescrevem a detecção automática e nunca são apagados pela
              re-descoberta. Ex.: trocar a coluna de prazo ou recategorizar um rótulo de status.
            </DialogDescription>
          </DialogHeader>

          {editando && (
            <div className="flex flex-col gap-3">
              <div className="text-[12px] text-muted-foreground rounded-md bg-muted/40 p-3 font-mono overflow-x-auto">
                <div className="mb-1 font-sans font-medium text-foreground">Detecção automática (base):</div>
                <div>colunas_map: {JSON.stringify(editando.colunas_map)}</div>
                <div className="mt-1">status_map: {JSON.stringify(editando.status_map)}</div>
              </div>
              <Textarea
                value={overridesTexto}
                onChange={(e) => setOverridesTexto(e.target.value)}
                rows={9}
                className="font-mono text-[12px]"
                spellCheck={false}
                placeholder={'{\n  "colunas": { "prazo": { "id": "date_x", "title": "Entrega", "type": "date" } }\n}'}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvarOverrides} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar overrides"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
