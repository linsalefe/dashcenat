"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Activity,
  Bookmark,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Flame,
  Hash,
  Heart,
  Loader2,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  TrendingUp,
  TrendingDown,
  Type,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  DateRangePicker,
  type DateRange,
  dateRangeHelpers,
  presetRange,
} from "@/components/date-range-picker";
import { InstagramLogo } from "@/components/icons/instagram-logo";

// ============================================================
// Tipos
// ============================================================

interface Config {
  configurado: boolean;
  ativo: boolean;
  ig_user_id: string | null;
  username: string | null;
  page_id: string | null;
  access_token_mask: string | null;
  token_compartilhado_com_meta_ads: boolean;
  ultimo_sync: string | null;
  ultimo_sync_status: string | null;
  ultimo_sync_erro: string | null;
  ultimo_sync_total: number;
}

interface PaginaIG {
  page_id: string;
  page_name: string | null;
  instagram_business_account_id: string | null;
  ig_username: string | null;
  ig_profile_picture_url: string | null;
}

interface DiscoveryResp {
  paginas: PaginaIG[];
}

interface PostOut {
  media_id: string;
  media_type: string;
  media_product_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  timestamp_publicacao: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  total_interactions: number;
  profile_visits: number;
  follows: number;
  engagement_rate: number | null;
  plays?: number;
  clips_replays_count?: number;
  ig_reels_video_view_total_time?: number | null;
  ig_reels_avg_watch_time?: number | null;
}

interface SnapshotOut {
  data: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  total_interactions: number;
  profile_visits: number;
  follows: number;
}

interface PostDetail extends PostOut {
  snapshots: SnapshotOut[];
}

interface AudItem {
  chave: string;
  valor: number;
}

interface Stats {
  periodo_inicio: string;
  periodo_fim: string;
  followers_atual: number;
  followers_inicio_periodo: number;
  followers_ganhos_periodo: number;
  reach_total: number;
  profile_views_total: number;
  total_interactions: number;
  posts_publicados: number;
  serie_followers: { data: string; followers_count: number; follows_gained: number }[];
  serie_reach: {
    data: string;
    reach: number;
    profile_views: number;
    total_interactions: number;
  }[];
  top_posts_reach: PostOut[];
  top_posts_engagement: PostOut[];
  posts_por_tipo: Record<string, number>;
  reach_por_tipo: Record<string, number>;
  audience_genero_idade: AudItem[];
  audience_top_paises: AudItem[];
  audience_top_cidades: AudItem[];
  audience_top_idiomas: AudItem[];
  audience_age_gender: AudItem[];
  audience_genero: AudItem[];
}

interface StoryOut {
  story_id: string;
  media_type: string;
  thumbnail_url: string | null;
  media_url: string | null;
  permalink: string | null;
  timestamp_publicacao: string;
  reach: number;
  replies: number;
  taps_forward: number;
  taps_back: number;
  exits: number;
  swipe_forward: number;
  retencao_pct: number | null;
}

interface StoriesResp {
  total: number;
  reach_medio: number;
  retencao_media: number | null;
  replies_total: number;
  por_dia_semana: Record<string, { qtd: number; retencao_media: number }>;
  items: StoryOut[];
}

interface HeatmapCell {
  dia_semana: number;
  hora: number;
  valor: number;
  qtd_posts: number;
}

interface HeatmapResp {
  metric: string;
  matriz: HeatmapCell[];
  melhores: { dia_semana: number; hora: number; valor: number; qtd_posts: number }[];
}

interface HashtagPerf {
  hashtag: string;
  qtd_posts: number;
  reach_total: number;
  interactions_total: number;
  engagement_rate_media: number | null;
  melhor_media_id: string | null;
  melhor_permalink: string | null;
}

interface EngagementPorTipo {
  media_type: string;
  media_product_type: string | null;
  qtd: number;
  reach_medio: number;
  interactions_media: number;
  engagement_rate_pct: number | null;
  save_rate_pct: number | null;
  share_rate_pct: number | null;
}

interface CaptionFaixa {
  faixa: string;
  min_chars: number;
  max_chars: number | null;
  qtd: number;
  reach_medio: number;
  engagement_pct: number | null;
}

interface ComparativoMetric {
  atual: number;
  anterior: number;
  delta_abs: number;
  delta_pct: number | null;
}

interface ComparativoResp {
  periodo_a: { since: string; until: string };
  periodo_b: { since: string; until: string };
  followers_atual: ComparativoMetric;
  followers_ganhos: ComparativoMetric;
  reach_total: ComparativoMetric;
  profile_views: ComparativoMetric;
  total_interactions: ComparativoMetric;
  posts_publicados: ComparativoMetric;
  engagement_rate: ComparativoMetric;
}

interface VelocidadeMilestone {
  horas_pos_pub: number;
  snapshot_em: string;
  reach: number;
  total_interactions: number;
}

interface VelocidadeResp {
  media_id: string;
  publicado_em: string;
  milestones: VelocidadeMilestone[];
  reach_final: number;
  velocidade_24h: number | null;
  velocidade_48h: number | null;
  percentual_atingido_24h: number | null;
}

type Aba = "visao" | "posts" | "stories" | "audiencia";

// ============================================================
// Helpers
// ============================================================

const num = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

const pct = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : `${(v * 100).toFixed(casas)}%`;

const dtRelativo = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
};

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

const dataFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

const MEDIA_TYPES = ["TODOS", "IMAGE", "VIDEO", "REELS", "CAROUSEL_ALBUM"];

function tipoLabel(p: PostOut): string {
  if ((p.media_product_type || "").toUpperCase() === "REELS") return "REELS";
  return p.media_type;
}

function badgeColorPorTipo(tipo: string): string {
  const t = tipo.toUpperCase();
  if (t === "REELS") return "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400";
  if (t === "VIDEO") return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
  if (t === "CAROUSEL_ALBUM" || t === "CAROUSEL")
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400";
}

// ============================================================
// Página
// ============================================================

