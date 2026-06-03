// Tipos do JSON exato retornado pelos endpoints `/doity/*` (backend single-source-of-truth:
// backend/app/schemas/doity.py).

export interface DoityConfigOut {
  evento_id: string;
  evento_nome: string;
  doity_event_id: number | null;
  configurado: boolean;
  token_mask: string | null;
  situacoes_pagas: number[];
  campo_whatsapp: string | null;
  cursor: string | null;
  ultimo_sync: string | null;
  ultimo_sync_status: string | null;
  ultimo_sync_erro: string | null;
  ultimo_sync_total: number;
}

export interface DoityAnaliseTotais {
  inscricoes: number;
  pagas: number;
  em_contestacao: number;
  gratuitas: number;
  itens: number; // linhas cruas (ingressos + oficinas) — transparência vs. inscritos por pessoa
  receita: string; // Decimal vem como string no JSON
  ticket_medio: string | null;
}

export interface DoityAnaliseSerie {
  data: string; // YYYY-MM-DD
  inscricoes: number;
  pagas: number;
  receita: string;
}

export interface DoityAnaliseFacet {
  chave: string;
  inscricoes: number;
  pagas: number;
}

export interface DoityAnaliseMeta {
  meta_inscritos: number | null;
  meta_receita: string | null;
  pct_inscritos: number | null;
  pct_receita: number | null;
}

export interface DoityAnaliseOut {
  evento_id: string;
  evento_nome: string;
  totais: DoityAnaliseTotais;
  serie_diaria: DoityAnaliseSerie[];
  por_estado: DoityAnaliseFacet[];
  por_cidade: DoityAnaliseFacet[];
  por_profissao: DoityAnaliseFacet[];
  por_genero: DoityAnaliseFacet[];
  meta: DoityAnaliseMeta;
}

// Shape do GET /eventos (catálogo).
export interface EventoOut {
  id: string;
  nome: string;
  produto_id: string | null;
  meta_inscritos: number | null;
  meta_receita: string | null;
  valor_inscricao: string | null;
  data_final: string | null;
  data_finalizacao: string | null;
  meta_cpl: string | null;
  orcamento: string | null;
  ativo: boolean;
  criado_em: string;
}
