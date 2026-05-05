"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Produto {
  id: string;
  tipo: string;
  nome: string;
  turma: string | null;
  codigo: string | null;
  ativo: boolean;
  criado_em: string;
}

const TIPOS = [
  { value: "pos_graduacao", label: "Pos-Graduacao" },
  { value: "curso_livre", label: "Curso Livre" },
  { value: "congresso_online", label: "Congresso Online" },
  { value: "congresso_presencial", label: "Congresso Presencial" },
  { value: "comunidade", label: "Comunidade" },
  { value: "seminario_online", label: "Seminario Online" },
  { value: "evento_online", label: "Evento Online" },
];

function tipoLabel(tipo: string) {
  return TIPOS.find((t) => t.value === tipo)?.label || tipo;
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [turma, setTurma] = useState("");
  const [codigo, setCodigo] = useState("");

  const fetchProdutos = useCallback(async () => {
    try {
      const data = await api.get<Produto[]>("/produtos?ativo=true");
      setProdutos(data);
    } catch {
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  function resetForm() {
    setNome("");
    setTipo("");
    setTurma("");
    setCodigo("");
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(p: Produto) {
    setEditingId(p.id);
    setNome(p.nome);
    setTipo(p.tipo);
    setTurma(p.turma || "");
    setCodigo(p.codigo || "");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const body: Record<string, string | null> = {
      nome,
      tipo,
      turma: turma || null,
      codigo: codigo || null,
    };

    try {
      if (editingId) {
        await api.patch(`/produtos/${editingId}`, body);
        toast.success("Produto atualizado");
      } else {
        await api.post("/produtos", body);
        toast.success("Produto criado");
      }
      setDialogOpen(false);
      resetForm();
      fetchProdutos();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Erro ao salvar produto";
      toast.error(message);
    }
  }

  async function handleToggleAtivo(p: Produto) {
    try {
      await api.patch(`/produtos/${p.id}`, { ativo: !p.ativo });
      toast.success(p.ativo ? "Produto desativado" : "Produto ativado");
      fetchProdutos();
    } catch {
      toast.error("Erro ao alterar status");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={<Button />}
            onClick={openCreate}
          >
            Novo Produto
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v ?? "")} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="turma">Turma</Label>
                  <Input
                    id="turma"
                    value={turma}
                    onChange={(e) => setTurma(e.target.value)}
                    placeholder="Ex: T5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo">Codigo</Label>
                  <Input
                    id="codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ex: pos_bp_5"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead>Codigo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : produtos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum produto cadastrado
                </TableCell>
              </TableRow>
            ) : (
              produtos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{tipoLabel(p.tipo)}</TableCell>
                  <TableCell>{p.turma || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {p.codigo || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        p.ativo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleAtivo(p)}
                    >
                      {p.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
