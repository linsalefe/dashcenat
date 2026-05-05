"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  email: string;
  nome: string;
}

const NAV_ITEMS = [
  { label: "Overview", href: "/overview" },
  { label: "Comercial", href: "/comercial/funil", children: [
    { label: "Funil", href: "/comercial/funil" },
    { label: "Preencher", href: "/comercial/preencher" },
    { label: "Vendas", href: "/comercial/vendas" },
    { label: "Reunioes", href: "/comercial/reunioes" },
  ]},
  { label: "Marketing", href: "/marketing/trafego-pago", children: [
    { label: "Trafego Pago", href: "/marketing/trafego-pago" },
    { label: "Redes Sociais", href: "/marketing/redes-sociais" },
    { label: "YouTube", href: "/marketing/youtube" },
    { label: "Podcast", href: "/marketing/podcast" },
    { label: "Blog", href: "/marketing/blog" },
    { label: "E-mail", href: "/marketing/email" },
    { label: "Landing Pages", href: "/marketing/landing-pages" },
    { label: "SEO", href: "/marketing/seo" },
  ]},
  { label: "Eventos", href: "/eventos" },
  { label: "Catalogo", href: "/catalogo/produtos", children: [
    { label: "Produtos", href: "/catalogo/produtos" },
    { label: "Eventos", href: "/catalogo/eventos" },
    { label: "Canais", href: "/catalogo/canais" },
  ]},
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(userData));

    // Auto-expand active section
    for (const item of NAV_ITEMS) {
      if (item.children && item.children.some((c) => pathname.startsWith(c.href))) {
        setOpenSections((prev) => ({ ...prev, [item.label]: true }));
      }
    }
  }, [pathname, router]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  function toggleSection(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-zinc-900 text-zinc-100 flex flex-col">
        <div className="p-4 border-b border-zinc-700">
          <h1 className="text-lg font-bold tracking-tight">DashCENAT</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleSection(item.label)}
                    className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-zinc-800 flex items-center justify-between ${
                      pathname.startsWith(item.href.split("/").slice(0, 2).join("/"))
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-300"
                    }`}
                  >
                    {item.label}
                    <span className="text-xs">
                      {openSections[item.label] ? "\u25B2" : "\u25BC"}
                    </span>
                  </button>
                  {openSections[item.label] && (
                    <div className="ml-4">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-4 py-1.5 text-sm ${
                            pathname === child.href
                              ? "text-white bg-zinc-700"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={`block px-4 py-2 text-sm font-medium ${
                    pathname === item.href
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-700">
          <p className="text-xs text-zinc-400 truncate mb-2">{user.nome}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-zinc-300 border-zinc-600 hover:bg-zinc-800 hover:text-white"
            onClick={handleLogout}
          >
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-zinc-50">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
