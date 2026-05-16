"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // 'checking' | 'ok' | 'no-token'
  const [state, setState] = useState<"checking" | "ok" | "no-token">("checking");

  // useLayoutEffect roda síncrono antes do paint, evita flash
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) {
      setState("no-token");
      router.replace("/login");
      return;
    }
    setState("ok");
  }, [router]);

  // Enquanto checa, mostra um placeholder neutro (não a tela)
  if (state !== "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
