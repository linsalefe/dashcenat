"""Endpoint consolidado pra tela /overview do frontend (Sprint APR1)."""
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.comercial import Intercambio
from app.models.mkt import Lancamento, MetaAdsCampanha, VendaHotmart
from app.models.user import User
from app.schemas.mkt import (
    FrenteReceita,
    FunilEtapa,
    ImersaoDetalhe,
    MetaAdsResumo,
    OverviewMensal,
    TopCampanha,
    TopEvento,
)

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("", response_model=OverviewMensal)
async def get_overview(
    ano: Annotated[int, Query(ge=2025, le=2099)],
    mes: Annotated[int, Query(ge=1, le=12)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    # ─────────────────────────────────────────────────────
    # 1) FUNIL COMERCIAL
    # ─────────────────────────────────────────────────────
    funil_query = text("""
        SELECT etapa.codigo, etapa.nome, etapa.ordem,
               COALESCE(SUM(fr.meta), 0)::bigint as meta,
               COALESCE(SUM(fr.resultado), 0)::bigint as resultado
        FROM comercial.funil_etapas etapa
        LEFT JOIN comercial.funil_resultado fr
          ON fr.etapa_id = etapa.id AND fr.ano = :ano AND fr.mes = :mes
        GROUP BY etapa.id, etapa.codigo, etapa.nome, etapa.ordem
        ORDER BY etapa.ordem
    """)
    funil_rows = (await db.execute(funil_query, {"ano": ano, "mes": mes})).fetchall()

    funil: list[FunilEtapa] = []
    valores_etapa: list[int] = []
    for i, r in enumerate(funil_rows):
        meta = int(r.meta) if r.meta else None
        resultado = int(r.resultado) if r.resultado else 0
        taxa_anterior = None
        if i > 0 and valores_etapa[i - 1] > 0:
            taxa_anterior = Decimal(resultado) / Decimal(valores_etapa[i - 1])
        valores_etapa.append(resultado)
        funil.append(FunilEtapa(
            nome=r.nome,
            resultado=resultado,
            meta=meta,
            taxa_anterior=taxa_anterior,
        ))

    funil_taxas: dict[str, Decimal] = {}
    if len(valores_etapa) >= 5:
        if valores_etapa[0] > 0:
            funil_taxas["lead_ligacao"] = Decimal(valores_etapa[1]) / Decimal(valores_etapa[0])
            funil_taxas["lead_venda"] = Decimal(valores_etapa[4]) / Decimal(valores_etapa[0])
        if valores_etapa[1] > 0:
            funil_taxas["ligacao_sql"] = Decimal(valores_etapa[2]) / Decimal(valores_etapa[1])
        if valores_etapa[2] > 0:
            funil_taxas["sql_reuniao"] = Decimal(valores_etapa[3]) / Decimal(valores_etapa[2])
        if valores_etapa[3] > 0:
            funil_taxas["reuniao_venda"] = Decimal(valores_etapa[4]) / Decimal(valores_etapa[3])

    # ─────────────────────────────────────────────────────
    # 2) META ADS
    # ─────────────────────────────────────────────────────
    meta_q = select(
        func.coalesce(func.sum(MetaAdsCampanha.investimento), 0).label("invest"),
        func.coalesce(func.sum(MetaAdsCampanha.impressoes), 0).label("impr"),
        func.coalesce(func.sum(MetaAdsCampanha.alcance), 0).label("alc"),
        func.coalesce(func.sum(MetaAdsCampanha.cliques), 0).label("clk"),
        func.coalesce(func.sum(MetaAdsCampanha.leads), 0).label("leads"),
        func.coalesce(func.sum(MetaAdsCampanha.leads_imersao), 0).label("leads_im"),
        func.coalesce(func.sum(MetaAdsCampanha.compras), 0).label("compras"),
        func.coalesce(func.sum(MetaAdsCampanha.valor_resultados), 0).label("rec_pixel"),
        func.count(MetaAdsCampanha.id).label("n"),
    ).where(and_(MetaAdsCampanha.ano == ano, MetaAdsCampanha.mes == mes))
    meta_row = (await db.execute(meta_q)).first()

    meta_ads: MetaAdsResumo | None = None
    if meta_row and meta_row.n > 0:
        invest = Decimal(meta_row.invest)
        impr = int(meta_row.impr)
        alc = int(meta_row.alc)
        clk = int(meta_row.clk)
        rec_pix = Decimal(meta_row.rec_pixel)

        ctr = (Decimal(clk) / Decimal(impr) * 100) if impr else None
        cpm = (invest / Decimal(impr) * 1000) if impr else None
        cpc = (invest / Decimal(clk)) if clk else None
        roas_pix = (rec_pix / invest) if invest > 0 else None

        meta_ads = MetaAdsResumo(
            investimento=invest,
            impressoes=impr,
            alcance=alc,
            cliques=clk,
            ctr=ctr,
            cpm=cpm,
            cpc=cpc,
            leads=int(meta_row.leads),
            leads_imersao=int(meta_row.leads_im),
            compras_pixel=int(meta_row.compras),
            receita_pixel=rec_pix,
            roas_pixel=roas_pix,
            n_campanhas=int(meta_row.n),
        )

    # ─────────────────────────────────────────────────────
    # 3) TOP CAMPANHAS
    # ─────────────────────────────────────────────────────
    top_camp_q = (
        select(
            MetaAdsCampanha.nome_campanha,
            MetaAdsCampanha.investimento,
            MetaAdsCampanha.valor_resultados,
        )
        .where(and_(
            MetaAdsCampanha.ano == ano,
            MetaAdsCampanha.mes == mes,
            MetaAdsCampanha.valor_resultados > 0,
        ))
        .order_by(MetaAdsCampanha.valor_resultados.desc())
        .limit(5)
    )
    top_campanhas: list[TopCampanha] = []
    for r in (await db.execute(top_camp_q)).all():
        roas = (Decimal(r.valor_resultados) / Decimal(r.investimento)) if r.investimento else Decimal(0)
        nome = r.nome_campanha[:80]
        top_campanhas.append(TopCampanha(
            nome=nome,
            investimento=Decimal(r.investimento),
            receita=Decimal(r.valor_resultados),
            roas=roas,
        ))

    # ─────────────────────────────────────────────────────
    # 4) HOTMART
    # ─────────────────────────────────────────────────────
    inicio = date(ano, mes, 1)
    fim = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)

    hotmart_comunidade_q = select(
        func.coalesce(func.sum(VendaHotmart.preco_total), 0).label("total"),
        func.count(VendaHotmart.id).label("n"),
    ).where(and_(
        VendaHotmart.data_venda >= inicio,
        VendaHotmart.data_venda < fim,
        VendaHotmart.produto.ilike("%comunidade%"),
    ))
    hotmart_row = (await db.execute(hotmart_comunidade_q)).first()
    receita_comunidade = Decimal(hotmart_row.total) if hotmart_row else Decimal(0)
    qtd_comunidade = int(hotmart_row.n) if hotmart_row else 0

    hotmart_cursos_q = select(
        func.coalesce(func.sum(VendaHotmart.preco_total), 0).label("total"),
        func.count(VendaHotmart.id).label("n"),
    ).where(and_(
        VendaHotmart.data_venda >= inicio,
        VendaHotmart.data_venda < fim,
        VendaHotmart.produto.notilike("%comunidade%"),
    ))
    hotmart_cur_row = (await db.execute(hotmart_cursos_q)).first()
    receita_cursos_hot = Decimal(hotmart_cur_row.total) if hotmart_cur_row else Decimal(0)
    qtd_cursos_hot = int(hotmart_cur_row.n) if hotmart_cur_row else 0

    # ─────────────────────────────────────────────────────
    # 5) LANÇAMENTO
    # ─────────────────────────────────────────────────────
    lanc_q = select(Lancamento).where(and_(Lancamento.ano == ano, Lancamento.mes == mes))
    lanc = (await db.execute(lanc_q)).scalar_one_or_none()

    imersao: ImersaoDetalhe | None = None
    receita_imersao = Decimal(0)
    if lanc:
        imersao = ImersaoDetalhe(
            nome=lanc.nome,
            investimento_resultado=lanc.investimento_resultado,
            receita_resultado=lanc.receita_resultado,
            leads_total=lanc.leads_total or 0,
            leads_organico=lanc.leads_organico or 0,
            leads_pago=lanc.leads_pago or 0,
            cpl_resultado=lanc.cpl_resultado,
            mqls_resultado=lanc.mqls_resultado,
            engajamento=lanc.engajamento or {},
        )
        receita_imersao = Decimal(lanc.receita_resultado or 0)

    # ─────────────────────────────────────────────────────
    # 6) INTERCAMBIO
    # ─────────────────────────────────────────────────────
    inter_q = select(
        func.coalesce(func.sum(Intercambio.valor), 0).label("total"),
        func.count(Intercambio.id).label("n"),
    ).where(and_(
        Intercambio.data_venda >= inicio,
        Intercambio.data_venda < fim,
    ))
    inter_row = (await db.execute(inter_q)).first()
    receita_intercambio = Decimal(inter_row.total) if inter_row else Decimal(0)
    qtd_intercambio = int(inter_row.n) if inter_row else 0

    # ─────────────────────────────────────────────────────
    # 7) PÓS-GRADUAÇÃO
    # ─────────────────────────────────────────────────────
    pos_q = text("""
        SELECT COALESCE(SUM(v.valor), 0) as total, COUNT(v.id) as n
        FROM comercial.vendas v
        WHERE EXTRACT(YEAR FROM v.data_venda) = :ano
          AND EXTRACT(MONTH FROM v.data_venda) = :mes
    """)
    pos_row = (await db.execute(pos_q, {"ano": ano, "mes": mes})).first()
    receita_pos = Decimal(pos_row.total) if pos_row else Decimal(0)
    qtd_pos = int(pos_row.n) if pos_row else 0

    # Fallback: usa funil etapa 5 × 5000 quando não há vendas individuais
    if qtd_pos == 0 and len(valores_etapa) >= 5 and valores_etapa[4] > 0:
        qtd_pos = valores_etapa[4]
        receita_pos = Decimal(qtd_pos) * Decimal(5000)

    # ─────────────────────────────────────────────────────
    # 8) CONGRESSOS / EVENTOS
    # ─────────────────────────────────────────────────────
    eventos_q = text("""
        SELECT e.nome, COALESCE(SUM(ie.inscritos), 0) as inscritos,
               COALESCE(SUM(ie.receita), 0) as receita
        FROM core.eventos e
        LEFT JOIN mkt.inscricoes_evento ie ON ie.evento_id = e.id
            AND EXTRACT(YEAR FROM ie.data_registro) = :ano
            AND EXTRACT(MONTH FROM ie.data_registro) = :mes
        WHERE e.ativo = true
        GROUP BY e.id, e.nome
        HAVING COALESCE(SUM(ie.inscritos), 0) > 0
        ORDER BY receita DESC
        LIMIT 5
    """)
    eventos_rows = (await db.execute(eventos_q, {"ano": ano, "mes": mes})).fetchall()
    top_eventos = [
        TopEvento(nome=r.nome[:80], inscritos=int(r.inscritos), receita=Decimal(r.receita))
        for r in eventos_rows
    ]
    receita_congressos: Decimal = sum((e.receita for e in top_eventos), Decimal(0))

    # ─────────────────────────────────────────────────────
    # 9) FRENTES
    # ─────────────────────────────────────────────────────
    frentes: list[FrenteReceita] = []
    if receita_pos > 0:
        ticket_str = ""
        if qtd_pos:
            ticket = receita_pos / qtd_pos
            ticket_str = f" · ticket R$ {int(ticket):,}".replace(",", ".")
        frentes.append(FrenteReceita(
            label="Pós-Graduação",
            valor=receita_pos,
            quantidade=qtd_pos,
            detalhe=f"{qtd_pos} alunos{ticket_str}",
        ))
    if receita_congressos > 0:
        total_inscritos = sum(e.inscritos for e in top_eventos)
        frentes.append(FrenteReceita(
            label="Congressos",
            valor=receita_congressos,
            quantidade=total_inscritos,
            detalhe=f"{total_inscritos} inscritos · {len(top_eventos)} eventos",
        ))
    if receita_comunidade > 0:
        frentes.append(FrenteReceita(
            label="Comunidade",
            valor=receita_comunidade,
            quantidade=qtd_comunidade,
            detalhe=f"{qtd_comunidade} vendas Hotmart",
        ))
    if imersao and imersao.leads_total:
        frentes.append(FrenteReceita(
            label="Imersão",
            valor=receita_imersao,
            quantidade=imersao.mqls_resultado or 0,
            detalhe=f"{imersao.leads_total:,} leads · {imersao.mqls_resultado or 0} MQLs".replace(",", "."),
        ))
    if receita_cursos_hot > 0:
        frentes.append(FrenteReceita(
            label="Cursos Livres",
            valor=receita_cursos_hot,
            quantidade=qtd_cursos_hot,
            detalhe=f"{qtd_cursos_hot} vendas",
        ))
    if receita_intercambio > 0:
        frentes.append(FrenteReceita(
            label="Intercâmbio",
            valor=receita_intercambio,
            quantidade=qtd_intercambio,
            detalhe="Receita complementar",
        ))

    receita_total = (
        receita_pos + receita_congressos + receita_comunidade
        + receita_imersao + receita_cursos_hot + receita_intercambio
    )

    roas_bruto = None
    if meta_ads and meta_ads.investimento > 0:
        roas_bruto = receita_total / meta_ads.investimento

    has_data = (
        receita_total > 0
        or any(e.resultado > 0 for e in funil)
        or meta_ads is not None
        or imersao is not None
    )

    return OverviewMensal(
        ano=ano,
        mes=mes,
        has_data=has_data,
        receita_total=receita_total,
        roas_bruto=roas_bruto,
        frentes=frentes,
        funil_comercial=funil,
        funil_taxas=funil_taxas,
        meta_ads=meta_ads,
        top_campanhas=top_campanhas,
        top_eventos=top_eventos,
        imersao=imersao,
    )
