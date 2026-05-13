"""Rotas de tracking — ingestão pública, redirect de short-links, stats e snippet JS."""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from sqlalchemy import and_, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.tracking import TrackingEvento, UtmLink
from app.models.user import User
from app.schemas.tracking import (
    StatLinha,
    StatSerie,
    StatTotais,
    StatsResponse,
    TrackEventIn,
    TrackEventOut,
)

router = APIRouter(prefix="/track", tags=["tracking"])


# ============================================================
# 1. Snippet JS público — cliente cola no HTML das LPs
# ============================================================

SNIPPET_JS = r"""
(function(){
  var API = '__API_URL__/track/event';
  var script = document.currentScript;
  var SITE = (script && script.getAttribute('data-site')) || 'default';

  function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36);}
  function getCookie(n){var m=document.cookie.match('(?:^|;)\\s*'+n+'=([^;]+)');return m?m[1]:null;}
  function setCookie(n,v,days){
    var d=new Date(); d.setTime(d.getTime()+days*864e5);
    document.cookie=n+'='+v+';expires='+d.toUTCString()+';path=/;SameSite=Lax';
  }

  var anonId = getCookie('cn_aid') || uid();
  setCookie('cn_aid', anonId, 365);

  var sessId = sessionStorage.getItem('cn_sid');
  if(!sessId){ sessId = uid(); sessionStorage.setItem('cn_sid', sessId); }

  function getUtms(){
    var p = new URLSearchParams(window.location.search);
    var keep = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
    var out = {};
    keep.forEach(function(k){ if(p.get(k)) out[k]=p.get(k); });
    // persiste utms na sessao
    if(Object.keys(out).length){ sessionStorage.setItem('cn_utm', JSON.stringify(out)); }
    else { try{ out = JSON.parse(sessionStorage.getItem('cn_utm')||'{}'); }catch(e){ out={}; } }
    return out;
  }

  function send(payload){
    payload.site = SITE;
    payload.anon_id = anonId;
    payload.session_id = sessId;
    payload.url = window.location.href;
    payload.path = window.location.pathname;
    payload.referrer = document.referrer;
    var utms = getUtms();
    Object.keys(utms).forEach(function(k){ payload[k] = utms[k]; });
    var body = JSON.stringify(payload);
    if(navigator.sendBeacon){
      navigator.sendBeacon(API, new Blob([body], {type:'application/json'}));
    } else {
      fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, body:body, keepalive:true});
    }
  }

  // 1) pageview automatico
  send({tipo:'pageview'});

  // 1b) conversao automatica via atributo no script (pag. de obrigado)
  //     <script src=".../snippet.js" data-site="X" data-conversion data-value="497" data-event="pagamento_confirmado" data-produto="Pos Junho"></script>
  if(script && script.hasAttribute('data-conversion')){
    var convPayload = {tipo:'conversion'};
    var cv = script.getAttribute('data-value'); if(cv) convPayload.valor = parseFloat(cv);
    var ce = script.getAttribute('data-event'); if(ce) convPayload.evento_nome = ce;
    var cp = script.getAttribute('data-produto'); if(cp) convPayload.produto_nome = cp;
    send(convPayload);
  }

  // 2) cliques: elementos com data-track="click" ou data-track="conversion"
  document.addEventListener('click', function(e){
    var el = e.target.closest('[data-track]');
    if(!el) return;
    var tipo = el.getAttribute('data-track');
    if(tipo!=='click' && tipo!=='conversion') return;
    var p = {tipo: tipo};
    var nome = el.getAttribute('data-event'); if(nome) p.evento_nome = nome;
    var valor = el.getAttribute('data-value'); if(valor) p.valor = parseFloat(valor);
    var prod = el.getAttribute('data-produto'); if(prod) p.produto_nome = prod;
    send(p);
  });

  // 3) API pública pra disparar manualmente
  window.cenatTrack = function(tipo, opts){
    opts = opts || {};
    opts.tipo = tipo;
    send(opts);
  };
})();
"""


@router.get("/snippet.js", include_in_schema=True)
async def get_snippet(request: Request):
    """Snippet JS público (sem auth). Cliente cola na LP."""
    base = str(request.base_url).rstrip("/") + "/api/v1"
    body = SNIPPET_JS.replace("__API_URL__", base)
    return PlainTextResponse(
        body,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=300"},
    )


# ============================================================
# 2. Ingestão pública (sem auth) — chamada pelo snippet
# ============================================================

