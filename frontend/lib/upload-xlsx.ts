const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api/v1";

export interface ETLResult {
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  warnings: string[];
  period_detected: string | null;
}

export async function uploadXlsx(
  endpoint: "meta-ads" | "hotmart" | "lancamentos",
  file: File,
): Promise<ETLResult> {
  const fd = new FormData();
  fd.append("file", file);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_URL}/etl/${endpoint}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Erro ${res.status}`);
  }
  return await res.json();
}
