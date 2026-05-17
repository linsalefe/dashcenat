"""Rotas Instagram orgânico — config, discover, sync, stats, posts, audiência."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.etl.instagram_sync import (
    get_instagram_client,
    sync_instagram,
    sync_instagram_inicial,
)
from app.models.integracoes import Integracao
from app.models.mkt import (
    InstagramAccountDaily,
    InstagramAudience,
    InstagramPost,
    InstagramPostHashtag,
    InstagramPostHourlySnapshot,
    InstagramPostSnapshot,
    InstagramStory,
)
from app.models.user import User
from app.schemas.instagram import (
    CaptionFaixa,
    ComparativoMetric,
    ComparativoOut,
    EngagementPorTipo,
    HashtagPerf,
    HeatmapCell,
    HeatmapOut,
    InstagramAccountDayOut,
    InstagramAudienceItem,
    InstagramConfigIn,
    InstagramConfigOut,
    InstagramDiscoveryOut,
    InstagramPostDetail,
    InstagramPostOut,
    InstagramPostSnapshotOut,
    InstagramStats,
    InstagramStoriesOut,
    InstagramStoryOut,
    InstagramSyncRequest,
    InstagramSyncResult,
    PaginaIG,
    VelocidadeMilestone,
    VelocidadeOut,
)
from app.services.crypto import decrypt_json, encrypt_json, mask
from app.services.instagram import InstagramClient, InstagramError

router = APIRouter(prefix="/meta-instagram", tags=["meta-instagram"])


def _exige_admin(user: User):
    if user.papel != "admin":
        raise HTTPException(
            status_code=403,
            detail="Apenas admins podem fazer esta operação",
        )


def _engagement_rate(reach: int, total_interactions: int) -> float | None:
    return (total_interactions / reach) if reach > 0 else None


# ============================================================
# Config
# ============================================================

@router.get("/config", response_model=InstagramConfigOut)
async def get_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(Integracao).where(Integracao.servico == "meta_instagram")
    )
    integ = res.scalar_one_or_none()

    if not integ:
        return InstagramConfigOut(
            configurado=False,
            ativo=False,
            ig_user_id=None,
            username=None,
            page_id=None,
            access_token_mask=None,
            token_compartilhado_com_meta_ads=False,
            ultimo_sync=None,
            ultimo_sync_status=None,
            ultimo_sync_erro=None,
            ultimo_sync_total=0,
        )

    creds = (
        decrypt_json(integ.credentials_cifradas)
        if integ.credentials_cifradas
        else {}
    )
    token = creds.get("access_token")
    ig_user_id = creds.get("ig_user_id") or (integ.config_extra or {}).get("ig_user_id")
    page_id = creds.get("page_id")

    # Detecta se token está sendo herdado do meta_ads
    token_compartilhado = False
    if not token:
        res2 = await db.execute(
            select(Integracao).where(Integracao.servico == "meta_ads")
        )
        meta_ads = res2.scalar_one_or_none()
        if meta_ads and meta_ads.credentials_cifradas:
            ads_creds = decrypt_json(meta_ads.credentials_cifradas)
            if ads_creds.get("access_token"):
                token = ads_creds["access_token"]
                token_compartilhado = True

    return InstagramConfigOut(
        configurado=bool(token and ig_user_id),
        ativo=integ.ativo,
        ig_user_id=ig_user_id,
        username=(integ.config_extra or {}).get("username"),
        page_id=page_id,
        access_token_mask=mask(token, show=4) if token else None,
        token_compartilhado_com_meta_ads=token_compartilhado,
        ultimo_sync=integ.ultimo_sync,
        ultimo_sync_status=integ.ultimo_sync_status,
        ultimo_sync_erro=integ.ultimo_sync_erro,
        ultimo_sync_total=integ.ultimo_sync_total or 0,
    )


@router.put("/config", response_model=InstagramConfigOut)
async def put_config(
    body: InstagramConfigIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _exige_admin(user)

    res = await db.execute(
        select(Integracao).where(Integracao.servico == "meta_instagram")
    )
    integ = res.scalar_one_or_none()
    creds = (
        decrypt_json(integ.credentials_cifradas)
        if (integ and integ.credentials_cifradas)
        else {}
    )

    if body.access_token is not None and body.access_token.strip():
        creds["access_token"] = body.access_token.strip()
    if body.ig_user_id is not None:
        creds["ig_user_id"] = body.ig_user_id.strip()
    if body.page_id is not None:
        creds["page_id"] = body.page_id.strip()

    cifrado = encrypt_json(creds) if creds else None
    ativo = body.ativo if body.ativo is not None else (integ.ativo if integ else True)

    if integ:
        integ.credentials_cifradas = cifrado
        integ.ativo = ativo
    else:
        integ = Integracao(
            servico="meta_instagram",
            credentials_cifradas=cifrado,
            ativo=ativo,
            config_extra={},
        )
        db.add(integ)

    await db.commit()
    return await get_config(db, user)


# ============================================================
# Discovery — setup
# ============================================================

@router.get("/discover", response_model=InstagramDiscoveryOut)
async def discover(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _exige_admin(user)

    # Lê token: 1º do meta_instagram, fallback no meta_ads
    res = await db.execute(
        select(Integracao).where(Integracao.servico == "meta_instagram")
    )
    integ = res.scalar_one_or_none()
    token = None
    if integ and integ.credentials_cifradas:
        creds = decrypt_json(integ.credentials_cifradas)
        token = creds.get("access_token")
    if not token:
        res2 = await db.execute(
            select(Integracao).where(Integracao.servico == "meta_ads")
        )
        meta_ads = res2.scalar_one_or_none()
        if meta_ads and meta_ads.credentials_cifradas:
            ads_creds = decrypt_json(meta_ads.credentials_cifradas)
            token = ads_creds.get("access_token")

    if not token:
        raise HTTPException(
            400,
            "Nenhum access_token disponível. Configure o Meta Ads primeiro ou cole um token na config do Instagram.",
        )

    try:
        client = InstagramClient(access_token=token)
        paginas = await client.discover_accounts()
    except InstagramError as e:
        raise HTTPException(400, f"Erro ao consultar Meta: {e}")

    return InstagramDiscoveryOut(paginas=[PaginaIG(**p) for p in paginas])


# ============================================================
# Sync
# ============================================================

@router.post("/sync", response_model=InstagramSyncResult)
async def trigger_sync(
    body: InstagramSyncRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _exige_admin(user)

    if body.full_refresh and not body.since and not body.until:
        result = await sync_instagram_inicial(db)
    else:
        result = await sync_instagram(
            db, since=body.since, until=body.until, full_refresh=body.full_refresh
        )
    return InstagramSyncResult(**result)


# ============================================================
# Listagem de posts
# ============================================================

@router.get("/posts", response_model=list[InstagramPostOut])
async def list_posts(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
    media_type: str | None = Query(None),
    ordenar_por: str = Query(
        "date", pattern="^(date|reach|interactions|engagement)$"
    ),
    limit: int = Query(60, le=500),
    offset: int = Query(0, ge=0),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=30)

    filtros = [
        InstagramPost.timestamp_publicacao
        >= datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc),
        InstagramPost.timestamp_publicacao
        <= datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc),
    ]
    if media_type:
        filtros.append(InstagramPost.media_type == media_type.upper())

    q = select(InstagramPost).where(and_(*filtros))
    if ordenar_por == "reach":
        q = q.order_by(InstagramPost.reach.desc())
    elif ordenar_por == "interactions":
        q = q.order_by(InstagramPost.total_interactions.desc())
    elif ordenar_por == "engagement":
        # Calcular engagement em Python; só ordena por interactions/reach proxy
        q = q.order_by(InstagramPost.total_interactions.desc())
    else:
        q = q.order_by(InstagramPost.timestamp_publicacao.desc())

    q = q.offset(offset).limit(limit)
    res = await db.execute(q)
    posts = res.scalars().all()

    out = [_post_to_out(p) for p in posts]

    if ordenar_por == "engagement":
        out.sort(key=lambda x: x.engagement_rate or 0, reverse=True)

    return out


def _post_to_out(p: InstagramPost) -> InstagramPostOut:
    return InstagramPostOut(
        media_id=p.media_id,
        media_type=p.media_type,
        media_product_type=p.media_product_type,
        caption=p.caption,
        permalink=p.permalink,
        thumbnail_url=p.thumbnail_url,
        media_url=p.media_url,
        timestamp_publicacao=p.timestamp_publicacao,
        reach=p.reach,
        views=p.views,
        likes=p.likes,
        comments=p.comments,
        shares=p.shares,
        saved=p.saved,
        total_interactions=p.total_interactions,
        profile_visits=p.profile_visits,
        follows=p.follows,
        engagement_rate=_engagement_rate(p.reach, p.total_interactions),
        plays=p.plays or 0,
        clips_replays_count=p.clips_replays_count or 0,
        ig_reels_video_view_total_time=p.ig_reels_video_view_total_time,
        ig_reels_avg_watch_time=p.ig_reels_avg_watch_time,
    )


@router.get("/post/{media_id}", response_model=InstagramPostDetail)
async def post_detail(
    media_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(InstagramPost).where(InstagramPost.media_id == media_id)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Post não encontrado")

    res_snap = await db.execute(
        select(InstagramPostSnapshot)
        .where(InstagramPostSnapshot.media_id == media_id)
        .order_by(InstagramPostSnapshot.data)
    )
    snaps = res_snap.scalars().all()

    base = _post_to_out(p)
    return InstagramPostDetail(
        **base.model_dump(),
        snapshots=[
            InstagramPostSnapshotOut.model_validate(s, from_attributes=True)
            for s in snaps
        ],
    )


# ============================================================
# Série diária da conta (gráficos custom)
# ============================================================

@router.get("/account-daily", response_model=list[InstagramAccountDayOut])
async def account_daily(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=30)

    res = await db.execute(
        select(InstagramAccountDaily)
        .where(
            and_(
                InstagramAccountDaily.data >= since,
                InstagramAccountDaily.data <= until,
            )
        )
        .order_by(InstagramAccountDaily.data)
    )
    return list(res.scalars().all())


# ============================================================
# Audiência
# ============================================================

@router.get("/audience")
async def audience(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Retorna {breakdown: [{chave, valor}]} com último snapshot por breakdown."""
    # Última data disponível
    r_max = await db.execute(
        select(func.max(InstagramAudience.data))
    )
    ultima = r_max.scalar_one_or_none()
    if not ultima:
        return {
            "data": None,
            "gender_age": [],
            "country": [],
            "city": [],
            "locale": [],
        }

    r = await db.execute(
        select(
            InstagramAudience.breakdown,
            InstagramAudience.chave,
            InstagramAudience.valor,
        ).where(InstagramAudience.data == ultima)
    )
    rows = r.all()

    by_breakdown: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for x in rows:
        by_breakdown[x.breakdown].append({"chave": x.chave, "valor": x.valor})

    # Ordena cada breakdown por valor desc
    for k in by_breakdown:
        by_breakdown[k].sort(key=lambda i: i["valor"], reverse=True)

    return {
        "data": ultima.isoformat(),
        "gender_age": by_breakdown.get("age", []),
        "country": by_breakdown.get("country", []),
        "city": by_breakdown.get("city", []),
        "locale": by_breakdown.get("locale", []),
    }


