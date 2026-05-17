"""Schemas Pydantic da integração Instagram Graph API."""
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


# ============================================================
# Config
# ============================================================

class InstagramConfigIn(BaseModel):
    access_token: str | None = None  # se vazio, reutiliza token do meta_ads
    ig_user_id: str | None = None
    page_id: str | None = None
    ativo: bool | None = None


class InstagramConfigOut(BaseModel):
    configurado: bool
    ativo: bool
    ig_user_id: str | None
    username: str | None
    page_id: str | None
    access_token_mask: str | None
    token_compartilhado_com_meta_ads: bool
    ultimo_sync: datetime | None
    ultimo_sync_status: str | None
    ultimo_sync_erro: str | None
    ultimo_sync_total: int


# ============================================================
# Discovery (helper de setup)
# ============================================================

class PaginaIG(BaseModel):
    page_id: str
    page_name: str | None = None
    instagram_business_account_id: str | None = None
    ig_username: str | None = None
    ig_profile_picture_url: str | None = None


class InstagramDiscoveryOut(BaseModel):
    paginas: list[PaginaIG]


# ============================================================
# Sync
# ============================================================

class InstagramSyncRequest(BaseModel):
    since: date | None = None
    until: date | None = None
    full_refresh: bool = False


class InstagramSyncResult(BaseModel):
    ok: bool
    posts_processados: int
    snapshots_criados: int
    dias_conta_processados: int
    audience_atualizada: bool
    erro: str | None = None
    range: dict[str, str] = {}


# ============================================================
# Listagem
# ============================================================

class InstagramPostOut(BaseModel):
    media_id: str
    media_type: str
    media_product_type: str | None
    caption: str | None
    permalink: str | None
    thumbnail_url: str | None
    media_url: str | None
    timestamp_publicacao: datetime
    reach: int
    views: int
    likes: int
    comments: int
    shares: int
    saved: int
    total_interactions: int
    profile_visits: int
    follows: int
    engagement_rate: float | None = None  # total_interactions / reach
    # Métricas extras pra REELS
    plays: int = 0
    clips_replays_count: int = 0
    ig_reels_video_view_total_time: int | None = None
    ig_reels_avg_watch_time: int | None = None

    model_config = ConfigDict(from_attributes=True)


class InstagramPostSnapshotOut(BaseModel):
    data: date
    reach: int
    views: int
    likes: int
    comments: int
    shares: int
    saved: int
    total_interactions: int
    profile_visits: int
    follows: int

    model_config = ConfigDict(from_attributes=True)


class InstagramPostDetail(InstagramPostOut):
    snapshots: list[InstagramPostSnapshotOut]


class InstagramAccountDayOut(BaseModel):
    data: date
    followers_count: int
    follows_count: int
    media_count: int
    reach: int
    profile_views: int
    website_clicks: int
    accounts_engaged: int
    total_interactions: int
    likes: int
    comments: int
    shares: int
    saves: int
    replies: int
    follows_gained: int

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# Stats agregado pro dashboard
# ============================================================

class InstagramAudienceItem(BaseModel):
    chave: str
    valor: int


class InstagramStats(BaseModel):
    periodo_inicio: date
    periodo_fim: date

    followers_atual: int
    followers_inicio_periodo: int
    followers_ganhos_periodo: int
    reach_total: int
    profile_views_total: int
    total_interactions: int
    posts_publicados: int

    # Séries pra gráfico
    serie_followers: list[dict[str, Any]]  # [{data, followers_count, follows_gained}]
    serie_reach: list[dict[str, Any]]       # [{data, reach, profile_views, total_interactions}]

    # Top posts
    top_posts_reach: list[InstagramPostOut]
    top_posts_engagement: list[InstagramPostOut]

    # Breakdown por tipo
    posts_por_tipo: dict[str, int]
    reach_por_tipo: dict[str, int]

    # Demografia (último snapshot)
    audience_genero_idade: list[InstagramAudienceItem]
    audience_top_paises: list[InstagramAudienceItem]
    audience_top_cidades: list[InstagramAudienceItem]
    audience_top_idiomas: list[InstagramAudienceItem]
    # Cross-tab age × gender (v22+ se Meta permitir o breakdown combinado)
    audience_age_gender: list[InstagramAudienceItem] = []
    audience_genero: list[InstagramAudienceItem] = []


# ============================================================
# Stories
# ============================================================

class InstagramStoryOut(BaseModel):
    story_id: str
    media_type: str
    thumbnail_url: str | None
    media_url: str | None
    permalink: str | None
    timestamp_publicacao: datetime
    reach: int
    replies: int
    taps_forward: int
    taps_back: int
    exits: int
    swipe_forward: int
    retencao_pct: float | None

    model_config = ConfigDict(from_attributes=True)


class InstagramStoriesOut(BaseModel):
    total: int
    reach_medio: float
    retencao_media: float | None
    replies_total: int
    por_dia_semana: dict[str, dict[str, float]]  # {"seg": {"qtd": 3, "retencao_media": 72.5}, ...}
    items: list[InstagramStoryOut]


# ============================================================
# Heatmap melhor dia/hora
# ============================================================

class HeatmapCell(BaseModel):
    dia_semana: int  # 0=dom .. 6=sáb
    hora: int        # 0..23
    valor: float
    qtd_posts: int


class HeatmapOut(BaseModel):
    metric: str  # engagement | reach | saves | interactions
    matriz: list[HeatmapCell]
    melhores: list[dict[str, Any]]  # top 3 {dia_semana, hora, valor, qtd_posts}


# ============================================================
# Comparativo de períodos
# ============================================================

class ComparativoMetric(BaseModel):
    atual: float
    anterior: float
    delta_abs: float
    delta_pct: float | None  # None se anterior == 0


class ComparativoOut(BaseModel):
    periodo_a: dict[str, str]  # {since, until}
    periodo_b: dict[str, str]
    followers_atual: ComparativoMetric
    followers_ganhos: ComparativoMetric
    reach_total: ComparativoMetric
    profile_views: ComparativoMetric
    total_interactions: ComparativoMetric
    posts_publicados: ComparativoMetric
    engagement_rate: ComparativoMetric


# ============================================================
# Hashtags
# ============================================================

class HashtagPerf(BaseModel):
    hashtag: str
    qtd_posts: int
    reach_total: int
    interactions_total: int
    engagement_rate_media: float | None
    melhor_media_id: str | None
    melhor_permalink: str | None


# ============================================================
# Engagement por tipo de mídia
# ============================================================

class EngagementPorTipo(BaseModel):
    media_type: str
    media_product_type: str | None
    qtd: int
    reach_medio: float
    interactions_media: float
    engagement_rate_pct: float | None
    save_rate_pct: float | None
    share_rate_pct: float | None


# ============================================================
# Velocidade de viralização
# ============================================================

class VelocidadeMilestone(BaseModel):
    horas_pos_pub: int
    snapshot_em: datetime
    reach: int
    total_interactions: int


class VelocidadeOut(BaseModel):
    media_id: str
    publicado_em: datetime
    milestones: list[VelocidadeMilestone]
    reach_final: int
    velocidade_24h: int | None
    velocidade_48h: int | None
    percentual_atingido_24h: float | None


# ============================================================
# Caption length × engagement
# ============================================================

class CaptionFaixa(BaseModel):
    faixa: str
    min_chars: int
    max_chars: int | None
    qtd: int
    reach_medio: float
    engagement_pct: float | None