@router.post("/event", response_model=TrackEventOut)
async def ingest_event(
    body: TrackEventIn,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")

    payload = body.model_dump()
    # campo 'metadata' do schema vira 'metadata_' do modelo
    metadata = payload.pop("metadata", {}) or {}

    evt = TrackingEvento(
        **payload,
        metadata_=metadata,
        ip=(ip or "")[:64] if ip else None,
        user_agent=ua,
    )
    db.add(evt)
    await db.commit()
    return TrackEventOut(ok=True)


# ============================================================
# 3. Redirect de short-link público — /track/r/{slug}
# ============================================================

@router.get("/r/{slug}", include_in_schema=False)
async def redirect_short_link(
    slug: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    res = await db.execute(select(UtmLink).where(UtmLink.slug == slug))
    link = res.scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Link não encontrado")

    # Monta URL final com UTMs
    parsed = urlparse(link.url_destino)
    qs = dict(parse_qsl(parsed.query))
    qs.update({
        "utm_source": link.utm_source,
        "utm_medium": link.utm_medium,
        "utm_campaign": link.utm_campaign,
    })
    if link.utm_term:
        qs["utm_term"] = link.utm_term
    if link.utm_content:
        qs["utm_content"] = link.utm_content
    final_url = urlunparse(parsed._replace(query=urlencode(qs)))

    # Registra clique + incrementa contador
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    evt = TrackingEvento(
        tipo="click",
        url=final_url,
        path=parsed.path,
        utm_source=link.utm_source,
        utm_medium=link.utm_medium,
        utm_campaign=link.utm_campaign,
        utm_term=link.utm_term,
        utm_content=link.utm_content,
        utm_link_id=link.id,
        produto_id=link.produto_id,
        produto_nome=link.produto_nome,
        evento_nome=f"short_link:{slug}",
        ip=(ip or "")[:64] if ip else None,
        user_agent=ua,
        metadata_={"slug": slug},
    )
    link.clicks = (link.clicks or 0) + 1
    db.add(evt)
    await db.commit()

    return RedirectResponse(url=final_url, status_code=302)


# ============================================================
# 4. Stats (autenticado) — dashboard GA4-like
# ============================================================

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    dias: int = Query(30, ge=1, le=365),
    utm_source: str | None = None,
    utm_campaign: str | None = None,
    produto: str | None = None,
):
    inicio = datetime.utcnow() - timedelta(days=dias)

    filtros = [TrackingEvento.created_at >= inicio]
    if utm_source:
        filtros.append(TrackingEvento.utm_source == utm_source)
    if utm_campaign:
        filtros.append(TrackingEvento.utm_campaign == utm_campaign)
    if produto:
        filtros.append(TrackingEvento.produto_nome.ilike(f"%{produto}%"))

    where_ = and_(*filtros)

    # Totais
    res = await db.execute(
        select(
            func.count().filter(TrackingEvento.tipo == "pageview").label("pv"),
            func.count().filter(TrackingEvento.tipo == "click").label("cl"),
            func.count().filter(TrackingEvento.tipo == "conversion").label("cv"),
            func.coalesce(
                func.sum(TrackingEvento.valor).filter(TrackingEvento.tipo == "conversion"),
                0,
            ).label("rev"),
            func.count(distinct(TrackingEvento.anon_id)).label("uniq"),
        ).where(where_)
    )
    row = res.one()
    pv, cl, cv, rev, uniq = row.pv or 0, row.cl or 0, row.cv or 0, row.rev or 0, row.uniq or 0
    taxa = round((cv / pv * 100), 2) if pv else 0.0

    totais = StatTotais(
        pageviews=pv,
        cliques=cl,
        conversoes=cv,
        receita=Decimal(rev),
        taxa_conversao=taxa,
        visitantes_unicos=uniq,
    )

    # Agregações
    # NOTA: GROUP BY na coluna real (não no coalesce) — asyncpg gera placeholders
    # bind diferentes pro mesmo literal e o Postgres rejeitaria coalesce(col, $1)
    # vs coalesce(col, $N) como expressões distintas. NULL vira um grupo e o
    # label "(direto)"/"(sem...)" é renderizado via coalesce só no SELECT.
    async def agrega_por(coluna, label_default="(direto)"):
        q = (
            select(
                func.coalesce(coluna, label_default).label("k"),
                func.count().filter(TrackingEvento.tipo == "pageview").label("pv"),
                func.count().filter(TrackingEvento.tipo == "click").label("cl"),
                func.count().filter(TrackingEvento.tipo == "conversion").label("cv"),
                func.coalesce(
                    func.sum(TrackingEvento.valor).filter(TrackingEvento.tipo == "conversion"),
                    0,
                ).label("rev"),
            )
            .where(where_)
            .group_by(coluna)
            .order_by(func.count().desc())
            .limit(20)
        )
        r = await db.execute(q)
        return [
            StatLinha(
                chave=str(x.k),
                pageviews=x.pv or 0,
                cliques=x.cl or 0,
                conversoes=x.cv or 0,
                receita=Decimal(x.rev or 0),
            )
            for x in r.all()
        ]

    por_source = await agrega_por(TrackingEvento.utm_source)
    por_campaign = await agrega_por(TrackingEvento.utm_campaign, "(sem campanha)")

    # Por produto (texto livre)
    por_produto = await agrega_por(TrackingEvento.produto_nome, "(sem produto)")

    # Série diária
    dia = func.date_trunc("day", TrackingEvento.created_at)
    q_serie = (
        select(
            dia.label("d"),
            func.count().filter(TrackingEvento.tipo == "pageview").label("pv"),
            func.count().filter(TrackingEvento.tipo == "click").label("cl"),
            func.count().filter(TrackingEvento.tipo == "conversion").label("cv"),
            func.coalesce(
                func.sum(TrackingEvento.valor).filter(TrackingEvento.tipo == "conversion"),
                0,
            ).label("rev"),
        )
        .where(where_)
        .group_by(dia)
        .order_by(dia)
    )
    r_serie = await db.execute(q_serie)
    serie = [
        StatSerie(
            data=x.d.date().isoformat() if isinstance(x.d, datetime) else str(x.d),
            pageviews=x.pv or 0,
            cliques=x.cl or 0,
            conversoes=x.cv or 0,
            receita=Decimal(x.rev or 0),
        )
        for x in r_serie.all()
    ]

    return StatsResponse(
        totais=totais,
        por_source=por_source,
        por_campaign=por_campaign,
        por_produto=por_produto,
        serie_diaria=serie,
    )