# ============================================================
# Stats agregado pro dashboard
# ============================================================

@router.get("/stats", response_model=InstagramStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=30)

    # ----- Série diária da conta -----
    q_dia = (
        select(InstagramAccountDaily)
        .where(
            and_(
                InstagramAccountDaily.data >= since,
                InstagramAccountDaily.data <= until,
            )
        )
        .order_by(InstagramAccountDaily.data)
    )
    res_dia = await db.execute(q_dia)
    dias = list(res_dia.scalars().all())

    followers_inicio = dias[0].followers_count if dias else 0
    followers_atual = dias[-1].followers_count if dias else 0
    followers_ganhos = sum(d.follows_gained for d in dias)

    reach_total = sum(d.reach for d in dias)
    profile_views_total = sum(d.profile_views for d in dias)
    total_interactions = sum(d.total_interactions for d in dias)

    serie_followers = [
        {
            "data": d.data.isoformat(),
            "followers_count": d.followers_count,
            "follows_gained": d.follows_gained,
        }
        for d in dias
    ]
    serie_reach = [
        {
            "data": d.data.isoformat(),
            "reach": d.reach,
            "profile_views": d.profile_views,
            "total_interactions": d.total_interactions,
        }
        for d in dias
    ]

    # ----- Posts do período -----
    ts_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    ts_until = datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc)
    res_posts = await db.execute(
        select(InstagramPost)
        .where(
            and_(
                InstagramPost.timestamp_publicacao >= ts_since,
                InstagramPost.timestamp_publicacao <= ts_until,
            )
        )
    )
    posts = list(res_posts.scalars().all())

    posts_publicados = len(posts)

    top_reach = sorted(posts, key=lambda p: p.reach, reverse=True)[:10]
    top_eng = sorted(
        posts,
        key=lambda p: (
            p.total_interactions / p.reach if p.reach > 0 else 0
        ),
        reverse=True,
    )[:10]

    posts_por_tipo: dict[str, int] = defaultdict(int)
    reach_por_tipo: dict[str, int] = defaultdict(int)
    for p in posts:
        t = p.media_type.upper()
        # Reels chega como VIDEO + media_product_type=REELS
        if (p.media_product_type or "").upper() == "REELS":
            t = "REELS"
        posts_por_tipo[t] += 1
        reach_por_tipo[t] += p.reach

    # ----- Audiência (último snapshot) -----
    r_max = await db.execute(select(func.max(InstagramAudience.data)))
    ultima_aud = r_max.scalar_one_or_none()

    audience_genero_idade: list[InstagramAudienceItem] = []
    audience_paises: list[InstagramAudienceItem] = []
    audience_cidades: list[InstagramAudienceItem] = []
    audience_idiomas: list[InstagramAudienceItem] = []
    audience_age_gender: list[InstagramAudienceItem] = []
    audience_genero: list[InstagramAudienceItem] = []

    if ultima_aud:
        r_aud = await db.execute(
            select(
                InstagramAudience.breakdown,
                InstagramAudience.chave,
                InstagramAudience.valor,
            ).where(InstagramAudience.data == ultima_aud)
        )
        by: dict[str, list[InstagramAudienceItem]] = defaultdict(list)
        for x in r_aud.all():
            by[x.breakdown].append(InstagramAudienceItem(chave=x.chave, valor=x.valor))
        for k in by:
            by[k].sort(key=lambda i: i.valor, reverse=True)
        audience_genero_idade = by.get("age", [])[:20]
        audience_paises = by.get("country", [])[:10]
        audience_cidades = by.get("city", [])[:10]
        audience_idiomas = by.get("locale", [])[:5]
        audience_age_gender = by.get("age,gender", [])[:40]
        audience_genero = by.get("gender", [])[:5]

    return InstagramStats(
        periodo_inicio=since,
        periodo_fim=until,
        followers_atual=followers_atual,
        followers_inicio_periodo=followers_inicio,
        followers_ganhos_periodo=followers_ganhos,
        reach_total=reach_total,
        profile_views_total=profile_views_total,
        total_interactions=total_interactions,
        posts_publicados=posts_publicados,
        serie_followers=serie_followers,
        serie_reach=serie_reach,
        top_posts_reach=[_post_to_out(p) for p in top_reach],
        top_posts_engagement=[_post_to_out(p) for p in top_eng],
        posts_por_tipo=dict(posts_por_tipo),
        reach_por_tipo=dict(reach_por_tipo),
        audience_genero_idade=audience_genero_idade,
        audience_top_paises=audience_paises,
        audience_top_cidades=audience_cidades,
        audience_top_idiomas=audience_idiomas,
        audience_age_gender=audience_age_gender,
        audience_genero=audience_genero,
    )


