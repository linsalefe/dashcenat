export type Frente = "pos" | "congresso" | "curso" | "comunidade";

export type FormatoKPI = "numero" | "moeda" | "percentual";

export interface DashboardKPI {
  label: string;
  valor: string;
  meta: string | null;
  pct_meta: string | null;
  formato: FormatoKPI;
}

export interface FrenteFunilEtapa {
  nome: string;
  meta: string | number | null;
  realizado: string | number | null;
  pct_meta: string | null;
}

export interface FrentePeriodoOut {
  id: string;
  frente: Frente;
  ano: number;
  mes: number;
  evento_nome: string;
  evento_id: string | null;

  investimento_ads: string;
  alcance: number;
  cliques: number;
  visitantes_lp: number;
  checkout: number;
  compras: number;

  meta_leads: number | null;
  leads: number | null;
  meta_ligacao: number | null;
  ligacao: number | null;
  meta_sql: number | null;
  sql_reuniao: number | null;
  meta_reuniao: number | null;
  reuniao_realizada: number | null;
  meta_vendas: number | null;
  vendas: number | null;

  meta_inscritos: number;
  inscritos: number;
  meta_receita: string;
  receita: string;

  ticket_medio: string | null;
  taxa_doity: string | null;
  no_show_pct: string | null;

  extras: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FrenteDashboardOut {
  frente: Frente;
  ano: number;
  mes: number;
  kpis: DashboardKPI[];
  funil: FrenteFunilEtapa[];
  eventos: FrentePeriodoOut[];
}

export interface FrentePeriodoCreate {
  frente: Frente;
  ano: number;
  mes: number;
  evento_nome: string;
  evento_id?: string | null;

  investimento_ads?: number;
  alcance?: number;
  cliques?: number;
  visitantes_lp?: number;
  checkout?: number;
  compras?: number;

  meta_inscritos?: number;
  inscritos?: number;
  meta_receita?: number;
  receita?: number;

  ticket_medio?: number | null;
  taxa_doity?: number | null;
}

export type FrentePeriodoUpdate = Partial<
  Omit<FrentePeriodoCreate, "frente" | "ano" | "mes" | "evento_nome">
>;

export function parseDecimal(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function formatarKPI(kpi: DashboardKPI): string {
  const n = parseDecimal(kpi.valor);
  if (kpi.formato === "moeda") {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  }
  if (kpi.formato === "percentual") {
    return `${(n * 100).toFixed(1)}%`;
  }
  return n.toLocaleString("pt-BR");
}

export function formatarMoeda(v: string | number | null | undefined): string {
  return parseDecimal(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarNumero(v: string | number | null | undefined): string {
  return parseDecimal(v).toLocaleString("pt-BR");
}

export function formatarPct(v: string | number | null | undefined): string {
  if (v == null) return "—";
  return `${(parseDecimal(v) * 100).toFixed(1)}%`;
}

/**
 * Converte string de input PT-BR pra number decimal.
 * Aceita: "217,32" → 217.32 / "217.32" → 217.32 / "1.234,56" → 1234.56.
 * Strings vazias ou inválidas viram null.
 *
 * Regra: se a string tem vírgula, vírgula é decimal e ponto é milhar.
 * Se só tem ponto, ponto é decimal (compatível com input ASCII).
 */
export function parseInputDecimal(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  let normalizado: string;
  if (s.includes(",")) {
    normalizado = s.replace(/\./g, "").replace(",", ".");
  } else {
    normalizado = s;
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte string de input pra inteiro positivo.
 * Aceita: "34156" → 34156 / "34.156" → 34156 / "34,156" → 34156.
 * Pra inteiros, qualquer ponto/vírgula é separador de milhar — remove ambos.
 * Strings vazias ou inválidas viram null.
 */
export function parseInputInteiro(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  const limpo = s.replace(/[.,]/g, "");
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
