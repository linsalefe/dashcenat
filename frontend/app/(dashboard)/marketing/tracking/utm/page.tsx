"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Copy, ExternalLink, Code2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface UtmLink {
  id: string;
  slug: string;
  nome: string;
  url_destino: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string | null;
  utm_content: string | null;
  produto_nome: string | null;
  canal_id: string | null;
  short_link: boolean;
  clicks: number;
  criado_em: string;
}
interface Canal {
  id: string;
  nome: string;
  slug: string;
}

const FORM_INICIAL = {
  nome: "",
  url_destino: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  produto_nome: "",
  canal_id: "",
  short_link: true,
};

const SOURCES_COMUNS = ["instagram", "facebook", "google", "youtube", "email", "whatsapp", "tiktok", "linkedin"];
const MEDIUMS_COMUNS = ["cpc", "organic", "social", "email", "referral", "bio", "story", "feed"];

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api/v1";

export default function UtmPage() {
  const [links, setLinks] = useState<UtmLink[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({ ...FORM_INICIAL });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([
        api.get<UtmLink[]>(`/utm/links${busca ? `?q=${encodeURIComponent(busca)}` : ""}`),
        api.get<Canal[]>(`/canais`).catch(() => [] as Canal[]),
      ]);
      setLinks(l);
      setCanais(c);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildUrlPreview() {
    if (!form.url_destino) return "";
    try {
      const u = new URL(form.url_destino);
      if (form.utm_source) u.searchParams.set("utm_source", form.utm_source);
      if (form.utm_medium) u.searchParams.set("utm_medium", form.utm_medium);
      if (form.utm_campaign) u.searchParams.set("utm_campaign", form.utm_campaign);
      if (form.utm_term) u.searchParams.set("utm_term", form.utm_term);
      if (form.utm_content) u.searchParams.set("utm_content", form.utm_content);
      return u.toString();
    } catch {
      return "URL inválida";
    }
  }

  async function criarLink() {
    if (!form.nome || !form.url_destino || !form.utm_source || !form.utm_medium || !form.utm_campaign) {
      toast.error("Preencha nome, URL e os 3 campos obrigatórios (source, medium, campaign)");
      return;
    }
    try {
      await api.post<UtmLink>(`/utm/links`, {
        ...form,
        produto_nome: form.produto_nome || null,
        canal_id: form.canal_id || null,
      });
      toast.success("Link criado");
      setForm({ ...FORM_INICIAL });
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    }
  }

  async function deletar(id: string) {
    if (!confirm("Excluir este link?")) return;
    try {
      await api.delete(`/utm/links/${id}`);
      toast.success("Link excluído");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  function shortLinkUrl(slug: string) {
    return `${API_BASE}/track/r/${slug}`;
  }

  function copiar(texto: string, label = "Copiado") {
    navigator.clipboard.writeText(texto);
    toast.success(label);
  }

  const preview = useMemo(buildUrlPreview, [form]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Gerador UTM</h2>
          <p className="text-sm text-muted-foreground">
            Cria URLs com UTM + short-links rastreáveis
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={snippetOpen} onOpenChange={setSnippetOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
              <Code2 className="mr-2 h-4 w-4" />
              Snippet HTML
            </DialogTrigger>
            <SnippetDialog apiBase={API_BASE} onClose={() => setSnippetOpen(false)} />
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />
              Novo link
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo link com UTM</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3">
                <div>
                  <Label>Nome interno *</Label>
                  <Input
                    placeholder="ex: Story Insta - Pós Junho"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>

                <div>
                  <Label>URL de destino *</Label>
                  <Input
                    placeholder="https://posgraduacao.cenat.com/oferta"
                    value={form.url_destino}
                    onChange={(e) => setForm({ ...form, url_destino: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>utm_source *</Label>
                    <Input
                      list="src-list"
                      placeholder="instagram"
                      value={form.utm_source}
                      onChange={(e) => setForm({ ...form, utm_source: e.target.value.toLowerCase() })}
                    />
                    <datalist id="src-list">
                      {SOURCES_COMUNS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label>utm_medium *</Label>
                    <Input
                      list="med-list"
                      placeholder="bio"
                      value={form.utm_medium}
                      onChange={(e) => setForm({ ...form, utm_medium: e.target.value.toLowerCase() })}
                    />
                    <datalist id="med-list">
                      {MEDIUMS_COMUNS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label>utm_campaign *</Label>
                    <Input
                      placeholder="lanc_jun"
                      value={form.utm_campaign}
                      onChange={(e) => setForm({ ...form, utm_campaign: e.target.value.toLowerCase() })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>utm_term</Label>
                    <Input
                      placeholder="(opcional)"
                      value={form.utm_term}
                      onChange={(e) => setForm({ ...form, utm_term: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>utm_content</Label>
                    <Input
                      placeholder="(opcional)"
                      value={form.utm_content}
                      onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Produto</Label>
                    <Input
                      placeholder="ex: Pós Junho, Curso Avaliação Neuro…"
                      value={form.produto_nome}
                      onChange={(e) => setForm({ ...form, produto_nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Canal</Label>
                    <Select
                      value={form.canal_id || "_none"}
                      onValueChange={(v: string | null) => setForm({ ...form, canal_id: !v || v === "_none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {canais.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.short_link}
                    onChange={(e) => setForm({ ...form, short_link: e.target.checked })}
                  />
                  Gerar short-link (recomendado — conta cliques antes do redirect)
                </label>

                <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono break-all">
                  <div className="mb-1 text-muted-foreground font-sans">Preview da URL:</div>
                  {preview || "—"}
                </div>

                <Button onClick={criarLink} className="w-full">Criar link</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex gap-2">
          <Input
            placeholder="Buscar por nome ou campanha…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="max-w-sm"
          />
          <Button variant="outline" onClick={load}>Buscar</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Source / Medium</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Short link</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="w-[140px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6} className="text-center py-6">Carregando…</TableCell></TableRow>
            )}
            {!loading && links.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nenhum link gerado ainda
                </TableCell>
              </TableRow>
            )}
            {links.map((l) => {
              const urlLonga = (() => {
                try {
                  const u = new URL(l.url_destino);
                  u.searchParams.set("utm_source", l.utm_source);
                  u.searchParams.set("utm_medium", l.utm_medium);
                  u.searchParams.set("utm_campaign", l.utm_campaign);
                  if (l.utm_term) u.searchParams.set("utm_term", l.utm_term);
                  if (l.utm_content) u.searchParams.set("utm_content", l.utm_content);
                  return u.toString();
                } catch {
                  return l.url_destino;
                }
              })();
              const urlCurta = shortLinkUrl(l.slug);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.utm_source} / {l.utm_medium}
                  </TableCell>
                  <TableCell><Badge variant="outline">{l.utm_campaign}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">/r/{l.slug}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.clicks}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Copiar URL com UTM"
                        onClick={() => copiar(urlLonga, "URL longa copiada")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Copiar short-link"
                        onClick={() => copiar(urlCurta, "Short-link copiado")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Excluir"
                        onClick={() => deletar(l.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============================================================
// Diálogo: snippet HTML pra colar nas landing pages
// ============================================================

function SnippetDialog({ apiBase, onClose: _onClose }: { apiBase: string; onClose: () => void }) {
  const [siteId, setSiteId] = useState("cenat-pos");
  const [aba, setAba] = useState<"install" | "eventos" | "obrigado">("install");
  const [produtoObrigado, setProdutoObrigado] = useState("Pós Junho");
  const [valorObrigado, setValorObrigado] = useState("497.00");
  const [modoObrigado, setModoObrigado] = useState<"atalho" | "manual">("atalho");

  const valorSafe = valorObrigado.trim() || "0.00";
  const produtoAttr = produtoObrigado.trim()
    ? ` data-produto="${produtoObrigado.trim()}"`
    : "";

  const snippet =
    `<!-- DashCENAT tracking — cole no <head> de todas as páginas -->\n` +
    `<script src="${apiBase}/track/snippet.js" data-site="${siteId}" async></script>`;

  const exemploConversao =
    `<!-- Botão de conversão (ex: checkout) -->\n` +
    `<button data-track="conversion" data-event="checkout_iniciado" data-value="497.00" data-produto="Pós Junho">\n` +
    `  Comprar agora\n` +
    `</button>\n\n` +
    `<!-- Clique em CTA -->\n` +
    `<a href="/pos" data-track="click" data-event="cta_hero">Saiba mais</a>\n\n` +
    `<!-- Disparo manual via JS -->\n` +
    `<script>\n` +
    `  window.cenatTrack('conversion', {\n` +
    `    evento_nome: 'pagamento_confirmado',\n` +
    `    valor: 497.00,\n` +
    `    produto_nome: 'Pós Junho'\n` +
    `  });\n` +
    `</script>`;

  // 3a — 1 linha só (HTML não exige atributos quebrados)
  const obrigadoAuto =
    `<!-- Página /obrigado — atalho: dispara conversion no load -->\n` +
    `<script src="${apiBase}/track/snippet.js" data-site="${siteId}" data-conversion data-value="${valorSafe}" data-event="pagamento_confirmado"${produtoAttr} async></script>`;

  const obrigadoManual =
    `<!-- Página /obrigado — versão manual (lê ?valor= da URL) -->\n` +
    `<script src="${apiBase}/track/snippet.js" data-site="${siteId}" async></script>\n` +
    `<script>\n` +
    `  var qs = new URLSearchParams(location.search);\n` +
    `  var valor = parseFloat(qs.get('valor')) || ${valorSafe};\n` +
    `  window.cenatTrack('conversion', {\n` +
    `    valor: valor,\n` +
    `    evento_nome: 'pagamento_confirmado',\n` +
    `    produto_nome: ${produtoObrigado.trim() ? `'${produtoObrigado.trim()}'` : "null"}\n` +
    `  });\n` +
    `</script>`;

  function copiar(t: string) {
    navigator.clipboard.writeText(t);
    toast.success("Copiado");
  }

  const abas = [
    { id: "install" as const, label: "1. Instalação" },
    { id: "eventos" as const, label: "2. Eventos" },
    { id: "obrigado" as const, label: "3. Página de obrigado" },
  ];

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Snippet HTML</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Header: ID do site (compartilhado entre as abas) */}
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">ID do site (data-site)</Label>
            <Input
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="cenat-pos / cenat-congresso / etc."
              className="h-9"
            />
          </div>
          <p className="text-xs text-muted-foreground pb-2 max-w-[180px]">
            1 identificador por LP/produto.
          </p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 rounded-md border bg-muted/30 p-1">
          {abas.map((a) => (
            <Button
              key={a.id}
              size="sm"
              variant={aba === a.id ? "default" : "ghost"}
              onClick={() => setAba(a.id)}
              className="h-7 flex-1 text-xs"
            >
              {a.label}
            </Button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        {aba === "install" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Cole no <code className="px-1 py-0.5 rounded bg-muted">&lt;head&gt;</code> de
              <strong> todas as páginas</strong>. Isso já registra pageviews e captura UTMs.
            </p>
            <CodeBlock code={snippet} onCopy={() => copiar(snippet)} />
          </div>
        )}

        {aba === "eventos" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Marque botões e links com <code className="px-1 py-0.5 rounded bg-muted">data-track</code> ou
              dispare manualmente via <code className="px-1 py-0.5 rounded bg-muted">window.cenatTrack</code>.
            </p>
            <CodeBlock code={exemploConversao} onCopy={() => copiar(exemploConversao)} />
          </div>
        )}

        {aba === "obrigado" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Se o checkout (Hotmart) redireciona pra <code className="px-1 py-0.5 rounded bg-muted">/obrigado</code> só
              quando confirma, esse snippet lá garante 1 conversão por venda.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Produto</Label>
                <Input
                  value={produtoObrigado}
                  onChange={(e) => setProdutoObrigado(e.target.value)}
                  placeholder="Pós Junho"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  value={valorObrigado}
                  onChange={(e) => setValorObrigado(e.target.value)}
                  placeholder="497.00"
                  className="h-8"
                  inputMode="decimal"
                />
              </div>
            </div>

            {/* Sub-abas: atalho vs manual */}
            <div className="flex gap-1 rounded-md border bg-muted/20 p-1">
              <Button
                size="sm"
                variant={modoObrigado === "atalho" ? "default" : "ghost"}
                onClick={() => setModoObrigado("atalho")}
                className="h-7 flex-1 text-xs"
              >
                Atalho (1 tag)
              </Button>
              <Button
                size="sm"
                variant={modoObrigado === "manual" ? "default" : "ghost"}
                onClick={() => setModoObrigado("manual")}
                className="h-7 flex-1 text-xs"
              >
                Manual (lê valor da URL)
              </Button>
            </div>

            {modoObrigado === "atalho" ? (
              <CodeBlock code={obrigadoAuto} onCopy={() => copiar(obrigadoAuto)} />
            ) : (
              <>
                <CodeBlock code={obrigadoManual} onCopy={() => copiar(obrigadoManual)} />
                <p className="text-xs text-muted-foreground">
                  Use esta versão se o checkout pode passar o valor real via{" "}
                  <code className="px-1 py-0.5 rounded bg-muted">?valor=497</code> na URL.
                </p>
              </>
            )}
          </div>
        )}

        {/* Footer informativo (sempre visível) */}
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs">
          <strong>O snippet faz sozinho:</strong>{" "}
          pageview a cada carregamento, persiste UTMs na sessão, cria <code>anon_id</code> + <code>session_id</code>,
          captura cliques em <code>[data-track]</code>, e dispara conversão se a tag tiver <code>data-conversion</code>.
        </div>
      </div>
    </DialogContent>
  );
}

// Bloco de código com scroll horizontal (não quebra atributos no meio)
function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="relative rounded-md border bg-muted/40">
      <Button
        size="sm"
        variant="ghost"
        onClick={onCopy}
        className="absolute right-1 top-1 h-6 px-2 text-xs"
      >
        <Copy className="mr-1 h-3 w-3" /> Copiar
      </Button>
      <pre className="overflow-x-auto p-3 pr-16 text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