# ============================================================
# Stories
# ============================================================

_DOW_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"]


@router.get("/stories", response_model=InstagramStoriesOut)
async def list_stories(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=30)

    ts_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    ts_until = datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc)
    r = await db.execute(
        select(InstagramStory)
        .where(
            and_(
                InstagramStory.timestamp_publicacao >= ts_since,
                InstagramStory.timestamp_publicacao <= ts_until,
            )
        )
        .order_by(InstagramStory.timestamp_publicacao.desc())
    )
    stories = list(r.scalars().all())

    total = len(stories)
    reach_medio = (sum(s.reach for s in stories) / total) if total else 0.0
    retencoes = [float(s.retencao_pct) for s in stories if s.retencao_pct is not None]
    retencao_media = (sum(retencoes) / len(retencoes)) if retencoes else None
    replies_total = sum(s.replies for s in stories)

    # Agregado por dia da semana (Python: Monday=0..Sunday=6 → mapeio pra dom..sab)
    por_dia: dict[str, dict[str, float]] = {dow: {"qtd": 0, "retencao_media": 0.0} for dow in _DOW_PT}
    soma_retencao: dict[str, float] = {dow: 0.0 for dow in _DOW_PT}
    for s in stories:
        dow_py = s.timestamp_publicacao.weekday()  # 0=seg
        dow_pt = _DOW_PT[(dow_py + 1) % 7]
        por_dia[dow_pt]["qtd"] += 1
        if s.retencao_pct is not None:
            soma_retencao[dow_pt] += float(s.retencao_pct)
    for dow in _DOW_PT:
        qtd = por_dia[dow]["qtd"]
        por_dia[dow]["retencao_media"] = (
            round(soma_retencao[dow] / qtd, 1) if qtd > 0 else 0.0
        )

    return InstagramStoriesOut(
        total=total,
        reach_medio=round(reach_medio, 1),
        retencao_media=(round(retencao_media, 1) if retencao_media is not None else None),
        replies_total=replies_total,
        por_dia_semana=por_dia,
        items=[InstagramStoryOut.model_validate(s, from_attributes=True) for s in stories],
    )


