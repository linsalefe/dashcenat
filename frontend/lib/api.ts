const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function formatarDetail(detail: unknown): string {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") {
          const obj = d as { msg?: string; loc?: unknown[]; type?: string };
          const campo = Array.isArray(obj.loc)
            ? obj.loc.filter((x) => x !== "body").join(".")
            : "";
          if (obj.msg && campo) return `${campo}: ${obj.msg}`;
          if (obj.msg) return obj.msg;
        }
        return JSON.stringify(d);
      })
      .join("; ");
  }

  if (typeof detail === "object") {
    const obj = detail as { msg?: string; detail?: string; error?: string };
    return obj.msg || obj.detail || obj.error || JSON.stringify(detail);
  }

  return String(detail);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new ApiError(401, "Não autorizado");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, formatarDetail(body.detail) || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
