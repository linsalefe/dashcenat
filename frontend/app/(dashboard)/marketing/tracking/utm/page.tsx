"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Code2,
  CheckCircle2,
  FileCode2,
  MousePointerClick,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
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
          <Sheet open={snippetOpen} onOpenChange={setSnippetOpen}>
            <SheetTrigger render={<Button variant="outline" />}>
              <Code2 className="mr-2 h-4 w-4" />
              Snippet HTML
            </SheetTrigger>
            <SnippetSheetContent apiBase={API_BASE} />
          </Sheet>

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
// Sheet lateral: snippet HTML pra colar nas landing pages
// ============================================================

const ABAS_SNIPPET = [
  {
    id: "install" as const,
    label: "Instalação",
    descricao: "Cole no <head> de todas as páginas",
    Icon: FileCode2,
  },
  {
    id: "eventos" as const,
    label: "Eventos",
    descricao: "Rastrear cliques e conversões",
    Icon: MousePointerClick,
  },
  {
    id: "obrigado" as const,
    label: "Página de obrigado",
    descricao: "Disparar conversão pós-pagamento",
    Icon: CheckCircle2,
  },
  {
    id: "hotmart" as const,
    label: "Vendas Hotmart",
    descricao: "Atribuição automática de checkouts",
    Icon: ShoppingBag,
  },
];

type AbaId = (typeof ABAS_SNIPPET)[number]["id"];