# ============================================================
# Heatmap melhor dia/hora pra postar
# ============================================================

@router.get("/heatmap", response_model=HeatmapOut)
async def heatmap(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
    metric: str = Query("interactions", pattern="^(engagement|reach|saves|interactions)$"),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=90)

    ts_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    ts_until = datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc)

    # SQL nativo com EXTRACT pra evitar materializar tudo em Python
    from sqlalchemy import text as sqltext

    metric_expr = {
        "reach": "AVG(reach)",
        "saves": "AVG(saved)",
        "interactions": "AVG(total_interactions)",
        "engagement": (
            "AVG(CASE WHEN reach > 0 "
            "THEN total_interactions::float / reach * 100 ELSE NULL END)"
        ),
    }[metric]

    q = sqltext(
        f"""
        SELECT
          EXTRACT(DOW FROM timestamp_publicacao AT TIME ZONE 'America/Sao_Paulo')::int AS dia_semana,
          EXTRACT(HOUR FROM timestamp_publicacao AT TIME ZONE 'America/Sao_Paulo')::int AS hora,
          {metric_expr} AS valor,
          COUNT(*) AS qtd_posts
        FROM mkt.instagram_posts
        WHERE timestamp_publicacao BETWEEN :ts_since AND :ts_until
        GROUP BY 1, 2
        ORDER BY 1, 2
        """
    )
    r = await db.execute(q, {"ts_since": ts_since, "ts_until": ts_until})
    rows = r.all()

    matriz = [
        HeatmapCell(
            dia_semana=int(row.dia_semana),
            hora=int(row.hora),
            valor=float(row.valor or 0),
            qtd_posts=int(row.qtd_posts),
        )
        for row in rows
    ]
    # Top 3 com pelo menos 2 posts (sinal de confiança)
    confiaveis = [c for c in matriz if c.qtd_posts >= 2]
    confiaveis.sort(key=lambda c: c.valor, reverse=True)
    melhores = [
        {
            "dia_semana": c.dia_semana,
            "hora": c.hora,
            "valor": c.valor,
            "qtd_posts": c.qtd_posts,
        }
        for c in confiaveis[:3]
    ]

    return HeatmapOut(metric=metric, matriz=matriz, melhores=melhores)


