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
from app.models.mkt import VendaHotmart
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

  // 4) Hotmart link rewriter — adiciona ?src=cn_aid:X|utm_*:Y nos links de checkout
  //    Detecta automaticamente <a href> que aponta pra domínios da Hotmart e injeta
  //    o tracking. Cliente só precisa do snippet — sem mudar HTML.
  var HOTMART_HOSTS = [
    'pay.hotmart.com',
    'go.hotmart.com',
    'app-vlc.hotmart.com',
    'hotmart.com'
  ];

  function isHotmartUrl(href){
    if(!href) return false;
    try {
      var u = new URL(href, window.location.href);
      return HOTMART_HOSTS.some(function(h){
        return u.hostname === h || u.hostname.endsWith('.' + h);
      });
    } catch(e){ return false; }
  }

  function buildSrcParam(){
    // Formato chave:valor|chave:valor (Hotmart-friendly, sem caracteres especiais)
    var utms = getUtms();
    var parts = ['cn_aid:' + anonId];
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k){
      if(utms[k]) parts.push(k + ':' + String(utms[k]).replace(/[|:]/g,'-'));
    });
    return parts.join('|');
  }

  function rewriteHotmartLink(a){
    if(!a || a.dataset.cnRewritten === '1') return;
    var href = a.getAttribute('href');
    if(!isHotmartUrl(href)) return;
    try {
      var u = new URL(href, window.location.href);
      // não sobrescreve se cliente já definiu src=
      if(u.searchParams.get('src')) { a.dataset.cnRewritten = '1'; return; }
      u.searchParams.set('src', buildSrcParam());
      a.setAttribute('href', u.toString());
      a.dataset.cnRewritten = '1';
    } catch(e){}
  }

  function rewriteAllHotmartLinks(){
    var links = document.querySelectorAll('a[href]');
    for(var i=0; i<links.length; i++) rewriteHotmartLink(links[i]);
  }

  // Função pública pra construir link manualmente em onclick
  window.cenatBuildHotmartLink = function(url){
    try {
      var u = new URL(url, window.location.href);
      u.searchParams.set('src', buildSrcParam());
      return u.toString();
    } catch(e){ return url; }
  };

  // Reescreve no carregamento inicial
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', rewriteAllHotmartLinks);
  } else {
    rewriteAllHotmartLinks();
  }

  // E observa novos links que sejam injetados depois (popups, modais, SPAs)
  if(window.MutationObserver){
    var obs = new MutationObserver(function(muts){
      for(var i=0; i<muts.length; i++){
        var m = muts[i];
        for(var j=0; j<m.addedNodes.length; j++){
          var node = m.addedNodes[j];
          if(node.nodeType !== 1) continue;
          if(node.tagName === 'A') rewriteHotmartLink(node);
          else if(node.querySelectorAll){
            var inner = node.querySelectorAll('a[href]');
            for(var k=0; k<inner.length; k++) rewriteHotmartLink(inner[k]);
          }
        }
      }
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
  }

  // 5) Click listener — injeta cta:<data-event> no src no momento do clique.
  //    Capture phase pra rodar ANTES da navegação. Não bloqueia o evento.
  document.addEventListener('click', function(ev){
    // Busca o <a> mais próximo (clique pode ter sido no filho)
    var node = ev.target;
    var a = null;
    while(node && node !== document){
      if(node.tagName === 'A' && node.hasAttribute('href')){ a = node; break; }
      node = node.parentNode;
    }
    if(!a) return;
    var href = a.getAttribute('href');
    if(!isHotmartUrl(href)) return;

    // Pega data-event do <a> ou do ancestral mais próximo que tenha
    var ctaName = null;
    var n2 = a;
    while(n2 && n2 !== document){
      if(n2.dataset && n2.dataset.event){ ctaName = n2.dataset.event; break; }
      n2 = n2.parentNode;
    }
    if(!ctaName) return; // sem data-event não injeta

    try {
      var u = new URL(href, window.location.href);
      var existing = u.searchParams.get('src') || '';
      // Sanitiza: remove caracteres que quebrariam o formato chave:valor|...
      var clean = String(ctaName).replace(/[|:]/g, '-').slice(0, 60);
      // Se já tem cta: no src, substitui; senão append
      if(/(^|\|)cta:/.test(existing)){
        existing = existing.replace(/(^|\|)cta:[^|]*/, '$1cta:' + clean);
      } else if(existing){
        existing = existing + '|cta:' + clean;
      } else {
        existing = 'cn_aid:' + anonId + '|cta:' + clean;
      }
      u.searchParams.set('src', existing);
      a.setAttribute('href', u.toString());
    } catch(e){}
  }, true);
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
    since: date | None = Query(None),
    until: date | None = Query(None),
    utm_source: str | None = None,
    utm_campaign: str | None = None,
    produto: str | None = None,
):
    # since/until têm precedência sobre dias. Se só since vier, until=hoje.
    # Se só until vier, since = until - dias.
    if since or until:
        if not until:
            until = date.today()
        if not since:
            since = until - timedelta(days=dias)
        inicio = datetime.combine(since, datetime.min.time())
        fim = datetime.combine(until, datetime.max.time())
    else:
        inicio = datetime.utcnow() - timedelta(days=dias)
        fim = None

    filtros = [TrackingEvento.created_at >= inicio]
    if fim is not None:
        filtros.append(TrackingEvento.created_at <= fim)
    if utm_source:
        filtros.append(TrackingEvento.utm_source == utm_source)
    if utm_campaign:
        filtros.append(TrackingEvento.utm_campaign == utm_campaign)
    if produto:
        filtros.append(TrackingEvento.produto_nome.ilike(f"%{produto}%"))

    where_ = and_(*filtros)

    # ============================================================
    # Vendas reais Hotmart (atribuídas via UTM com matched_via real)
    # Janela = mesma janela do tracking (dias atrás)
    # Só conta vendas APPROVED + COMPLETE com origem rastreada
    # ============================================================
    vendas_where = and_(
        VendaHotmart.data_venda >= inicio,
        VendaHotmart.status.in_(("APPROVED", "COMPLETE")),
        VendaHotmart.matched_via.in_(("hotmart_anon_id", "hotmart_src", "email")),
    )
    if fim is not None:
        vendas_where = and_(vendas_where, VendaHotmart.data_venda <= fim)
    # Filtros locais espelhando os do tracking
    if utm_source:
        vendas_where = and_(vendas_where, VendaHotmart.utm_source == utm_source)
    if utm_campaign:
        vendas_where = and_(vendas_where, VendaHotmart.utm_campaign == utm_campaign)
    if produto:
        vendas_where = and_(vendas_where, VendaHotmart.produto.ilike(f"%{produto}%"))

    # Totais — tracking
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

    # Totais — vendas Hotmart
    res_v = await db.execute(
        select(
            func.count().label("vendas"),
            func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("rev_real"),
        ).where(vendas_where)
    )
    row_v = res_v.one()
    vendas_total = row_v.vendas or 0
    receita_real = Decimal(row_v.rev_real or 0)
    ticket_medio = (receita_real / vendas_total) if vendas_total > 0 else Decimal(0)

    # Taxa de conversão: vendas reais / visitantes únicos
    taxa = round((float(vendas_total) / uniq * 100), 2) if uniq else 0.0

    totais = StatTotais(
        pageviews=pv,
        cliques=cl,
        conversoes=cv,
        receita=Decimal(rev),
        taxa_conversao=taxa,
        visitantes_unicos=uniq,
        vendas=vendas_total,
        receita_real=receita_real,
        ticket_medio=ticket_medio,
    )

    # ============================================================
    # Helper: agrega tracking + vendas por uma coluna
    # ============================================================
    async def agrega_por(
        coluna_tracking,
        coluna_vendas,
        label_default="(direto)",
    ):
        # 1) Agregação do tracking
        q_t = (
            select(
                func.coalesce(coluna_tracking, label_default).label("k"),
                func.count().filter(TrackingEvento.tipo == "pageview").label("pv"),
                func.count().filter(TrackingEvento.tipo == "click").label("cl"),
                func.count().filter(TrackingEvento.tipo == "conversion").label("cv"),
                func.coalesce(
                    func.sum(TrackingEvento.valor).filter(TrackingEvento.tipo == "conversion"),
                    0,
                ).label("rev"),
            )
            .where(where_)
            .group_by(coluna_tracking)
        )
        r_t = await db.execute(q_t)
        linhas_t = {str(x.k): x for x in r_t.all()}

        # 2) Agregação das vendas (Hotmart) — só roda se há coluna correspondente
        linhas_v: dict[str, tuple[int, Decimal]] = {}
        if coluna_vendas is not None:
            q_v = (
                select(
                    func.coalesce(coluna_vendas, label_default).label("k"),
                    func.count().label("vendas"),
                    func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("rev_real"),
                )
                .where(vendas_where)
                .group_by(coluna_vendas)
            )
            r_v = await db.execute(q_v)
            for x in r_v.all():
                linhas_v[str(x.k)] = (x.vendas or 0, Decimal(x.rev_real or 0))

        # 3) Merge: união das chaves (tracking + vendas)
        chaves = set(linhas_t.keys()) | set(linhas_v.keys())
        out = []
        for k in chaves:
            t_row = linhas_t.get(k)
            v_row = linhas_v.get(k, (0, Decimal(0)))
            out.append(
                StatLinha(
                    chave=k,
                    pageviews=t_row.pv if t_row else 0,
                    cliques=t_row.cl if t_row else 0,
                    conversoes=t_row.cv if t_row else 0,
                    receita=Decimal(t_row.rev if t_row else 0),
                    vendas=v_row[0],
                    receita_real=v_row[1],
                )
            )
        # Ordena: primeiro por receita real desc, depois por pageviews
        out.sort(key=lambda r: (float(r.receita_real), r.pageviews), reverse=True)
        return out[:20]

    por_source = await agrega_por(
        TrackingEvento.utm_source, VendaHotmart.utm_source
    )
    por_campaign = await agrega_por(
        TrackingEvento.utm_campaign, VendaHotmart.utm_campaign, "(sem campanha)"
    )
    por_produto = await agrega_por(
        TrackingEvento.produto_nome, VendaHotmart.produto, "(sem produto)"
    )

    # Por CTA: tracking grava em evento_nome (data-event); Hotmart grava em cta
    por_cta = await agrega_por(
        TrackingEvento.evento_nome, VendaHotmart.cta, "(sem cta)"
    )
    # Filtra CTAs: só os que começam com "cta_" (ignora link_*, scroll_*, short_link:*)
    por_cta = [c for c in por_cta if c.chave.startswith("cta_") or c.vendas > 0]

    # ============================================================
    # Série diária (tracking + vendas)
    # ============================================================
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
    serie_t = {
        (x.d.date().isoformat() if isinstance(x.d, datetime) else str(x.d)): x
        for x in r_serie.all()
    }

    # Vendas por dia
    dia_v = func.date_trunc("day", VendaHotmart.data_venda)
    q_serie_v = (
        select(
            dia_v.label("d"),
            func.count().label("vendas"),
            func.coalesce(func.sum(VendaHotmart.faturamento_liquido), 0).label("rev_real"),
        )
        .where(vendas_where)
        .group_by(dia_v)
        .order_by(dia_v)
    )
    r_serie_v = await db.execute(q_serie_v)
    serie_v = {
        (x.d.date().isoformat() if isinstance(x.d, datetime) else str(x.d)): x
        for x in r_serie_v.all()
    }

    # Merge das duas séries
    dias_all = sorted(set(serie_t.keys()) | set(serie_v.keys()))
    serie = []
    for d in dias_all:
        t_row = serie_t.get(d)
        v_row = serie_v.get(d)
        serie.append(
            StatSerie(
                data=d,
                pageviews=t_row.pv if t_row else 0,
                cliques=t_row.cl if t_row else 0,
                conversoes=t_row.cv if t_row else 0,
                receita=Decimal(t_row.rev if t_row else 0),
                vendas=v_row.vendas if v_row else 0,
                receita_real=Decimal(v_row.rev_real if v_row else 0),
            )
        )

    return StatsResponse(
        totais=totais,
        por_source=por_source,
        por_campaign=por_campaign,
        por_produto=por_produto,
        por_cta=por_cta,
        serie_diaria=serie,
    )
