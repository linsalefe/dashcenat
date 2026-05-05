"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle, MessageCircle, BarChart3, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: { id: string; email: string; nome: string; ativo: boolean };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (t) router.push("/overview");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post<LoginResponse>("/auth/login", { email, senha: password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/overview");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Email ou senha incorretos";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a1628] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(29,78,216,0.12)_0%,_transparent_70%)]" />

      {/* ── Branding (esquerda) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1D4ED8]/15 via-transparent to-[#3b82f6]/5" />
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#1D4ED8]/10 rounded-full blur-3xl blob-drift" />
        <div className="absolute bottom-1/4 right-10 w-72 h-72 bg-[#3b82f6]/8 rounded-full blur-3xl blob-drift-reverse" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className={`relative z-10 max-w-lg transition-all duration-1000 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#60a5fa]" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white tracking-tight">DashCENAT</span>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-3">
            Marketing e comercial,
            <br />
            <span className="text-[#60a5fa]">consolidados.</span>
          </h1>
          <p className="text-base text-gray-400 leading-relaxed max-w-md">
            Funil de vendas, métricas de canal e ROI de eventos do CENAT em um lugar só.
          </p>

          <div className="flex flex-wrap gap-3 mt-10">
            {[
              { icon: BarChart3, label: "Funil completo" },
              { icon: MessageCircle, label: "8 canais de mkt" },
              { icon: Calendar, label: "Gestão de eventos" },
            ].map((feat, i) => (
              <div
                key={feat.label}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm transition-all duration-700 ease-out ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${800 + i * 150}ms` }}
              >
                <feat.icon className="w-4 h-4 text-[#60a5fa]" />
                <span className="text-sm text-gray-300 font-medium">{feat.label}</span>
              </div>
            ))}
          </div>

          <div
            className={`mt-12 flex items-center gap-2 transition-all duration-700 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDelay: "1200ms" }}
          >
            <p className="text-[13px] text-gray-500">Dashboard interno do CENAT</p>
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

      {/* ── Form (direita) ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />

        <div
          className={`w-full max-w-[420px] relative z-10 transition-all duration-700 ease-out delay-300 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#60a5fa]" />
            </div>
            <span className="text-2xl font-bold text-white">DashCENAT</span>
          </div>

          <div className="login-card-glow backdrop-blur-xl p-8 shadow-2xl shadow-black/30">
            <div className="mb-7">
              <h2 className="text-[22px] font-bold text-[#0f172a]">Bem-vindo de volta</h2>
              <p className="text-gray-500 text-sm mt-1">Entre com suas credenciais para acessar</p>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium text-gray-600">Email</Label>
                <div className="relative input-glow rounded-xl transition-all">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl text-sm focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] font-medium text-gray-600">Senha</Label>
                <div className="relative input-glow rounded-xl transition-all">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-10 pr-12 h-12 bg-gray-50 border-gray-200 rounded-xl text-sm focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl shadow-lg shadow-[#1D4ED8]/25 hover:shadow-xl hover:shadow-[#1D4ED8]/30 active:scale-[0.98] transition-all duration-200 mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-6">
            CENAT © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