# ============================================================
# Comparativo de períodos
# ============================================================

@router.get("/comparativo", response_model=ComparativoOut)
async def comparativo(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    periodo_a_inicio: date = Query(...),
    periodo_a_fim: date = Query(...),
    periodo_b_inicio: date | None = Query(None),
    periodo_b_fim: date | None = Query(None),
):
    # Default: período B = mesma duração imediatamente anterior
    if not periodo_b_inicio or not periodo_b_fim:
        dur = (periodo_a_fim - periodo_a_inicio).days
        periodo_b_fim = periodo_a_inicio - timedelta(days=1)
        periodo_b_inicio = periodo_b_fim - timedelta(days=dur)

    async def agregar(since: date, until: date) -> dict[str, float]:
        ts_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
        ts_until = datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc)

        r_dia = await db.execute(
            select(InstagramAccountDaily).where(
                and_(
                    InstagramAccountDaily.data >= since,
                    InstagramAccountDaily.data <= until,
                )
            )
            .order_by(InstagramAccountDaily.data)
        )
        dias = list(r_dia.scalars().all())

        r_posts = await db.execute(
            select(func.count()).select_from(InstagramPost).where(
                and_(
                    InstagramPost.timestamp_publicacao >= ts_since,
                    InstagramPost.timestamp_publicacao <= ts_until,
                )
            )
        )
        posts_count = int(r_posts.scalar_one() or 0)

        reach_total = float(sum(d.reach for d in dias))
        interactions = float(sum(d.total_interactions for d in dias))
        return {
            "followers_atual": float(dias[-1].followers_count if dias else 0),
            "followers_ganhos": float(sum(d.follows_gained for d in dias)),
            "reach_total": reach_total,
            "profile_views": float(sum(d.profile_views for d in dias)),
            "total_interactions": interactions,
            "posts_publicados": float(posts_count),
            "engagement_rate": (
                (interactions / reach_total) * 100 if reach_total > 0 else 0.0
            ),
        }

    a = await agregar(periodo_a_inicio, periodo_a_fim)
    b = await agregar(periodo_b_inicio, periodo_b_fim)

    def diff(k: str) -> ComparativoMetric:
        atual = a[k]
        anterior = b[k]
        delta_abs = atual - anterior
        delta_pct = ((atual - anterior) / anterior) if anterior != 0 else None
        return ComparativoMetric(
            atual=atual,
            anterior=anterior,
            delta_abs=delta_abs,
            delta_pct=delta_pct,
        )

    return ComparativoOut(
        periodo_a={"since": periodo_a_inicio.isoformat(), "until": periodo_a_fim.isoformat()},
        periodo_b={"since": periodo_b_inicio.isoformat(), "until": periodo_b_fim.isoformat()},
        followers_atual=diff("followers_atual"),
        followers_ganhos=diff("followers_ganhos"),
        reach_total=diff("reach_total"),
        profile_views=diff("profile_views"),
        total_interactions=diff("total_interactions"),
        posts_publicados=diff("posts_publicados"),
        engagement_rate=diff("engagement_rate"),
    )


