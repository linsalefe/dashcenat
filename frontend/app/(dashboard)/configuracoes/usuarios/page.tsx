"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  KeyRound,
  Pencil,
  Shield,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  Mail,
  Sparkles,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Usuario {
  id: string;
  email: string;
  nome: string;
  ativo: boolean;
  papel: string;
  ultimo_acesso: string | null;
  criado_em: string | null;
}

function lerCurrentUser(): { id: string; papel: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const dtRelativo = (iso: string | null) => {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [edicaoOpen, setEdicaoOpen] = useState<Usuario | null>(null);
  const [senhaOpen, setSenhaOpen] = useState<Usuario | null>(null);

  const eu = lerCurrentUser();
  const souAdmin = eu?.papel === "admin";

  async function carregar() {
    setLoading(true);
    try {
      const data = await api.get<Usuario[]>("/usuarios");
      setUsuarios(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = usuarios.filter((u) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      u.nome.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.papel.toLowerCase().includes(q)
    );
  });

  async function excluir(u: Usuario) {
    if (!confirm(`Excluir o usuário ${u.nome}? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/usuarios/${u.id}`);
      toast.success(`${u.nome} excluído`);
      carregar();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Usuários</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {souAdmin
                ? "Gerencie acessos da equipe ao dashboard"
                : "Seus dados de acesso"}
            </p>
          </div>
        </div>

        {souAdmin && (
          <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
            <DialogTrigger render={<Button className="h-9" />}>
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </DialogTrigger>
            <DialogNovo onClose={() => setNovoOpen(false)} onSaved={carregar} />
          </Dialog>
        )}
      </div>

      {/* Busca (só admin precisa) */}
      {souAdmin && usuarios.length > 3 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, email ou papel…"
            className="h-9 pl-9"
          />
        </div>
      )}

      {/* Tabela */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="w-[120px]">Papel</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[140px]">Último acesso</TableHead>
              <TableHead className="text-right w-[200px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((u) => {
              const ehEu = eu?.id === u.id;
              const podeEditar = souAdmin || ehEu;
              const podeExcluir = souAdmin && !ehEu;
              const podeResetSenha = souAdmin || ehEu;

              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {u.nome
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "??"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <span className="truncate">{u.nome}</span>
                          {ehEu && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              você
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {u.papel === "admin" ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        <Shield className="mr-1 h-2.5 w-2.5" />
                        admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                        <UserIcon className="mr-1 h-2.5 w-2.5" />
                        user
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    {u.ativo ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                        ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/30">
                        <XCircle className="mr-1 h-2.5 w-2.5" />
                        inativo
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {dtRelativo(u.ultimo_acesso)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {podeEditar && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEdicaoOpen(u)}
                          className="h-7 px-2 text-xs"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                      )}
                      {podeResetSenha && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSenhaOpen(u)}
                          className="h-7 px-2 text-xs"
                        >
                          <KeyRound className="h-3 w-3 mr-1" />
                          Senha
                        </Button>
                      )}
                      {podeExcluir && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => excluir(u)}
                          className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Modais */}
      {edicaoOpen && (
        <Dialog open={!!edicaoOpen} onOpenChange={(open) => !open && setEdicaoOpen(null)}>
          <DialogEdicao
            usuario={edicaoOpen}
            souAdmin={souAdmin}
            ehEu={eu?.id === edicaoOpen.id}
            onClose={() => setEdicaoOpen(null)}
            onSaved={() => {
              setEdicaoOpen(null);
              carregar();
            }}
          />
        </Dialog>
      )}

      {senhaOpen && (
        <Dialog open={!!senhaOpen} onOpenChange={(open) => !open && setSenhaOpen(null)}>
          <DialogSenha
            usuario={senhaOpen}
            onClose={() => setSenhaOpen(null)}
            onSaved={() => setSenhaOpen(null)}
          />
        </Dialog>
      )}
    </div>
  );
}

// ============================================================
// Dialog: criar usuário
// ============================================================

function DialogNovo({
  onClose: _onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<string>("user");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      toast.error("Preencha nome, email e senha (mín. 6 caracteres)");
      return;
    }
    setSalvando(true);
    try {
      await api.post("/usuarios", { nome, email, senha, papel, ativo: true });
      toast.success("Usuário criado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao criar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Novo usuário</DialogTitle>
      </DialogHeader>

      <div className="space-y-3 pt-2">
        <div>
          <Label className="text-xs">Nome completo</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria Silva" className="mt-1.5" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@cenat.com"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs">Senha temporária</Label>
          <Input
            type="text"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mín. 6 caracteres"
            className="mt-1.5 font-mono"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Compartilhe com o usuário. Ele pode trocar em &quot;Editar&quot; depois.
          </p>
        </div>
        <div>
          <Label className="text-xs">Papel</Label>
          <Select value={papel} onValueChange={(v: string | null) => setPapel(v || "user")}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-3 w-3" />
                  User — vê tudo, edita só os próprios dados
                </div>
              </SelectItem>
              <SelectItem value="admin">
                <div className="flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  Admin — gerencia outros usuários
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={salvar} disabled={salvando} className="w-full mt-2">
          {salvando ? "Criando…" : "Criar usuário"}
        </Button>
      </div>
    </DialogContent>
  );
}

// ============================================================
// Dialog: editar usuário
// ============================================================

function DialogEdicao({
  usuario,
  souAdmin,
  ehEu,
  onClose: _onClose,
  onSaved,
}: {
  usuario: Usuario;
  souAdmin: boolean;
  ehEu: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [papel, setPapel] = useState(usuario.papel);
  const [ativo, setAtivo] = useState(usuario.ativo);
  const [salvando, setSalvando] = useState(false);

  // user comum só pode editar nome e email do próprio
  const podeEditarPapel = souAdmin && !ehEu;
  const podeEditarAtivo = souAdmin && !ehEu;

  async function salvar() {
    setSalvando(true);
    try {
      const body: Record<string, unknown> = {};
      if (nome !== usuario.nome) body.nome = nome;
      if (email !== usuario.email) body.email = email;
      if (podeEditarPapel && papel !== usuario.papel) body.papel = papel;
      if (podeEditarAtivo && ativo !== usuario.ativo) body.ativo = ativo;

      if (Object.keys(body).length === 0) {
        toast.info("Nada pra atualizar");
        setSalvando(false);
        return;
      }

      await api.patch(`/usuarios/${usuario.id}`, body);
      toast.success("Usuário atualizado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao atualizar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Editar {ehEu ? "minha conta" : usuario.nome}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3 pt-2">
        <div>
          <Label className="text-xs">Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
        </div>

        {podeEditarPapel && (
          <div>
            <Label className="text-xs">Papel</Label>
            <Select value={papel} onValueChange={(v: string | null) => setPapel(v || "user")}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {podeEditarAtivo && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Conta ativa</div>
              <div className="text-[11px] text-muted-foreground">
                Inativos não conseguem fazer login
              </div>
            </div>
            <button
              role="switch"
              aria-checked={ativo}
              onClick={() => setAtivo((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                ativo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  ativo ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {!podeEditarPapel && !podeEditarAtivo && (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
            Você pode alterar apenas nome e email da própria conta. Para mudar
            papel ou status, peça a um admin.
          </div>
        )}

        <Button onClick={salvar} disabled={salvando} className="w-full mt-2">
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </DialogContent>
  );
}

// ============================================================
// Dialog: reset de senha
// ============================================================

function DialogSenha({
  usuario,
  onClose: _onClose,
  onSaved,
}: {
  usuario: Usuario;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (senha.length < 6) {
      toast.error("Mínimo 6 caracteres");
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/usuarios/${usuario.id}/reset-senha`, { senha });
      toast.success(`Senha de ${usuario.nome} atualizada`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Resetar senha — {usuario.nome}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3 pt-2">
        <div>
          <Label className="text-xs">Nova senha</Label>
          <Input
            type="text"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mín. 6 caracteres"
            className="mt-1.5 font-mono"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Compartilhe com o usuário com segurança.
          </p>
        </div>

        <Button onClick={salvar} disabled={salvando} className="w-full">
          {salvando ? "Atualizando…" : "Atualizar senha"}
        </Button>
      </div>
    </DialogContent>
  );
}