export default function InstagramPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange("este_mes"));
  const [aba, setAba] = useState<Aba>("visao");

  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const rangeIso = useMemo(
    () => ({
      since: dateRangeHelpers.isoDate(range.since),
      until: dateRangeHelpers.isoDate(range.until),
    }),
    [range],
  );

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api.get<Config>("/meta-instagram/config"),
        api
          .get<Stats>(
            `/meta-instagram/stats?since=${rangeIso.since}&until=${rangeIso.until}`,
          )
          .catch(() => null),
      ]);
      setConfig(c);
      setStats(s);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIso.since, rangeIso.until]);

  async function sincronizar(fullRefresh = false) {
    if (!config?.configurado) {
      toast.error("Configure o ig_user_id primeiro");
      setConfigOpen(true);
      return;
    }
    setSyncing(true);
    try {
      const res = await api.post<{
        ok: boolean;
        posts_processados: number;
        snapshots_criados: number;
        dias_conta_processados: number;
        audience_atualizada: boolean;
        erro: string | null;
      }>("/meta-instagram/sync", {
        since: rangeIso.since,
        until: rangeIso.until,
        full_refresh: fullRefresh,
      });
      if (res.ok) {
        toast.success(
          `Sync ok: ${res.posts_processados} posts, ${res.dias_conta_processados} dias`,
        );
      } else {
        toast.error(`Sync com erros: ${res.erro ?? "—"}`);
      }
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no sync");
    } finally {
      setSyncing(false);
    }
  }

  const isAdmin = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      return u?.papel === "admin";
    } catch {
      return false;
    }
  }, []);

  const ganhouPct =
    stats && stats.followers_inicio_periodo > 0
      ? stats.followers_ganhos_periodo / stats.followers_inicio_periodo
      : null;

  const taxaEngajamento =
    stats && stats.reach_total > 0
      ? stats.total_interactions / stats.reach_total
      : null;

  return (
    <div className="space-y-5">
      {/* ====== Header ====== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
            <InstagramLogo className="w-5 h-5 text-fuchsia-600 dark:text-fuchsia-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Instagram</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {config?.username ? `@${config.username}` : "Conta orgânica"} · Graph
              API v21
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={(r) => setRange(r)} />

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => sincronizar(false)}
              disabled={syncing}
              className="h-9"
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </Button>
          )}

          <Sheet open={configOpen} onOpenChange={setConfigOpen}>
            <SheetTrigger
              render={<Button size="sm" variant="outline" className="h-9" />}
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              Configurar
            </SheetTrigger>
            <ConfigSheet
              config={config}
              isAdmin={isAdmin}
              onSaved={() => {
                setConfigOpen(false);
                load();
              }}
            />
          </Sheet>
        </div>
      </div>

      {/* ====== Banners ====== */}
      {!config?.configurado && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong className="text-sm">Instagram não configurado</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                A conta precisa estar em modo Business/Creator, conectada a uma Página
                do Facebook e com a Página atribuída ao System User. Clique em
                Configurar e use &ldquo;Detectar contas&rdquo;.
              </p>
            </div>
            <Button size="sm" onClick={() => setConfigOpen(true)}>
              Configurar
            </Button>
          </div>
        </Card>
      )}

      {config?.configurado && config?.ultimo_sync_status === "erro" && (
        <Card className="p-4 border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong className="text-sm text-red-700 dark:text-red-400">
                Erro no último sync
              </strong>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
                {config.ultimo_sync_erro}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ====== Tabs ====== */}
      <div className="flex items-center gap-1 border-b border-border -mb-px overflow-x-auto">
        {([
          { key: "visao" as Aba, label: "Visão geral" },
          {
            key: "posts" as Aba,
            label: "Posts",
            sub: stats ? `${stats.posts_publicados} no período` : "",
          },
          { key: "stories" as Aba, label: "Stories" },
          { key: "audiencia" as Aba, label: "Audiência" },
        ]).map((t) => {
          const ativo = aba === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              className={
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap " +
                (ativo
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
              {t.sub && (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {t.sub}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {aba === "visao" && (
        <VisaoTab
          stats={stats}
          loading={loading}
          ganhouPct={ganhouPct}
          taxaEngajamento={taxaEngajamento}
          syncInfo={config}
          rangeIso={rangeIso}
        />
      )}

      {aba === "posts" && (
        <PostsTab
          rangeIso={rangeIso}
          loading={loading}
          totalPosts={stats?.posts_publicados ?? 0}
        />
      )}

      {aba === "stories" && <StoriesTab rangeIso={rangeIso} />}

      {aba === "audiencia" && <AudienciaTab stats={stats} loading={loading} />}
    </div>
  );
}

// ============================================================
// Tab: Visão geral
// ============================================================

function VisaoTab({
  stats,
  loading,
  ganhouPct,
  taxaEngajamento,
  syncInfo,
  rangeIso,
}: {
  stats: Stats | null;
  loading: boolean;
  ganhouPct: number | null;
  taxaEngajamento: number | null;
  syncInfo: Config | null;
  rangeIso: { since: string; until: string };
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-6 bg-gradient-to-br from-fuchsia-500/[0.07] via-orange-500/[0.02] to-transparent border-fuchsia-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-400 uppercase tracking-wide">
              <Users className="h-3.5 w-3.5" />
              Followers atuais
            </div>
            <div className="mt-3 text-4xl font-semibold tabular-nums tracking-tight">
              {loading ? (
                <span className="text-muted-foreground/40">…</span>
              ) : (
                num(stats?.followers_atual)
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-4 text-xs text-muted-foreground flex-wrap">
              <span>
                Ganho no período:{" "}
                <span
                  className={
                    (stats?.followers_ganhos_periodo ?? 0) >= 0
                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-red-700 dark:text-red-400 font-medium"
                  }
                >
                  {(stats?.followers_ganhos_periodo ?? 0) >= 0 ? "+" : ""}
                  {num(stats?.followers_ganhos_periodo)}
                </span>
              </span>
              {ganhouPct != null && (
                <span>
                  Variação:{" "}
                  <span className="text-foreground font-medium">
                    {pct(ganhouPct, 2)}
                  </span>
                </span>
              )}
              <span>
                Posts: <span className="text-foreground font-medium">{num(stats?.posts_publicados)}</span>
              </span>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
        </Card>

        <SyncInfoCard config={syncInfo} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPISmall
          icon={Eye}
          tone="sky"
          label="Alcance total"
          value={num(stats?.reach_total)}
          sub={stats ? `${stats.serie_reach.length} dias` : ""}
          loading={loading}
        />
        <KPISmall
          icon={UserPlus}
          tone="violet"
          label="Visualizações de perfil"
          value={num(stats?.profile_views_total)}
          loading={loading}
        />
        <KPISmall
          icon={Heart}
          tone="rose"
          label="Interações totais"
          value={num(stats?.total_interactions)}
          loading={loading}
        />
        <KPISmall
          icon={Activity}
          tone="emerald"
          label="Engajamento médio"
          value={taxaEngajamento != null ? pct(taxaEngajamento, 2) : "—"}
          sub="interações / alcance"
          loading={loading}
        />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-medium">Followers × Alcance diário</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats?.periodo_inicio} → {stats?.periodo_fim}
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-fuchsia-500"></span>
              Followers
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
              Alcance
            </span>
          </div>
        </div>
        <div className="h-72">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={(stats?.serie_followers ?? []).map((d, i) => ({
                  data: d.data,
                  followers_count: d.followers_count,
                  reach: stats?.serie_reach[i]?.reach ?? 0,
                }))}
              >
                <defs>
                  <linearGradient id="gradReachIg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="data"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(d: string) => d.slice(5)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="reach"
                  name="Alcance"
                  fill="url(#gradReachIg)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="left"
                  dataKey="followers_count"
                  name="Followers"
                  stroke="#d946ef"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, strokeWidth: 0, fill: "#d946ef" }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Breakdown por tipo */}
      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">Mix por tipo de mídia</h3>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : Object.keys(stats?.posts_por_tipo ?? {}).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">
            Sem posts no período.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats?.posts_por_tipo ?? {}).map(([tipo, qtd]) => {
              const reach = stats?.reach_por_tipo[tipo] ?? 0;
              return (
                <Card key={tipo} className="p-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${badgeColorPorTipo(tipo)}`}
                  >
                    {tipo}
                  </Badge>
                  <p className="text-2xl font-semibold tabular-nums mt-2">
                    {qtd}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {num(reach)} de alcance
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* Heatmap melhor horário */}
      <HeatmapBlock rangeIso={rangeIso} />

      {/* Engagement por tipo de mídia */}
      <EngagementPorTipoBlock rangeIso={rangeIso} />

      {/* Hashtags */}
      <HashtagsBlock rangeIso={rangeIso} />

      {/* Caption length */}
      <CaptionAnalysisBlock rangeIso={rangeIso} />

      {/* Comparação de períodos (toggle) */}
      <ComparativoBlock rangeIso={rangeIso} />

      {/* Top posts no período */}
      {stats && stats.top_posts_reach.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">Top posts por alcance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.top_posts_reach.slice(0, 6).map((p) => (
              <PostCard key={p.media_id} post={p} compact />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Tab: Posts
// ============================================================

function PostsTab({
  rangeIso,
  loading: _outerLoading,
  totalPosts,
}: {
  rangeIso: { since: string; until: string };
  loading: boolean;
  totalPosts: number;
}) {
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [ordenarPor, setOrdenarPor] = useState<
    "date" | "reach" | "interactions" | "engagement"
  >("date");
  const [busca, setBusca] = useState("");
  const [soWatchAlto, setSoWatchAlto] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    async function fetchPosts() {
      setLoadingPosts(true);
      try {
        const tipoQs =
          filtroTipo && filtroTipo !== "TODOS"
            ? `&media_type=${filtroTipo}`
            : "";
        const data = await api.get<PostOut[]>(
          `/meta-instagram/posts?since=${rangeIso.since}&until=${rangeIso.until}&ordenar_por=${ordenarPor}&limit=200${tipoQs}`,
        );
        if (!cancel) setPosts(data);
      } catch (e: unknown) {
        if (!cancel)
          toast.error(e instanceof Error ? e.message : "Erro ao carregar posts");
      } finally {
        if (!cancel) setLoadingPosts(false);
      }
    }
    fetchPosts();
    return () => {
      cancel = true;
    };
  }, [rangeIso.since, rangeIso.until, filtroTipo, ordenarPor]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let out = posts;
    if (q) out = out.filter((p) => (p.caption ?? "").toLowerCase().includes(q));
    if (soWatchAlto) {
      out = out.filter(
        (p) =>
          (p.media_product_type || "").toUpperCase() === "REELS" &&
          (p.ig_reels_avg_watch_time ?? 0) >= 10000,
      );
    }
    return out;
  }, [posts, busca, soWatchAlto]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 flex-wrap">
            {MEDIA_TYPES.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={filtroTipo === t ? "default" : "outline"}
                onClick={() => setFiltroTipo(t)}
                className="h-7 text-xs"
              >
                {t === "CAROUSEL_ALBUM" ? "Carrossel" : t}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground mr-1">Ordenar:</span>
            {([
              { v: "date", l: "Data" },
              { v: "reach", l: "Alcance" },
              { v: "interactions", l: "Interações" },
              { v: "engagement", l: "Engajamento" },
            ] as const).map((o) => (
              <Button
                key={o.v}
                size="sm"
                variant={ordenarPor === o.v ? "default" : "ghost"}
                onClick={() => setOrdenarPor(o.v)}
                className="h-7 text-xs"
              >
                {o.l}
              </Button>
            ))}
          </div>

          <div className="relative w-full md:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar na legenda…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 w-full md:w-[260px]"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto md:ml-0">
            <input
              type="checkbox"
              checked={soWatchAlto}
              onChange={(e) => setSoWatchAlto(e.target.checked)}
              className="rounded"
            />
            REELS com watch ≥ 10s
          </label>
        </div>
      </Card>

      {loadingPosts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px] w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {totalPosts === 0
              ? "Sem posts no período. Sincronize ou ajuste o range."
              : "Nenhum post bate com os filtros."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((p) => (
            <PostCard
              key={p.media_id}
              post={p}
              onClick={() => setDetalheId(p.media_id)}
            />
          ))}
        </div>
      )}

      <PostDetailDialog
        mediaId={detalheId}
        onClose={() => setDetalheId(null)}
      />
    </div>
  );
}

// ============================================================
// Tab: Audiência
// ============================================================

function AudienciaTab({
  stats,
  loading,
}: {
  stats: Stats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const semDados =
    !stats ||
    (stats.audience_genero_idade.length === 0 &&
      stats.audience_top_paises.length === 0 &&
      stats.audience_top_cidades.length === 0 &&
      stats.audience_genero.length === 0);

  if (semDados) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Sem dados de audiência ainda. Os dados demográficos são consolidados no
          primeiro sync e atualizam 1x por dia.
        </p>
      </Card>
    );
  }

  const ageGenderDisponivel = (stats?.audience_age_gender?.length ?? 0) > 0;
  const maxIdade = Math.max(1, ...stats!.audience_genero_idade.map((x) => x.valor));
  const generoTotais = stats!.audience_genero;
  const generoSum = generoTotais.reduce((acc, x) => acc + x.valor, 0) || 1;

  const corGenero = (g: string) =>
    g === "F" ? "bg-fuchsia-500/70" : g === "M" ? "bg-sky-500/70" : "bg-zinc-500/70";

  // Cross-tab age × gender quando disponível (Meta às vezes rejeita esse breakdown)
  // Item.chave costuma vir como "18-24.F" — quebro em [age, gender].
  const ageGenderRows = ageGenderDisponivel
    ? agruparAgeGender(stats!.audience_age_gender)
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 md:col-span-2">
        <h3 className="text-sm font-medium mb-3">
          {ageGenderRows ? "Idade × Gênero" : "Idade"}
          {!ageGenderRows && (
            <span className="ml-2 text-[10px] text-muted-foreground">
              (Meta não retornou cross-tab — mostrando idade agregada)
            </span>
          )}
        </h3>
        {ageGenderRows ? (
          <div className="space-y-2">
            {ageGenderRows.map(({ idade, total, porGenero }) => (
              <div key={idade} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-muted-foreground tabular-nums">
                  {idade}
                </span>
                <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden flex">
                  {Object.entries(porGenero).map(([g, v]) => (
                    <div
                      key={g}
                      className={corGenero(g)}
                      style={{ width: `${(v / total) * 100}%` }}
                      title={`${g === "F" ? "Feminino" : g === "M" ? "Masculino" : g}: ${num(v)}`}
                    />
                  ))}
                </div>
                <span className="w-20 text-right tabular-nums">{num(total)}</span>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-fuchsia-500/70" />
                Feminino
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/70" />
                Masculino
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-zinc-500/70" />
                Outro/Não informado
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {stats!.audience_genero_idade.slice(0, 20).map((x) => (
              <div key={x.chave} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-muted-foreground tabular-nums">
                  {x.chave}
                </span>
                <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-fuchsia-500/70"
                    style={{ width: `${(x.valor / maxIdade) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right tabular-nums">
                  {num(x.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {generoTotais.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">Gênero</h3>
          <div className="space-y-2">
            {generoTotais.map((x) => {
              const pct = (x.valor / generoSum) * 100;
              const label =
                x.chave === "F"
                  ? "Feminino"
                  : x.chave === "M"
                    ? "Masculino"
                    : x.chave === "U"
                      ? "Não informado"
                      : x.chave;
              return (
                <div key={x.chave} className="flex items-center gap-2 text-xs">
                  <span className="w-28 text-muted-foreground">{label}</span>
                  <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${corGenero(x.chave)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-20 text-right tabular-nums">
                    {num(x.valor)} ({pct.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">Top países</h3>
        <ListaSimples items={stats!.audience_top_paises.slice(0, 10)} />
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">Top cidades</h3>
        <ListaSimples items={stats!.audience_top_cidades.slice(0, 10)} />
      </Card>
    </div>
  );
}

function agruparAgeGender(
  items: AudItem[],
): { idade: string; total: number; porGenero: Record<string, number> }[] {
  const grupos: Record<string, { porGenero: Record<string, number>; total: number }> = {};
  for (const x of items) {
    const partes = x.chave.split(".");
    // Pode vir "18-24.F" ou "F.18-24" — tento detectar qual é qual.
    let idade: string;
    let genero: string;
    if (partes.length >= 2) {
      const ehIdade = (s: string) => /^\d/.test(s) || s === "65+";
      if (ehIdade(partes[0])) {
        idade = partes[0];
        genero = partes[1];
      } else {
        idade = partes[1];
        genero = partes[0];
      }
    } else {
      continue;
    }
    if (!grupos[idade]) grupos[idade] = { porGenero: {}, total: 0 };
    grupos[idade].porGenero[genero] = (grupos[idade].porGenero[genero] ?? 0) + x.valor;
    grupos[idade].total += x.valor;
  }
  // ordenar por faixa etária
  const ordem = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  return Object.entries(grupos)
    .sort(
      ([a], [b]) =>
        (ordem.indexOf(a) === -1 ? 99 : ordem.indexOf(a)) -
        (ordem.indexOf(b) === -1 ? 99 : ordem.indexOf(b)),
    )
    .map(([idade, dados]) => ({ idade, total: dados.total, porGenero: dados.porGenero }));
}

function ListaSimples({ items }: { items: AudItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  }
  const total = items.reduce((acc, x) => acc + x.valor, 0) || 1;
  return (
    <div className="space-y-1.5">
      {items.map((x) => (
        <div
          key={x.chave}
          className="flex items-center justify-between text-xs gap-2"
        >
          <span className="truncate" title={x.chave}>
            {x.chave}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {num(x.valor)} ({((x.valor / total) * 100).toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PostCard
// ============================================================

function PostCard({
  post,
  onClick,
  compact,
}: {
  post: PostOut;
  onClick?: () => void;
  compact?: boolean;
}) {
  const tipo = tipoLabel(post);
  const dataPost = new Date(post.timestamp_publicacao).toLocaleDateString(
    "pt-BR",
    { day: "2-digit", month: "short" },
  );

  return (
    <Card
      className={`overflow-hidden flex flex-col ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
      <div className="aspect-square bg-muted relative">
        {post.thumbnail_url || post.media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url || post.media_url || ""}
            alt={post.caption ?? ""}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <InstagramLogo className="h-8 w-8 opacity-30" />
          </div>
        )}
        <Badge
          variant="outline"
          className={`absolute top-2 left-2 text-[10px] ${badgeColorPorTipo(tipo)}`}
        >
          {tipo === "CAROUSEL_ALBUM" ? "CARROSSEL" : tipo}
        </Badge>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md p-1 hover:bg-background"
            title="Ver no Instagram"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <p className="text-xs text-muted-foreground mb-1.5">{dataPost}</p>
        <p className="text-xs leading-snug line-clamp-3 mb-3 min-h-[3rem]">
          {truncate(post.caption, 200) || (
            <span className="text-muted-foreground italic">Sem legenda</span>
          )}
        </p>

        <div
          className={`grid grid-cols-${
            compact ? "3" : "5"
          } gap-2 text-[11px] tabular-nums mt-auto`}
        >
          <StatMini icon={Eye} v={post.reach} />
          <StatMini icon={Heart} v={post.likes} />
          <StatMini icon={MessageCircle} v={post.comments} />
          {!compact && <StatMini icon={Bookmark} v={post.saved} />}
          {!compact && <StatMini icon={Repeat} v={post.shares} />}
        </div>

        {post.engagement_rate != null && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Engajamento:{" "}
            <span className="text-foreground font-medium">
              {pct(post.engagement_rate, 2)}
            </span>
            {tipo === "REELS" && (post.ig_reels_avg_watch_time ?? 0) > 0 && (
              <span className="ml-2">
                · watch{" "}
                <span className="text-foreground font-medium">
                  {formatWatchTime(post.ig_reels_avg_watch_time)}
                </span>
              </span>
            )}
          </p>
        )}
      </div>
    </Card>
  );
}

function StatMini({
  icon: Icon,
  v,
}: {
  icon: React.ComponentType<{ className?: string }>;
  v: number;
}) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <Icon className="h-3 w-3" />
      {num(v)}
    </span>
  );
}

// ============================================================
// Dialog de detalhe do post
// ============================================================

function PostDetailDialog({
  mediaId,
  onClose,
}: {
  mediaId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mediaId) {
      setDetail(null);
      return;
    }
    let cancel = false;
    setLoading(true);
    api
      .get<PostDetail>(`/meta-instagram/post/${mediaId}`)
      .then((d) => {
        if (!cancel) setDetail(d);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar detalhe");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [mediaId]);

  return (
    <Dialog open={mediaId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Detalhes do post</DialogTitle>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
              <div className="aspect-square bg-muted rounded-md overflow-hidden">
                {detail.thumbnail_url || detail.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail.thumbnail_url || detail.media_url || ""}
                    alt={detail.caption ?? ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <InstagramLogo className="h-10 w-10 opacity-30" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${badgeColorPorTipo(tipoLabel(detail))}`}
                  >
                    {tipoLabel(detail) === "CAROUSEL_ALBUM"
                      ? "CARROSSEL"
                      : tipoLabel(detail)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {dt(detail.timestamp_publicacao)}
                  </span>
                  {detail.permalink && (
                    <a
                      href={detail.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      Ver no Instagram <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <p className="text-xs whitespace-pre-line max-h-32 overflow-y-auto">
                  {detail.caption || (
                    <span className="text-muted-foreground italic">
                      Sem legenda
                    </span>
                  )}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <StatRow l="Alcance" v={detail.reach} />
                  <StatRow l="Visualizações" v={detail.views} />
                  <StatRow l="Curtidas" v={detail.likes} />
                  <StatRow l="Comentários" v={detail.comments} />
                  <StatRow l="Compartilhamentos" v={detail.shares} />
                  <StatRow l="Salvos" v={detail.saved} />
                  <StatRow l="Visitas ao perfil" v={detail.profile_visits} />
                  <StatRow l="Follows gerados" v={detail.follows} />
                  <StatRow
                    l="Interações totais"
                    v={detail.total_interactions}
                  />
                  <StatRow
                    l="Engajamento"
                    v={pct(detail.engagement_rate, 2)}
                  />
                </div>
              </div>
            </div>

            {tipoLabel(detail) === "REELS" && (
              <ReelsMetricsBlock detail={detail} />
            )}

            <VelocidadeBlock mediaId={detail.media_id} reachFinal={detail.reach} />

            {detail.snapshots.length > 1 && (
              <Card className="p-4">
                <h4 className="text-xs font-medium mb-2">
                  Evolução nos primeiros dias
                </h4>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={detail.snapshots}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="data"
                        fontSize={10}
                        tickFormatter={(d: string) => dataFmt(d)}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                      <Line
                        dataKey="reach"
                        name="Alcance"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        dataKey="total_interactions"
                        name="Interações"
                        stroke="#d946ef"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatRow({ l, v }: { l: string; v: number | string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/40 py-1">
      <span className="text-muted-foreground">{l}</span>
      <span className="tabular-nums font-medium">
        {typeof v === "number" ? num(v) : v}
      </span>
    </div>
  );
}

// ============================================================
// KPI small
// ============================================================

const TONES: Record<string, { bg: string; text: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  sky: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400" },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
  },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
};

function KPISmall({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TONES;
  loading: boolean;
}) {
  const t = TONES[tone];
  return (
    <Card className="p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${t.bg}`}
        >
          <Icon className={`w-4 h-4 ${t.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          <p
            className="text-lg font-semibold tabular-nums mt-0.5 truncate"
            title={value}
          >
            {loading ? "…" : value}
          </p>
          {sub && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {sub}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// SyncInfoCard
// ============================================================

function SyncInfoCard({ config }: { config: Config | null }) {
  if (!config) {
    return (
      <Card className="p-4">
        <div className="text-xs text-muted-foreground">Carregando…</div>
      </Card>
    );
  }

  const naoConfig = !config.configurado;
  const erro = config.ultimo_sync_status === "erro";
  const parcial = config.ultimo_sync_status === "parcial";

  return (
    <Card
      className={`p-4 ${
        naoConfig
          ? "border-amber-500/30"
          : erro
            ? "border-red-500/30"
            : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status do sync
        </span>
        {naoConfig ? (
          <Badge
            variant="outline"
            className="text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px]"
          >
            <XCircle className="mr-1 h-2.5 w-2.5" />
            não config.
          </Badge>
        ) : erro ? (
          <Badge
            variant="outline"
            className="text-red-700 dark:text-red-400 border-red-500/40 text-[10px]"
          >
            <XCircle className="mr-1 h-2.5 w-2.5" />
            erro
          </Badge>
        ) : parcial ? (
          <Badge
            variant="outline"
            className="text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px]"
          >
            <AlertCircle className="mr-1 h-2.5 w-2.5" />
            parcial
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-emerald-700 dark:text-emerald-400 border-emerald-500/40 text-[10px]"
          >
            <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
            ok
          </Badge>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">
              Último sync
            </div>
            <div className="text-xs font-medium" title={dt(config.ultimo_sync)}>
              {config.ultimo_sync ? dtRelativo(config.ultimo_sync) : "—"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">
              Posts processados
            </div>
            <div className="text-xs font-medium">
              {num(config.ultimo_sync_total)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">
              Agendado
            </div>
            <div className="text-xs font-medium">a cada 6h · últimos 7d</div>
          </div>
        </div>

        {config.token_compartilhado_com_meta_ads && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Zap className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="text-[11px] text-muted-foreground">
              Token reusado do Meta Ads
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Sheet de configuração
// ============================================================

function ConfigSheet({
  config,
  isAdmin,
  onSaved,
}: {
  config: Config | null;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [pageId, setPageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [paginas, setPaginas] = useState<PaginaIG[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [fullRefresh, setFullRefresh] = useState(false);

  useEffect(() => {
    if (config?.ig_user_id) setIgUserId(config.ig_user_id);
    if (config?.page_id) setPageId(config.page_id);
  }, [config]);

  async function detectar() {
    setDiscovering(true);
    setPaginas(null);
    try {
      // Se usuário acabou de colar token, salva primeiro
      if (accessToken.trim() && isAdmin) {
        await api.put("/meta-instagram/config", {
          access_token: accessToken.trim(),
          ativo: true,
        });
      }
      const res = await api.get<DiscoveryResp>("/meta-instagram/discover");
      setPaginas(res.paginas);
      const comIg = res.paginas.filter((p) => p.instagram_business_account_id);
      toast.success(
        `${res.paginas.length} páginas — ${comIg.length} com IG vinculado`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha em /discover");
    } finally {
      setDiscovering(false);
    }
  }

  function selecionar(p: PaginaIG) {
    if (!p.instagram_business_account_id) return;
    setIgUserId(p.instagram_business_account_id);
    setPageId(p.page_id);
    toast.success(
      `Selecionado: @${p.ig_username ?? "—"} (${p.instagram_business_account_id})`,
    );
  }

  async function salvar() {
    if (!isAdmin) {
      toast.error("Apenas admins podem alterar credenciais");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ativo: true };
      if (accessToken.trim()) body.access_token = accessToken.trim();
      if (igUserId.trim()) body.ig_user_id = igUserId.trim();
      if (pageId.trim()) body.page_id = pageId.trim();
      await api.put("/meta-instagram/config", body);
      toast.success("Configuração salva");
      setAccessToken("");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function sincronizarAgora() {
    setSyncing(true);
    try {
      const res = await api.post<{
        ok: boolean;
        posts_processados: number;
        snapshots_criados: number;
        erro: string | null;
      }>("/meta-instagram/sync", { full_refresh: fullRefresh });
      if (res.ok) {
        toast.success(
          `Sync: ${res.posts_processados} posts · ${res.snapshots_criados} snapshots`,
        );
        onSaved();
      } else {
        toast.error(`Sync falhou: ${res.erro ?? "—"}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no sync");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Configurar Instagram</SheetTitle>
      </SheetHeader>

      <input
        type="text"
        name="username"
        autoComplete="username"
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />

      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          A conta precisa estar em modo Business/Creator, conectada a uma Página do
          Facebook e a Página atribuída ao System User com permissão
          <code className="px-1 py-0.5 mx-1 rounded bg-muted text-[10.5px]">
            instagram_basic
          </code>
          e
          <code className="px-1 py-0.5 mx-1 rounded bg-muted text-[10.5px]">
            instagram_manage_insights
          </code>
          .
        </p>

        {!isAdmin && (
          <Card className="p-3 border-amber-500/40 bg-amber-500/5">
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Apenas admins podem alterar credenciais.
            </p>
          </Card>
        )}

        <div>
          <Label className="text-xs">
            Access Token{" "}
            {config?.access_token_mask && (
              <span className="text-muted-foreground ml-2 font-mono">
                atual: {config.access_token_mask}
              </span>
            )}
            {config?.token_compartilhado_com_meta_ads && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                herdado do Meta Ads
              </Badge>
            )}
          </Label>
          <Input
            name="ig_at"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={
              config?.token_compartilhado_com_meta_ads
                ? "(deixe vazio pra continuar usando token do Meta Ads)"
                : config?.access_token_mask
                  ? "(manter atual)"
                  : "Cole um token (opcional)"
            }
            className="font-mono text-xs"
            disabled={!isAdmin}
          />
        </div>

        <div className="space-y-2">
          <Button
            onClick={detectar}
            disabled={discovering || !isAdmin}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {discovering ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Detectando…
              </>
            ) : (
              <>
                <Search className="mr-2 h-3.5 w-3.5" />
                Detectar contas
              </>
            )}
          </Button>

          {paginas && (
            <Card className="p-3 bg-muted/30">
              <p className="text-[11px] font-medium mb-2">
                {paginas.length} página{paginas.length !== 1 ? "s" : ""} no token:
              </p>
              <ul className="space-y-1.5 text-[11px]">
                {paginas.map((p) => (
                  <li
                    key={p.page_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.page_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        page {p.page_id}
                        {p.instagram_business_account_id ? (
                          <>
                            {" · "}@{p.ig_username} (ig{" "}
                            {p.instagram_business_account_id})
                          </>
                        ) : (
                          <span className="text-amber-600">
                            {" "}
                            (sem IG vinculado)
                          </span>
                        )}
                      </div>
                    </div>
                    {p.instagram_business_account_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selecionar(p)}
                        className="h-6 text-[10px]"
                      >
                        Selecionar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div>
          <Label className="text-xs">IG User ID</Label>
          <Input
            value={igUserId}
            onChange={(e) => setIgUserId(e.target.value)}
            placeholder="178..."
            className="font-mono text-xs"
            disabled={!isAdmin}
          />
        </div>

        <div>
          <Label className="text-xs">Page ID (opcional)</Label>
          <Input
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="ID da Página FB vinculada"
            className="font-mono text-xs"
            disabled={!isAdmin}
          />
        </div>

        <Button
          onClick={salvar}
          disabled={saving || !isAdmin || !igUserId.trim()}
          size="sm"
          className="w-full"
        >
          {saving ? "Salvando…" : "Salvar"}
        </Button>

        <div className="border-t pt-4 space-y-3">
          <p className="text-xs font-medium">Sincronizar agora</p>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={fullRefresh}
              onChange={(e) => setFullRefresh(e.target.checked)}
              className="rounded"
            />
            Sync completo (últimos 90 dias + todos os posts)
          </label>
          <Button
            onClick={sincronizarAgora}
            disabled={syncing || !isAdmin || !config?.configurado}
            size="sm"
            className="w-full"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Sincronizando…
              </>
            ) : (
              "Rodar agora"
            )}
          </Button>
        </div>
      </div>
    </SheetContent>
  );
}

// ============================================================
// Tab: Stories
// ============================================================

const DOW_LABEL: Record<string, string> = {
  dom: "Dom",
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
};

function StoriesTab({ rangeIso }: { rangeIso: { since: string; until: string } }) {
  const [data, setData] = useState<StoriesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroBaixaRetencao, setFiltroBaixaRetencao] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get<StoriesResp>(
        `/meta-instagram/stories?since=${rangeIso.since}&until=${rangeIso.until}`,
      )
      .then((d) => {
        if (!cancel) setData(d);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar stories");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [rangeIso.since, rangeIso.until]);

  const items = useMemo(() => {
    if (!data) return [];
    return filtroBaixaRetencao
      ? data.items.filter((s) => (s.retencao_pct ?? 100) < 50)
      : data.items;
  }, [data, filtroBaixaRetencao]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16]" />
        ))}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Sem stories no período. O sync automático roda a cada 2h enquanto os
          stories estão ativos (expiram em 24h).
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPISmall
          icon={Eye}
          tone="sky"
          label="Reach médio"
          value={num(Math.round(data.reach_medio))}
          sub={`${data.total} stories`}
          loading={false}
        />
        <KPISmall
          icon={Activity}
          tone="emerald"
          label="Retenção média"
          value={data.retencao_media != null ? `${data.retencao_media.toFixed(1)}%` : "—"}
          sub="100% - exits/reach"
          loading={false}
        />
        <KPISmall
          icon={MessageCircle}
          tone="violet"
          label="Replies totais"
          value={num(data.replies_total)}
          loading={false}
        />
        <KPISmall
          icon={Clock}
          tone="rose"
          label="Stories"
          value={String(data.total)}
          sub="no período"
          loading={false}
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-medium">Retenção média por dia da semana</h3>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={filtroBaixaRetencao}
              onChange={(e) => setFiltroBaixaRetencao(e.target.checked)}
              className="rounded"
            />
            Só retenção &lt; 50%
          </label>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {(["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const).map((d) => {
            const bucket = data.por_dia_semana[d] ?? { qtd: 0, retencao_media: 0 };
            const cor =
              bucket.qtd === 0
                ? "bg-muted text-muted-foreground/40"
                : bucket.retencao_media >= 70
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : bucket.retencao_media >= 50
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400";
            return (
              <div
                key={d}
                className={`rounded-md p-3 text-center ${cor}`}
                title={`${bucket.qtd} stories · retenção média ${bucket.retencao_media.toFixed(1)}%`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70">
                  {DOW_LABEL[d]}
                </div>
                <div className="text-lg font-semibold tabular-nums mt-1">
                  {bucket.qtd === 0 ? "—" : `${bucket.retencao_media.toFixed(0)}%`}
                </div>
                <div className="text-[10px] opacity-70">{bucket.qtd} st.</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((s) => (
          <StoryCard key={s.story_id} story={s} />
        ))}
      </div>
    </div>
  );
}

function StoryCard({ story }: { story: StoryOut }) {
  const baixaRetencao = (story.retencao_pct ?? 100) < 50;
  const dataPost = new Date(story.timestamp_publicacao).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Card
      className={`overflow-hidden flex flex-col ${
        baixaRetencao ? "border-amber-500/50" : ""
      }`}
    >
      <div className="aspect-[9/16] bg-muted relative">
        {story.thumbnail_url || story.media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.thumbnail_url || story.media_url || ""}
            alt={`Story ${story.story_id}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <InstagramLogo className="h-8 w-8 opacity-30" />
          </div>
        )}
        {baixaRetencao && (
          <Badge
            variant="outline"
            className="absolute top-2 left-2 text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
          >
            <TrendingDown className="mr-1 h-2.5 w-2.5" />
            queda
          </Badge>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[11px] text-muted-foreground">{dataPost}</p>
        <div className="grid grid-cols-2 gap-1 text-[11px] tabular-nums">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Eye className="h-3 w-3" /> {num(story.reach)}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <MessageCircle className="h-3 w-3" /> {num(story.replies)}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            exits {num(story.exits)}
          </span>
          <span
            className={`tabular-nums ${
              baixaRetencao
                ? "text-amber-700 dark:text-amber-400 font-medium"
                : "text-emerald-700 dark:text-emerald-400 font-medium"
            }`}
          >
            {story.retencao_pct != null ? `${story.retencao_pct}%` : "—"}
          </span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Visão geral: Heatmap melhor horário
// ============================================================

const DOW_PT_LONG = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function HeatmapBlock({ rangeIso }: { rangeIso: { since: string; until: string } }) {
  const [data, setData] = useState<HeatmapResp | null>(null);
  const [metric, setMetric] = useState<"engagement" | "reach" | "interactions" | "saves">(
    "engagement",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get<HeatmapResp>(
        `/meta-instagram/heatmap?since=${rangeIso.since}&until=${rangeIso.until}&metric=${metric}`,
      )
      .then((d) => {
        if (!cancel) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [rangeIso.since, rangeIso.until, metric]);

  const matrizMap = useMemo(() => {
    const m = new Map<string, HeatmapCell>();
    for (const c of data?.matriz ?? []) {
      m.set(`${c.dia_semana}-${c.hora}`, c);
    }
    return m;
  }, [data]);

  const maxValor = Math.max(0.0001, ...(data?.matriz ?? []).map((c) => c.valor));

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-medium">Melhor horário pra postar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Média de {metric} por dia da semana × hora (fuso BR)
          </p>
        </div>
        <div className="flex gap-1">
          {([
            { v: "engagement", l: "Engaj." },
            { v: "interactions", l: "Interações" },
            { v: "reach", l: "Alcance" },
            { v: "saves", l: "Saves" },
          ] as const).map((o) => (
            <Button
              key={o.v}
              size="sm"
              variant={metric === o.v ? "default" : "ghost"}
              onClick={() => setMetric(o.v)}
              className="h-7 text-xs"
            >
              {o.l}
            </Button>
          ))}
        </div>
      </div>

      {data && data.melhores.length > 0 && (
        <div className="mb-3 text-xs flex items-center gap-2 flex-wrap">
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-muted-foreground">Top 3:</span>
          {data.melhores.map((m, i) => (
            <Badge key={i} variant="outline" className="text-[11px]">
              {DOW_PT_LONG[m.dia_semana]} {m.hora}h
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-grid gap-px" style={{ gridTemplateColumns: "auto repeat(24, minmax(18px, 1fr))" }}>
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="text-[9px] text-muted-foreground text-center tabular-nums"
              >
                {h}
              </div>
            ))}
            {DOW_PT_LONG.map((label, dow) => (
              <FragmentRow
                key={dow}
                label={label}
                dow={dow}
                map={matrizMap}
                maxValor={maxValor}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FragmentRow({
  label,
  dow,
  map,
  maxValor,
}: {
  label: string;
  dow: number;
  map: Map<string, HeatmapCell>;
  maxValor: number;
}) {
  return (
    <>
      <div className="text-[10px] text-muted-foreground pr-2 flex items-center">
        {label}
      </div>
      {Array.from({ length: 24 }).map((_, h) => {
        const cell = map.get(`${dow}-${h}`);
        if (!cell || cell.qtd_posts === 0) {
          return <div key={h} className="aspect-square bg-muted/40 rounded-sm" />;
        }
        const intensidade = cell.valor / maxValor;
        const insuficiente = cell.qtd_posts < 2;
        return (
          <div
            key={h}
            className={`aspect-square rounded-sm ${
              insuficiente ? "bg-zinc-400/30" : ""
            }`}
            style={
              !insuficiente
                ? { backgroundColor: `rgba(16, 185, 129, ${0.15 + intensidade * 0.75})` }
                : undefined
            }
            title={`${DOW_PT_LONG[dow]} ${h}h: ${cell.valor.toFixed(1)} (${cell.qtd_posts} posts)${insuficiente ? " — dados insuficientes" : ""}`}
          />
        );
      })}
    </>
  );
}

// ============================================================
// Visão geral: Engagement por tipo
// ============================================================

function EngagementPorTipoBlock({
  rangeIso,
}: {
  rangeIso: { since: string; until: string };
}) {
  const [rows, setRows] = useState<EngagementPorTipo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get<EngagementPorTipo[]>(
        `/meta-instagram/engagement-por-tipo?since=${rangeIso.since}&until=${rangeIso.until}`,
      )
      .then((d) => {
        if (!cancel) setRows(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [rangeIso.since, rangeIso.until]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (rows.length === 0) return null;

  const melhorIdx = rows.reduce(
    (best, r, i) =>
      (r.engagement_rate_pct ?? -1) > (rows[best].engagement_rate_pct ?? -1) ? i : best,
    0,
  );

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-3">Engagement por tipo de mídia</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-2 px-2">Tipo</th>
              <th className="text-right py-2 px-2">Posts</th>
              <th className="text-right py-2 px-2">Reach médio</th>
              <th className="text-right py-2 px-2">Engagement</th>
              <th className="text-right py-2 px-2">Save rate</th>
              <th className="text-right py-2 px-2">Share rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tipo =
                (r.media_product_type || "").toUpperCase() === "REELS"
                  ? "REELS"
                  : r.media_type;
              return (
                <tr
                  key={`${r.media_type}-${r.media_product_type ?? ""}`}
                  className={
                    "border-b last:border-0 " +
                    (i === melhorIdx
                      ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                      : "")
                  }
                >
                  <td className="py-2 px-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${badgeColorPorTipo(tipo)}`}
                    >
                      {tipo === "CAROUSEL_ALBUM" ? "CARROSSEL" : tipo}
                    </Badge>
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">{r.qtd}</td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {num(Math.round(r.reach_medio))}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums font-medium">
                    {r.engagement_rate_pct != null
                      ? `${r.engagement_rate_pct.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {r.save_rate_pct != null ? `${r.save_rate_pct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {r.share_rate_pct != null ? `${r.share_rate_pct.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Visão geral: Hashtags
// ============================================================

function HashtagsBlock({ rangeIso }: { rangeIso: { since: string; until: string } }) {
  const [rows, setRows] = useState<HashtagPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get<HashtagPerf[]>(
        `/meta-instagram/hashtags?since=${rangeIso.since}&until=${rangeIso.until}&limit=20`,
      )
      .then((d) => {
        if (!cancel) setRows(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [rangeIso.since, rangeIso.until]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (rows.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Hash className="h-4 w-4" /> Hashtags
        </h3>
        <p className="text-xs text-muted-foreground">
          Nenhuma hashtag usada em 2+ posts no período. Hashtags são extraídas
          automaticamente das captions a cada sync.
        </p>
      </Card>
    );
  }

  const maxEngajamento = Math.max(
    ...rows.map((r) => r.engagement_rate_media ?? 0),
    0.0001,
  );

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Hash className="h-4 w-4" /> Hashtags (top {rows.length} por engajamento)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-2 px-2">Hashtag</th>
              <th className="text-right py-2 px-2">Usos</th>
              <th className="text-right py-2 px-2">Reach</th>
              <th className="text-right py-2 px-2">Engaj. médio</th>
              <th className="py-2 px-2 w-32"></th>
              <th className="text-right py-2 px-2">Melhor post</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const eng = r.engagement_rate_media ?? 0;
              return (
                <tr key={r.hashtag} className="border-b last:border-0">
                  <td className="py-2 px-2 font-mono text-[11px]">#{r.hashtag}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{r.qtd_posts}</td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {num(r.reach_total)}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums font-medium">
                    {pct(r.engagement_rate_media, 2)}
                  </td>
                  <td className="py-2 px-2">
                    <div className="h-2 bg-muted rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-fuchsia-500/60"
                        style={{ width: `${(eng / maxEngajamento) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="text-right py-2 px-2">
                    {r.melhor_permalink ? (
                      <a
                        href={r.melhor_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center"
                        title="Abrir post"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Visão geral: Caption length × engagement
// ============================================================

function CaptionAnalysisBlock({
  rangeIso,
}: {
  rangeIso: { since: string; until: string };
}) {
  const [rows, setRows] = useState<CaptionFaixa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get<CaptionFaixa[]>(
        `/meta-instagram/caption-analysis?since=${rangeIso.since}&until=${rangeIso.until}`,
      )
      .then((d) => {
        if (!cancel) setRows(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [rangeIso.since, rangeIso.until]);

  if (loading) return <Skeleton className="h-36 w-full" />;
  if (rows.length === 0 || rows.every((r) => r.qtd === 0)) return null;

  const max = Math.max(...rows.map((r) => r.engagement_pct ?? 0), 0.0001);
  const melhorIdx = rows.reduce(
    (best, r, i) =>
      (r.engagement_pct ?? -1) > (rows[best].engagement_pct ?? -1) ? i : best,
    0,
  );
  const piorIdx = rows.reduce(
    (worst, r, i) => {
      const cur = r.engagement_pct;
      const w = rows[worst].engagement_pct;
      if (cur == null || r.qtd === 0) return worst;
      if (w == null || rows[worst].qtd === 0) return i;
      return cur < w ? i : worst;
    },
    0,
  );
  const melhor = rows[melhorIdx];
  const pior = rows[piorIdx];
  const ganho =
    melhor.engagement_pct != null && pior.engagement_pct != null && pior.engagement_pct > 0
      ? ((melhor.engagement_pct - pior.engagement_pct) / pior.engagement_pct) * 100
      : null;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Type className="h-4 w-4" /> Tamanho da legenda × engajamento
      </h3>
      <div className="grid grid-cols-4 gap-3 mb-2">
        {rows.map((r, i) => (
          <div key={r.faixa} className="text-center">
            <div
              className={
                "h-24 rounded-md flex items-end justify-center mb-1 " +
                (i === melhorIdx
                  ? "bg-emerald-500/15"
                  : "bg-muted")
              }
            >
              <div
                className={
                  "w-full rounded-md " +
                  (i === melhorIdx ? "bg-emerald-500/70" : "bg-fuchsia-500/40")
                }
                style={{
                  height: `${((r.engagement_pct ?? 0) / max) * 100}%`,
                }}
              />
            </div>
            <p className="text-[11px] font-medium">{r.faixa}</p>
            <p className="text-[10px] text-muted-foreground">
              {r.qtd} posts · {r.engagement_pct != null ? `${r.engagement_pct.toFixed(2)}%` : "—"}
            </p>
          </div>
        ))}
      </div>
      {ganho != null && ganho > 5 && (
        <p className="text-xs text-muted-foreground pt-1">
          Posts <span className="text-foreground font-medium">{melhor.faixa}</span> têm{" "}
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            +{ganho.toFixed(0)}%
          </span>{" "}
          mais engajamento que <span className="text-foreground">{pior.faixa}</span>.
        </p>
      )}
    </Card>
  );
}

// ============================================================
// Visão geral: Comparação de períodos
// ============================================================

function ComparativoBlock({
  rangeIso,
}: {
  rangeIso: { since: string; until: string };
}) {
  const [ativo, setAtivo] = useState(false);
  const [data, setData] = useState<ComparativoResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ativo) return;
    let cancel = false;
    setLoading(true);
    api
      .get<ComparativoResp>(
        `/meta-instagram/comparativo?periodo_a_inicio=${rangeIso.since}&periodo_a_fim=${rangeIso.until}`,
      )
      .then((d) => {
        if (!cancel) setData(d);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar comparativo");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [ativo, rangeIso.since, rangeIso.until]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-medium">
          Comparação com período anterior
        </h3>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="rounded"
          />
          {ativo ? "Ativo" : "Comparar"}
        </label>
      </div>

      {!ativo && (
        <p className="text-xs text-muted-foreground">
          Compara o período selecionado com o período anterior de mesma duração.
        </p>
      )}

      {ativo && loading && <Skeleton className="h-32 w-full" />}

      {ativo && !loading && data && (
        <>
          <p className="text-[11px] text-muted-foreground mb-3">
            {data.periodo_a.since} → {data.periodo_a.until} vs{" "}
            <span className="text-foreground">
              {data.periodo_b.since} → {data.periodo_b.until}
            </span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ComparativoCard label="Followers ganhos" m={data.followers_ganhos} />
            <ComparativoCard label="Reach total" m={data.reach_total} />
            <ComparativoCard label="Interações" m={data.total_interactions} />
            <ComparativoCard
              label="Engajamento %"
              m={data.engagement_rate}
              isPercent
            />
            <ComparativoCard label="Profile views" m={data.profile_views} />
            <ComparativoCard label="Posts publicados" m={data.posts_publicados} />
            <ComparativoCard label="Followers" m={data.followers_atual} />
          </div>
        </>
      )}
    </Card>
  );
}

function ComparativoCard({
  label,
  m,
  isPercent,
}: {
  label: string;
  m: ComparativoMetric;
  isPercent?: boolean;
}) {
  const positivo = m.delta_abs >= 0;
  const valorFmt = isPercent
    ? `${m.atual.toFixed(2)}%`
    : num(Math.round(m.atual));
  const anteriorFmt = isPercent
    ? `${m.anterior.toFixed(2)}%`
    : num(Math.round(m.anterior));
  return (
    <Card className="p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums mt-1">{valorFmt}</p>
      <p className="text-[11px] text-muted-foreground">{anteriorFmt} antes</p>
      {m.delta_pct != null && (
        <p
          className={`text-xs font-medium mt-1 ${
            positivo
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {positivo ? "▲" : "▼"} {Math.abs(m.delta_pct * 100).toFixed(1)}%
        </p>
      )}
    </Card>
  );
}

// ============================================================
// Reels: bloco de métricas extras no Dialog
// ============================================================

function formatWatchTime(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "—";
  const seg = Math.round(ms / 1000);
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function formatTotalWatchHours(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "—";
  const horas = ms / 3600000;
  return horas >= 1
    ? `${horas.toFixed(1)}h`
    : `${Math.round(ms / 60000)}min`;
}

function ReelsMetricsBlock({ detail }: { detail: PostDetail }) {
  const avgMs = detail.ig_reels_avg_watch_time;
  const totalMs = detail.ig_reels_video_view_total_time;
  return (
    <Card className="p-4 bg-fuchsia-500/[0.03] border-fuchsia-500/20">
      <h4 className="text-xs font-medium mb-3 flex items-center gap-2">
        <PlayCircle className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
        Métricas de Reels
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Watch médio</p>
          <p className="text-lg font-semibold tabular-nums">{formatWatchTime(avgMs)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Plays</p>
          <p className="text-lg font-semibold tabular-nums">
            {num(detail.plays ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Replays</p>
          <p className="text-lg font-semibold tabular-nums">
            {num(detail.clips_replays_count ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Tempo total</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatTotalWatchHours(totalMs)}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Velocidade de viralização (curva temporal no Dialog)
// ============================================================

function VelocidadeBlock({
  mediaId,
  reachFinal,
}: {
  mediaId: string;
  reachFinal: number;
}) {
  const [data, setData] = useState<VelocidadeResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get<VelocidadeResp>(`/meta-instagram/post/${mediaId}/velocidade`)
      .then((d) => {
        if (!cancel) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [mediaId]);

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.milestones.length < 2) {
    return (
      <Card className="p-4">
        <p className="text-[11px] text-muted-foreground">
          Sem dados suficientes pra curva de velocidade (snapshots horários
          começam a ser coletados após cada sync de 6h).
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h4 className="text-xs font-medium mb-2 flex items-center gap-2">
        <Flame className="h-3.5 w-3.5 text-amber-500" />
        Velocidade de alcance
        {data.percentual_atingido_24h != null && (
          <span className="ml-auto text-[11px] text-muted-foreground font-normal">
            {data.percentual_atingido_24h.toFixed(0)}% do alcance final em 24h
          </span>
        )}
      </h4>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.milestones}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="horas_pos_pub"
              fontSize={10}
              tickFormatter={(h: number) => `${h}h`}
              tickLine={false}
              axisLine={false}
            />
            <YAxis fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v: number) => num(v)}
              labelFormatter={(h: number) => `${h}h após publicação`}
            />
            <Line
              dataKey="reach"
              name="Alcance"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              dataKey="total_interactions"
              name="Interações"
              stroke="#d946ef"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {data.percentual_atingido_24h != null && data.percentual_atingido_24h >= 70 && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Esse post atingiu{" "}
          <span className="text-foreground font-medium">
            {data.percentual_atingido_24h.toFixed(0)}%
          </span>{" "}
          do alcance final ({num(reachFinal)}) nas primeiras 24h — viralizou rápido.
        </p>
      )}
    </Card>
  );
}