# ============================================================
# Hashtags performance
# ============================================================

@router.get("/hashtags", response_model=list[HashtagPerf])
async def hashtags(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
    limit: int = Query(50, le=200),
    min_posts: int = Query(2, ge=1),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=90)

    ts_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    ts_until = datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc)

    from sqlalchemy import text as sqltext

    q = sqltext(
        """
        WITH agreg AS (
          SELECT
            h.hashtag,
            COUNT(DISTINCT p.media_id) AS qtd_posts,
            SUM(p.reach) AS reach_total,
            SUM(p.total_interactions) AS interactions_total,
            AVG(CASE WHEN p.reach > 0
                     THEN p.total_interactions::float / p.reach
                     ELSE NULL END) AS engagement_rate_media
          FROM mkt.instagram_post_hashtags h
          JOIN mkt.instagram_posts p ON p.media_id = h.media_id
          WHERE p.timestamp_publicacao BETWEEN :ts_since AND :ts_until
          GROUP BY h.hashtag
          HAVING COUNT(DISTINCT p.media_id) >= :min_posts
        ),
        melhores AS (
          SELECT DISTINCT ON (h.hashtag)
            h.hashtag,
            p.media_id AS melhor_media_id,
            p.permalink AS melhor_permalink
          FROM mkt.instagram_post_hashtags h
          JOIN mkt.instagram_posts p ON p.media_id = h.media_id
          WHERE p.timestamp_publicacao BETWEEN :ts_since AND :ts_until
          ORDER BY h.hashtag,
                   CASE WHEN p.reach > 0
                        THEN p.total_interactions::float / p.reach
                        ELSE 0 END DESC
        )
        SELECT
          a.hashtag,
          a.qtd_posts,
          COALESCE(a.reach_total, 0) AS reach_total,
          COALESCE(a.interactions_total, 0) AS interactions_total,
          a.engagement_rate_media,
          m.melhor_media_id,
          m.melhor_permalink
        FROM agreg a
        LEFT JOIN melhores m USING (hashtag)
        ORDER BY a.engagement_rate_media DESC NULLS LAST
        LIMIT :limit
        """
    )
    r = await db.execute(
        q,
        {
            "ts_since": ts_since,
            "ts_until": ts_until,
            "limit": limit,
            "min_posts": min_posts,
        },
    )
    return [
        HashtagPerf(
            hashtag=row.hashtag,
            qtd_posts=int(row.qtd_posts),
            reach_total=int(row.reach_total or 0),
            interactions_total=int(row.interactions_total or 0),
            engagement_rate_media=(
                float(row.engagement_rate_media)
                if row.engagement_rate_media is not None
                else None
            ),
            melhor_media_id=row.melhor_media_id,
            melhor_permalink=row.melhor_permalink,
        )
        for row in r.all()
    ]