function SnippetSheetContent({ apiBase }: { apiBase: string }) {
  const [siteId, setSiteId] = useState("cenat-pos");
  const [aba, setAba] = useState<AbaId>("install");
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

  const exemploCta =
    `<!-- Cliques em CTAs (botões da LP) -->\n` +
    `<a href="/pos" data-track="click" data-event="cta_hero">Saiba mais</a>\n` +
    `<a href="/pos" data-track="click" data-event="cta_final">Inscrever-se</a>`;

  const exemploConversao =
    `<!-- Conversão (ex: clique em botão de checkout) -->\n` +
    `<button data-track="conversion" data-event="checkout_iniciado" data-value="497.00" data-produto="Pós Junho">\n` +
    `  Comprar agora\n` +
    `</button>`;

  const exemploManual =
    `<!-- Disparo manual via JavaScript -->\n` +
    `<script>\n` +
    `  window.cenatTrack('conversion', {\n` +
    `    evento_nome: 'pagamento_confirmado',\n` +
    `    valor: 497.00,\n` +
    `    produto_nome: 'Pós Junho'\n` +
    `  });\n` +
    `</script>`;

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

  const exemploHotmartAntes =
    `<a href="https://pay.hotmart.com/X123ABC?off=offer">\n  Comprar agora\n</a>`;

  const exemploHotmartDepois =
    `<a href="https://pay.hotmart.com/X123ABC?off=offer&src=cn_aid:abc12345|utm_source:instagram|utm_medium:bio|utm_campaign:lanc_jun|cta:cta_hero">\n  Comprar agora\n</a>`;

  const exemploCenatBuild =
    `var link = window.cenatBuildHotmartLink('https://pay.hotmart.com/X123ABC');\n` +
    `// → 'https://pay.hotmart.com/X123ABC?src=cn_aid:abc|utm_source:ig|...'`;

  function copiar(t: string) {
    navigator.clipboard.writeText(t);
    toast.success("Copiado");
  }

  return (
    <SheetContent
      side="right"
      className="!max-w-none w-full sm:w-[640px] lg:w-[760px] p-0 flex flex-col gap-0"
    >
      {/* ====== Header ====== */}
      <div className="flex items-start gap-3 px-6 pt-6 pb-5 border-b border-border/70">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <h2 className="text-base font-semibold tracking-tight leading-tight">
            Snippet de tracking
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cole o snippet no <code className="px-1 py-0.5 rounded bg-muted text-[10.5px]">&lt;head&gt;</code> de cada LP.
            UTMs, pageviews, cliques e checkouts Hotmart são capturados automaticamente.
          </p>
        </div>
      </div>

      {/* ====== ID do site (sticky) ====== */}
      <div className="px-6 py-4 border-b border-border/70 bg-muted/30">
        <Label className="text-xs font-medium">
          ID do site (data-site)
        </Label>
        <Input
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          placeholder="cenat-pos"
          className="mt-1.5 h-9 font-mono text-sm"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Use 1 ID por LP/produto (ex: <code>curso-infantojuvenil</code>, <code>pos-junho</code>). Use traço, não espaço.
        </p>
      </div>

      {/* ====== Tabs ====== */}
      <div className="px-6 pt-3 border-b border-border/70">
        <div className="flex items-center gap-1 overflow-x-auto">
          {ABAS_SNIPPET.map((a) => {
            const ativo = aba === a.id;
            const Icon = a.Icon;
            return (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={
                  "flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap " +
                  (ativo
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====== Body (scrollável) ====== */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Descrição da aba ativa */}
        <p className="text-xs text-muted-foreground -mt-1">
          {ABAS_SNIPPET.find((a) => a.id === aba)?.descricao}
        </p>

        {/* ----- Aba 1: Instalação ----- */}
        {aba === "install" && (
          <div className="space-y-4">
            <SectionTitle
              numero="1"
              titulo="Cole no <head> de todas as páginas"
              descricao="Funciona em HTML puro, WordPress, Next.js, qualquer plataforma."
            />
            <CodeBlock code={snippet} onCopy={() => copiar(snippet)} />

            <FeatureGrid />
          </div>
        )}

        {/* ----- Aba 2: Eventos ----- */}
        {aba === "eventos" && (
          <div className="space-y-5">
            <SectionTitle
              numero="1"
              titulo="Rastrear cliques em CTAs"
              descricao="Adicione data-track='click' + data-event='nome_unico'. Cada CTA precisa de um data-event diferente pra você ver qual converte mais."
            />
            <CodeBlock code={exemploCta} onCopy={() => copiar(exemploCta)} />

            <SectionTitle
              numero="2"
              titulo="Conversão (botão de compra)"
              descricao="Use data-track='conversion'. O snippet captura o clique como evento de conversão."
            />
            <CodeBlock code={exemploConversao} onCopy={() => copiar(exemploConversao)} />

            <SectionTitle
              numero="3"
              titulo="Disparo manual"
              descricao="Para casos especiais (form submit, pixel pós-redirect, etc)."
            />
            <CodeBlock code={exemploManual} onCopy={() => copiar(exemploManual)} />
          </div>
        )}

        {/* ----- Aba 3: Página de obrigado ----- */}
        {aba === "obrigado" && (
          <div className="space-y-5">
            <CalloutInfo>
              Use só se você tem uma página de obrigado <strong>própria</strong> (não a do Hotmart).
              Pra vendas Hotmart, a atribuição já é automática — veja a aba seguinte.
            </CalloutInfo>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Produto</Label>
                <Input
                  value={produtoObrigado}
                  onChange={(e) => setProdutoObrigado(e.target.value)}
                  placeholder="Pós Junho"
                  className="mt-1.5 h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Valor padrão (R$)</Label>
                <Input
                  value={valorObrigado}
                  onChange={(e) => setValorObrigado(e.target.value)}
                  placeholder="497.00"
                  className="mt-1.5 h-9 font-mono"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
              <button
                onClick={() => setModoObrigado("atalho")}
                className={
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors " +
                  (modoObrigado === "atalho"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                Atalho (1 linha)
              </button>
              <button
                onClick={() => setModoObrigado("manual")}
                className={
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors " +
                  (modoObrigado === "manual"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                Manual (com valor dinâmico)
              </button>
            </div>

            {modoObrigado === "atalho" ? (
              <>
                <CodeBlock code={obrigadoAuto} onCopy={() => copiar(obrigadoAuto)} />
                <p className="text-[11px] text-muted-foreground">
                  Atalho registra <code>conversion</code> com o valor fixo acima sempre que a página carrega.
                </p>
              </>
            ) : (
              <>
                <CodeBlock code={obrigadoManual} onCopy={() => copiar(obrigadoManual)} />
                <p className="text-[11px] text-muted-foreground">
                  Use se o checkout pode passar o valor real via{" "}
                  <code className="px-1 py-0.5 rounded bg-muted text-[10.5px]">?valor=497</code> na URL.
                </p>
              </>
            )}
          </div>
        )}

        {/* ----- Aba 4: Vendas Hotmart ----- */}
        {aba === "hotmart" && (
          <div className="space-y-5">
            <CalloutSuccess>
              <strong>Automático.</strong> O snippet detecta links <code>pay.hotmart.com</code> e{" "}
              <code>go.hotmart.com</code> na página e adiciona <code>?src=...</code> com cn_aid + UTMs + CTA.
              Você não precisa mudar nada no HTML.
            </CalloutSuccess>

            <div>
              <SectionTitle
                numero="1"
                titulo="Como funciona"
                descricao="Sequência completa, do clique no anúncio até a venda atribuída."
              />
              <ol className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                {[
                  ["Visitante chega", "via link com ?utm_source=instagram&utm_campaign=lanc_jun"],
                  ["Snippet captura", "cria cn_aid (cookie 1 ano), salva UTMs na sessão"],
                  ["Visitante clica num CTA", "snippet lê data-event e injeta cta:cta_hero no src"],
                  ["Checkout recebe tudo", "Hotmart guarda src na venda automaticamente"],
                  ["Sync no DashCENAT", "venda aparece com UTM + CTA atribuídos"],
                ].map(([titulo, sub], i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-[10px] font-medium flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <span className="text-foreground font-medium">{titulo}</span>
                      <span className="text-muted-foreground"> — {sub}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <SectionTitle
              numero="2"
              titulo="Antes vs Depois"
              descricao="O snippet reescreve a URL em tempo real. Você não toca no HTML."
            />
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    No HTML
                  </span>
                </div>
                <CodeBlock
                  code={exemploHotmartAntes}
                  onCopy={() => copiar(exemploHotmartAntes)}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    No clique (DOM)
                  </span>
                </div>
                <CodeBlock
                  code={exemploHotmartDepois}
                  onCopy={() => copiar(exemploHotmartDepois)}
                />
              </div>
            </div>

            <SectionTitle
              numero="3"
              titulo="Construir link em JavaScript"
              descricao="Opcional. Use se gera links dinamicamente."
            />
            <CodeBlock
              code={exemploCenatBuild}
              onCopy={() => copiar(exemploCenatBuild)}
            />

            <CalloutWarn>
              <strong>Importante:</strong> se você já usa <code>src=</code> manual no link (ex: códigos
              de afiliado), o snippet <strong>não sobrescreve</strong> — respeita o valor existente.
            </CalloutWarn>
          </div>
        )}
      </div>

      {/* ====== Footer ====== */}
      <div className="border-t border-border/70 px-6 py-3 bg-muted/20">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground font-medium">O snippet faz sozinho:</strong>{" "}
          pageview, persiste UTMs, cria <code>anon_id</code> + <code>session_id</code>,
          captura cliques em <code>[data-track]</code>, dispara conversão com <code>data-conversion</code>,
          e reescreve checkouts Hotmart com <code>?src=</code> incluindo o CTA clicado.
        </p>
      </div>
    </SheetContent>
  );
}

// ============================================================
// Helpers visuais do Sheet
// ============================================================

function SectionTitle({
  numero,
  titulo,
  descricao,
}: {
  numero: string;
  titulo: string;
  descricao?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-md bg-foreground text-background text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
          {numero}
        </span>
        <h3 className="text-sm font-medium">{titulo}</h3>
      </div>
      {descricao && (
        <p className="text-xs text-muted-foreground pl-[30px] leading-relaxed">
          {descricao}
        </p>
      )}
    </div>
  );
}

function FeatureGrid() {
  const items = [
    { icon: "🔍", label: "Pageviews", sub: "A cada carregamento" },
    { icon: "🔗", label: "UTMs", sub: "Persistidos na sessão" },
    { icon: "🍪", label: "anon_id", sub: "Cookie 1 ano (cn_aid)" },
    { icon: "🖱", label: "Cliques", sub: "Em [data-track]" },
    { icon: "✅", label: "Conversões", sub: "Com [data-conversion]" },
    { icon: "🛒", label: "Hotmart", sub: "src= automático nos links" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
      {items.map((i) => (
        <div
          key={i.label}
          className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors"
        >
          <span className="text-base leading-none mt-0.5">{i.icon}</span>
          <div className="min-w-0">
            <div className="text-xs font-medium leading-tight">{i.label}</div>
            <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
              {i.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalloutInfo({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-foreground/80 leading-relaxed">
      {children}
    </div>
  );
}

function CalloutSuccess({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-foreground/80 leading-relaxed flex gap-2.5 items-start">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function CalloutWarn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground/80 leading-relaxed">
      {children}
    </div>
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
