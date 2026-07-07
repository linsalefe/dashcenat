import { api } from "@/lib/api";

// ---- tipos (espelham app/schemas/gerencia.py) ----
export type Board = {
  id: string;
  monday_board_id: number;
  nome: string;
  workspace: string | null;
  board_kind: string | null;
  incluido: boolean;
  confianca_classificacao: string | null;
  ativo: boolean;
  colunas_map: Record<string, unknown>;
  status_map: Record<string, string[]>;
  overrides: Record<string, unknown>;
  ultimo_sync: string | null;
  ultimo_sync_status: string | null;
  ultimo_sync_total: number;
  total_itens: number;
};

export type Resumo = {
  total: number;
  em_andamento: number;
  atrasadas: number;
  concluidas: number;
  sem_responsavel: number;
  sem_prazo: number;
  boards: number;
};

export type ResponsavelRef = {
  person_id: number | null;
  nome: string | null;
  kind: string | null;
};

export type Projeto = {
  id: string;
  board_id: string;
  board_nome: string;
  monday_item_id: number;
  nome: string | null;
  grupo: string | null;
  status: string | null;
  responsaveis: ResponsavelRef[];
  prazo_inicio: string | null;
  prazo_fim: string | null;
  concluido: boolean;
  atrasado: boolean;
  dias_atraso: number | null;
};

export type PorResponsavel = {
  person_id: number | null;
  nome: string;
  total: number;
  em_andamento: number;
  atrasadas: number;
  concluidas: number;
};

export type TendenciaPonto = {
  data: string;
  total: number;
  em_andamento: number;
  atrasadas: number;
  concluidas: number;
};

export type SyncResult = {
  ok: boolean;
  boards: number;
  boards_ok: number;
  boards_erro: number;
  total_itens: number;
  detalhe: Record<string, unknown>;
};

const qs = (boardId: string | null) => (boardId ? `?board_id=${boardId}` : "");

export const gerencia = {
  boards: (params?: { incluido?: boolean; ativo?: boolean }) => {
    const p = new URLSearchParams();
    if (params?.incluido !== undefined) p.set("incluido", String(params.incluido));
    if (params?.ativo !== undefined) p.set("ativo", String(params.ativo));
    const s = p.toString();
    return api.get<Board[]>(`/gerencia/boards${s ? `?${s}` : ""}`);
  },
  patchBoard: (id: string, body: { incluido?: boolean; overrides?: Record<string, unknown> }) =>
    api.patch<Board>(`/gerencia/boards/${id}`, body),
  resumo: (boardId: string | null) => api.get<Resumo>(`/gerencia/resumo${qs(boardId)}`),
  atrasadas: (boardId: string | null, limit = 100) =>
    api.get<Projeto[]>(`/gerencia/tarefas-atrasadas${qs(boardId)}${boardId ? "&" : "?"}limit=${limit}`),
  porResponsavel: (boardId: string | null) =>
    api.get<PorResponsavel[]>(`/gerencia/por-responsavel${qs(boardId)}`),
  tendencia: (boardId: string | null) =>
    api.get<TendenciaPonto[]>(`/gerencia/tendencia${qs(boardId)}`),
  sync: (boardId: string | null) => api.post<SyncResult>(`/gerencia/sync${qs(boardId)}`, {}),
};

// ---- formatação ----
export function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

export function fmtDataHora(iso: string | null): string {
  if (!iso) return "nunca";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function nomesResponsaveis(rs: ResponsavelRef[]): string {
  const nomes = rs.map((r) => r.nome).filter(Boolean);
  return nomes.length ? nomes.join(", ") : "—";
}