# ============================================================
# Engagement por tipo de mídia
# ============================================================

@router.get("/engagement-por-tipo", response_model=list[EngagementPorTipo])
async def engagement_por_tipo(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=90)

    ts_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    ts_until = datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc)

    from sqlalchemy import text as sqltext

    q = sqltext(
        """
        SELECT
          media_type,
          media_product_type,
          COUNT(*) AS qtd,
          AVG(reach) AS reach_medio,
          AVG(total_interactions) AS interactions_media,
          AVG(CASE WHEN reach > 0
                   THEN total_interactions::float / reach * 100
                   ELSE NULL END) AS engagement_rate_pct,
          AVG(CASE WHEN reach > 0
                   THEN saved::float / reach * 100
                   ELSE NULL END) AS save_rate_pct,
          AVG(CASE WHEN reach > 0
                   THEN shares::float / reach * 100
                   ELSE NULL END) AS share_rate_pct
        FROM mkt.instagram_posts
        WHERE timestamp_publicacao BETWEEN :ts_since AND :ts_until
        GROUP BY media_type, media_product_type
        ORDER BY engagement_rate_pct DESC NULLS LAST
        """
    )
    r = await db.execute(q, {"ts_since": ts_since, "ts_until": ts_until})
    return [
        EngagementPorTipo(
            media_type=row.media_type,
            media_product_type=row.media_product_type,
            qtd=int(row.qtd),
            reach_medio=float(row.reach_medio or 0),
            interactions_media=float(row.interactions_media or 0),
            engagement_rate_pct=(
                float(row.engagement_rate_pct)
                if row.engagement_rate_pct is not None
                else None
            ),
            save_rate_pct=(
                float(row.save_rate_pct) if row.save_rate_pct is not None else None
            ),
            share_rate_pct=(
                float(row.share_rate_pct) if row.share_rate_pct is not None else None
            ),
        )
        for row in r.all()
    ]


