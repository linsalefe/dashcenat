import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pk_uuid


class MetricaCanal(Base):
    __tablename__ = "metricas_canal"
    __table_args__ = (
        UniqueConstraint("canal_id", "indicador", "produto_id", "ano", "mes", "semana"),
        CheckConstraint("mes BETWEEN 1 AND 12", name="ck_metricas_mes"),
        CheckConstraint("semana BETWEEN 1 AND 5", name="ck_metricas_semana"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    canal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.canais.id"), nullable=False)
    indicador: Mapped[str] = mapped_column(String(100), nullable=False)
    produto_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.produtos.id"))
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    semana: Mapped[int | None] = mapped_column(Integer)
    meta: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    resultado: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    meta_extra: Mapped[dict | None] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    observacao: Mapped[str | None] = mapped_column(Text)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class LeadEvento(Base):
    __tablename__ = "leads_eventos"
    __table_args__ = (
        UniqueConstraint("evento_id", "canal_id", "data"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    evento_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.eventos.id"), nullable=False)
    canal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.canais.id"), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    inscritos: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    investimento: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class InscricaoEvento(Base):
    __tablename__ = "inscricoes_evento"
    __table_args__ = (
        UniqueConstraint("evento_id", "data_registro"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    evento_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.eventos.id"), nullable=False)
    data_registro: Mapped[date] = mapped_column(Date, nullable=False)
    inscritos: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    valor_inscricao: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    receita: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("core.users.id"))
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


# ============================================================
# Sprint APR1 — Tabelas adicionadas em migration 008
# ============================================================

class MetaAdsCampanha(Base):
    __tablename__ = "meta_ads_campanhas"
    __table_args__ = (
        UniqueConstraint("ano", "mes", "nome_campanha", name="uq_meta_ads_periodo_campanha"),
        CheckConstraint("mes BETWEEN 1 AND 12", name="ck_meta_ads_mes"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    nome_campanha: Mapped[str] = mapped_column(String(500), nullable=False)
    veiculacao: Mapped[str | None] = mapped_column(String(50))
    orcamento_diario: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    investimento: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    impressoes: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    alcance: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    cliques: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    cpm: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    cpc: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    ctr: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    frequencia: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    resultados: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    indicador_resultado: Mapped[str | None] = mapped_column(String(200))
    custo_por_resultado: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    leads: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    leads_imersao: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    compras: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    valor_resultados: Mapped[Decimal] = mapped_column(Numeric(14, 2), server_default=text("0"))
    observacao: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class VendaHotmart(Base):
    __tablename__ = "vendas_hotmart"
    __table_args__ = (
        UniqueConstraint("transacao", name="uq_vendas_hotmart_transacao"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    transacao: Mapped[str] = mapped_column(String(100), nullable=False)
    produto: Mapped[str] = mapped_column(String(500), nullable=False)
    produtor: Mapped[str | None] = mapped_column(String(200))
    afiliado: Mapped[str | None] = mapped_column(String(200))
    meio_pagamento: Mapped[str | None] = mapped_column(String(50))
    moeda: Mapped[str | None] = mapped_column(String(10))
    preco_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), server_default=text("0"))
    faturamento_liquido: Mapped[Decimal] = mapped_column(Numeric(14, 2), server_default=text("0"))
    numero_parcela: Mapped[int | None] = mapped_column(Integer)
    recorrencia: Mapped[str | None] = mapped_column(String(50))
    data_venda: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    data_confirmacao: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    status: Mapped[str | None] = mapped_column(String(50))
    cliente_nome: Mapped[str | None] = mapped_column(String(300))
    cliente_email: Mapped[str | None] = mapped_column(String(200))
    cliente_estado: Mapped[str | None] = mapped_column(String(10))
    cliente_pais: Mapped[str | None] = mapped_column(String(50))
    codigo_produto: Mapped[str | None] = mapped_column(String(50))
    codigo_oferta: Mapped[str | None] = mapped_column(String(50))
    tipo_pagamento_oferta: Mapped[str | None] = mapped_column(String(100))
    observacao: Mapped[str | None] = mapped_column(Text)

    # ----- Campos derivados do payload Hotmart -----
    taxa_hotmart: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    meio_pagamento_detalhe: Mapped[str | None] = mapped_column(String(150))
    is_subscription: Mapped[bool | None] = mapped_column(Boolean)
    commission_as: Mapped[str | None] = mapped_column(String(30))

    # ----- Matching com tracking interno -----
    utm_source: Mapped[str | None] = mapped_column(String(100))
    utm_medium: Mapped[str | None] = mapped_column(String(100))
    utm_campaign: Mapped[str | None] = mapped_column(String(150))
    utm_term: Mapped[str | None] = mapped_column(String(150))
    utm_content: Mapped[str | None] = mapped_column(String(150))
    tracking_codes_raw: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    matched_via: Mapped[str | None] = mapped_column(String(30))  # 'hotmart_src' | 'email' | 'manual'
    anon_id_match: Mapped[str | None] = mapped_column(String(64))
    cta: Mapped[str | None] = mapped_column(String(80))  # data-event do botão que originou a venda

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class Lancamento(Base):
    __tablename__ = "lancamentos"
    __table_args__ = (
        UniqueConstraint("ano", "mes", "nome", name="uq_lancamento_periodo_nome"),
        CheckConstraint("mes BETWEEN 1 AND 12", name="ck_lancamentos_mes"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    investimento_meta: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    investimento_resultado: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    leads_meta: Mapped[int | None] = mapped_column(Integer)
    leads_organico: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    leads_pago: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    leads_total: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    cpl_meta: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    cpl_resultado: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    mqls_meta: Mapped[int | None] = mapped_column(Integer)
    mqls_resultado: Mapped[int | None] = mapped_column(Integer)
    alunos_meta: Mapped[int | None] = mapped_column(Integer)
    alunos_resultado: Mapped[int | None] = mapped_column(Integer)
    receita_meta: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    receita_resultado: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    engajamento: Mapped[dict | None] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    observacao: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


# ============================================================
# Sprint Marketing Frentes — Tabela única pra Pós/Congressos/Cursos/Comunidade
# ============================================================

class FrentePeriodo(Base):
    __tablename__ = "frente_periodo"
    __table_args__ = (
        UniqueConstraint("frente", "ano", "mes", "evento_nome", name="uq_frente_periodo_evento"),
        CheckConstraint("mes BETWEEN 1 AND 12", name="ck_mes_valido"),
        CheckConstraint(
            "frente IN ('pos','congresso','curso','comunidade')",
            name="ck_frente_valida",
        ),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    frente: Mapped[str] = mapped_column(String(20), nullable=False)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    evento_nome: Mapped[str] = mapped_column(String(500), nullable=False)
    evento_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    investimento_ads: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))

    alcance: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    cliques: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    visitantes_lp: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    checkout: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    compras: Mapped[int] = mapped_column(Integer, server_default=text("0"))

    meta_leads: Mapped[int | None] = mapped_column(Integer)
    leads: Mapped[int | None] = mapped_column(Integer)
    meta_ligacao: Mapped[int | None] = mapped_column(Integer)
    ligacao: Mapped[int | None] = mapped_column(Integer)
    meta_sql: Mapped[int | None] = mapped_column(Integer)
    sql_reuniao: Mapped[int | None] = mapped_column(Integer)
    meta_reuniao: Mapped[int | None] = mapped_column(Integer)
    reuniao_realizada: Mapped[int | None] = mapped_column(Integer)
    meta_vendas: Mapped[int | None] = mapped_column(Integer)
    vendas: Mapped[int | None] = mapped_column(Integer)

    meta_inscritos: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    inscritos: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    meta_receita: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    receita: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))

    ticket_medio: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    taxa_doity: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    no_show_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))

    extras: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


# ============================================================
# Sprint Funil Mensal — funil de mídia paga agregado por (frente, ano, mes)
# ============================================================

class FunilMensal(Base):
    __tablename__ = "funil_mensal"
    __table_args__ = (
        UniqueConstraint("frente", "ano", "mes", name="uq_funil_mensal_periodo"),
        CheckConstraint("mes BETWEEN 1 AND 12", name="ck_funil_mes_valido"),
        CheckConstraint(
            "frente IN ('pos','congresso','curso','comunidade')",
            name="ck_funil_frente_valida",
        ),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    frente: Mapped[str] = mapped_column(String(20), nullable=False)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)

    investimento_ads: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    alcance: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    cliques: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    visitantes_lp: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    checkout: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    compras: Mapped[int] = mapped_column(Integer, server_default=text("0"))

    extras: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


# ============================================================
# Sprint Meta Ads — Sync diário via Meta Marketing API v21.0
# ============================================================

class MetaAdsInsight(Base):
    """Linha diária de insights por (campanha, adset, ad) vinda da Meta Marketing API.

    Uniqueness por dia + conta + (campaign, adset, ad). adset_id/ad_id são NOT NULL
    com default '' pra permitir UNIQUE direto nas colunas (sem COALESCE) e ON CONFLICT
    estável via SQLAlchemy.
    """
    __tablename__ = "meta_ads_insights"
    __table_args__ = (
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    data: Mapped[date] = mapped_column(Date, nullable=False)
    ad_account_id: Mapped[str] = mapped_column(String(64), nullable=False)
    campaign_id: Mapped[str] = mapped_column(String(64), nullable=False)
    campaign_name: Mapped[str] = mapped_column(String(255), nullable=False)
    objetivo: Mapped[str | None] = mapped_column(String(64))  # OUTCOME_SALES | OUTCOME_LEADS | ...
    status: Mapped[str | None] = mapped_column(String(32))    # ACTIVE | PAUSED | ...
    adset_id: Mapped[str] = mapped_column(String(64), nullable=False, server_default="")
    adset_name: Mapped[str | None] = mapped_column(String(255))
    ad_id: Mapped[str] = mapped_column(String(64), nullable=False, server_default="")
    ad_name: Mapped[str | None] = mapped_column(String(255))

    # ----- Mídia -----
    spend: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    reach: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    impressions: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    ctr: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    cpc: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    cpm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    frequency: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # ----- Funil (de actions) -----
    landing_page_views: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    initiate_checkout: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    purchases: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    purchase_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default=text("0"))
    complete_registration: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    # ----- Conversões customizadas -----
    # Dict por custom_conversion_id: {"123": {"name": "...", "count": N, "value": V}}
    custom_conversions: Mapped[dict | None] = mapped_column(JSONB)
    custom_conversions_total: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )

    # Mapping pra cruzar com tracking interno (slug do nome da campanha)
    utm_campaign_inferido: Mapped[str | None] = mapped_column(String(255))
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


# ============================================================
# Sprint Instagram Graph — Sync de conta orgânica + posts + audiência
# ============================================================

class InstagramAccountDaily(Base):
    """Snapshot diário do perfil + métricas agregadas da conta IG."""
    __tablename__ = "instagram_account_daily"
    __table_args__ = (
        UniqueConstraint("ig_user_id", "data", name="uq_ig_account_daily"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    ig_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64))

    followers_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    follows_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    media_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    reach: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    profile_views: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    website_clicks: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    accounts_engaged: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    total_interactions: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    likes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    comments: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    shares: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    saves: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    replies: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    follows_gained: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class InstagramPost(Base):
    """1 linha por mídia publicada (post/reel/carrossel). Métricas lifetime."""
    __tablename__ = "instagram_posts"
    __table_args__ = (
        UniqueConstraint("media_id", name="uq_ig_posts"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    ig_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    media_id: Mapped[str] = mapped_column(String(64), nullable=False)

    media_type: Mapped[str] = mapped_column(String(32), nullable=False)
    media_product_type: Mapped[str | None] = mapped_column(String(32))
    caption: Mapped[str | None] = mapped_column(Text)
    permalink: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    media_url: Mapped[str | None] = mapped_column(Text)
    timestamp_publicacao: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    reach: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    views: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    likes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    comments: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    shares: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    saved: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    total_interactions: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    profile_visits: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    profile_activity: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    follows: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    ig_reels_video_view_total_time: Mapped[int | None] = mapped_column(BigInteger)
    ig_reels_avg_watch_time: Mapped[int | None] = mapped_column(Integer)
    plays: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    clips_replays_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )

    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    ultimo_snapshot_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class InstagramPostSnapshot(Base):
    """Histórico de métricas por post — 1 linha por (media_id, data)."""
    __tablename__ = "instagram_post_snapshots"
    __table_args__ = (
        UniqueConstraint("media_id", "data", name="uq_ig_post_snapshots"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    media_id: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)

    reach: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    views: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    likes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    comments: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    shares: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    saved: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    total_interactions: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    profile_visits: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    follows: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class InstagramAudience(Base):
    """Demografia (gender_age | country | city | locale). Atualiza semanalmente."""
    __tablename__ = "instagram_audience"
    __table_args__ = (
        UniqueConstraint(
            "ig_user_id", "data", "breakdown", "chave", name="uq_ig_audience"
        ),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    ig_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    breakdown: Mapped[str] = mapped_column(String(32), nullable=False)
    chave: Mapped[str] = mapped_column(String(128), nullable=False)
    valor: Mapped[int] = mapped_column(Integer, nullable=False)
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class InstagramStory(Base):
    """Stories ativos (expiram em 24h). Snapshot final antes do reset."""
    __tablename__ = "instagram_stories"
    __table_args__ = (
        UniqueConstraint("story_id", name="uq_ig_stories"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    ig_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    story_id: Mapped[str] = mapped_column(String(64), nullable=False)
    media_type: Mapped[str] = mapped_column(String(32), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    media_url: Mapped[str | None] = mapped_column(Text)
    permalink: Mapped[str | None] = mapped_column(Text)
    timestamp_publicacao: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    reach: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    replies: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    taps_forward: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    taps_back: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    exits: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    swipe_forward: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )

    retencao_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    ultimo_snapshot_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class InstagramPostHashtag(Base):
    """Hashtag extraída da caption — 1 linha por (post, hashtag)."""
    __tablename__ = "instagram_post_hashtags"
    __table_args__ = (
        UniqueConstraint("media_id", "hashtag", name="uq_ig_post_hashtag"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    media_id: Mapped[str] = mapped_column(String(64), nullable=False)
    hashtag: Mapped[str] = mapped_column(String(128), nullable=False)
    posicao: Mapped[int] = mapped_column(Integer, nullable=False)
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class InstagramPostHourlySnapshot(Base):
    """Snapshot horário pra calcular velocidade de viralização (1h/6h/24h/48h)."""
    __tablename__ = "instagram_post_hourly_snapshots"
    __table_args__ = (
        UniqueConstraint("media_id", "snapshot_em", name="uq_ig_post_hourly_snap"),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    media_id: Mapped[str] = mapped_column(String(64), nullable=False)
    snapshot_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    horas_pos_publicacao: Mapped[int] = mapped_column(Integer, nullable=False)

    reach: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    views: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    likes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    comments: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    shares: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    saved: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    total_interactions: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )


class MetaCustomConversion(Base):
    """Cadastro de Custom Conversions da Meta Ads — usado pra contar 'resultados' em leads."""
    __tablename__ = "meta_custom_conversions"
    __table_args__ = (
        UniqueConstraint(
            "custom_conversion_id", "ad_account_id", name="uq_meta_custom_conv"
        ),
        {"schema": "mkt"},
    )

    id: Mapped[uuid.UUID] = pk_uuid()
    custom_conversion_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ad_account_id: Mapped[str] = mapped_column(String(64), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    custom_event_type: Mapped[str | None] = mapped_column(String(64))
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    sincronizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