# ============================================================
# Velocidade de viralização (curva temporal de um post)
# ============================================================

@router.get("/post/{media_id}/velocidade", response_model=VelocidadeOut)
async def post_velocidade(
    media_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    r = await db.execute(
        select(InstagramPost).where(InstagramPost.media_id == media_id)
    )
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Post não encontrado")

    r_snap = await db.execute(
        select(InstagramPostHourlySnapshot)
        .where(InstagramPostHourlySnapshot.media_id == media_id)
        .order_by(InstagramPostHourlySnapshot.snapshot_em)
    )
    snaps = list(r_snap.scalars().all())

    milestones = [
        VelocidadeMilestone(
            horas_pos_pub=int(s.horas_pos_publicacao),
            snapshot_em=s.snapshot_em,
            reach=int(s.reach),
            total_interactions=int(s.total_interactions),
        )
        for s in snaps
    ]

    reach_final = int(p.reach)
    # Marcadores 24h/48h: maior reach até esses horários (snapshots podem ser horários ímpares)
    def reach_em(horas: int) -> int | None:
        anteriores = [s for s in snaps if s.horas_pos_publicacao <= horas]
        if not anteriores:
            return None
        return int(max(s.reach for s in anteriores))

    velocidade_24h = reach_em(24)
    velocidade_48h = reach_em(48)
    pct_24h = (
        (velocidade_24h / reach_final) * 100
        if (velocidade_24h is not None and reach_final > 0)
        else None
    )

    return VelocidadeOut(
        media_id=media_id,
        publicado_em=p.timestamp_publicacao,
        milestones=milestones,
        reach_final=reach_final,
        velocidade_24h=velocidade_24h,
        velocidade_48h=velocidade_48h,
        percentual_atingido_24h=pct_24h,
    )


# ============================================================
# Caption length × engagement
# ============================================================

@router.get("/caption-analysis", response_model=list[CaptionFaixa])
async def caption_analysis(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    since: date | None = Query(None),
    until: date | None = Query(None),
):
    if not until:
        until = date.today()
    if not since:
        since = until - timedelta(days=90)

    ts_since = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    ts_until = datetime.combine(until, datetime.max.time(), tzinfo=timezone.utc)

    from sqlalchemy import text as sqltext

    q = sqltext(
        """
        SELECT
          CASE
            WHEN LENGTH(caption) < 100 THEN 'curto'
            WHEN LENGTH(caption) < 300 THEN 'medio'
            WHEN LENGTH(caption) < 800 THEN 'longo'
            ELSE 'muito_longo'
          END AS faixa,
          COUNT(*) AS qtd,
          AVG(reach) AS reach_medio,
          AVG(CASE WHEN reach > 0
                   THEN total_interactions::float / reach * 100
                   ELSE NULL END) AS engagement_pct
        FROM mkt.instagram_posts
        WHERE caption IS NOT NULL
          AND timestamp_publicacao BETWEEN :ts_since AND :ts_until
        GROUP BY 1
        """
    )
    r = await db.execute(q, {"ts_since": ts_since, "ts_until": ts_until})

    labels = {
        "curto": ("Curto (<100)", 0, 99),
        "medio": ("Médio (100-300)", 100, 299),
        "longo": ("Longo (300-800)", 300, 799),
        "muito_longo": ("Muito longo (800+)", 800, None),
    }
    ordem = ["curto", "medio", "longo", "muito_longo"]
    by_chave = {row.faixa: row for row in r.all()}
    return [
        CaptionFaixa(
            faixa=labels[chave][0],
            min_chars=labels[chave][1],
            max_chars=labels[chave][2],
            qtd=int(by_chave[chave].qtd) if chave in by_chave else 0,
            reach_medio=float(by_chave[chave].reach_medio or 0) if chave in by_chave else 0.0,
            engagement_pct=(
                float(by_chave[chave].engagement_pct)
                if chave in by_chave and by_chave[chave].engagement_pct is not None
                else None
            ),
        )
        for chave in ordem
    ]
