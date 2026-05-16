"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  ClipboardEdit,
  ShoppingBag,
  Calendar,
  Megaphone,
  Camera,
  PlaySquare,
  Mic,
  FileText,
  Mail,
  MousePointer,
  Search,
  CalendarDays,
  Package,
  Radio,
  Sparkles,
  Award,
  Users,
  GraduationCap,
  LogOut,
  Menu,
  Zap,
  Globe2,
  Upload,
  BarChart3,
  Link2,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type MenuItem = { href: string; label: string; icon: LucideIcon };

const menuGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: "",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/comercial/funil", label: "Funil", icon: TrendingUp },
      { href: "/comercial/preencher", label: "Preencher", icon: ClipboardEdit },
      { href: "/comercial/vendas", label: "Vendas", icon: ShoppingBag },
      { href: "/comercial/reunioes", label: "Reuniões", icon: Calendar },
      { href: "/comercial/intercambio", label: "Intercâmbio", icon: Globe2 },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/marketing/tracking", label: "Tracking (GA)", icon: BarChart3 },
      { href: "/marketing/tracking/utm", label: "Gerador UTM", icon: Link2 },
      { href: "/marketing/hotmart", label: "Hotmart", icon: ShoppingBag },
      { href: "/marketing/pos", label: "Pós-Graduação", icon: GraduationCap },
      { href: "/marketing/pos-mkt", label: "Pós - Mkt", icon: Megaphone },
      { href: "/marketing/congressos", label: "Congressos", icon: Calendar },
      { href: "/marketing/cursos", label: "Cursos Livres", icon: Award },
      { href: "/marketing/comunidade", label: "Comunidade", icon: Users },
      { href: "/marketing/trafego-pago", label: "Tráfego Pago", icon: Megaphone },
      { href: "/marketing/redes-sociais", label: "Redes Sociais", icon: Camera },
      { href: "/marketing/youtube", label: "YouTube", icon: PlaySquare },
      { href: "/marketing/podcast", label: "Podcast", icon: Mic },
      { href: "/marketing/blog", label: "Blog", icon: FileText },
      { href: "/marketing/email", label: "Email", icon: Mail },
      { href: "/marketing/landing-pages", label: "Landing Pages", icon: MousePointer },
      { href: "/marketing/seo", label: "SEO", icon: Search },
      { href: "/marketing/lancamentos", label: "Lançamentos", icon: Zap },
    ],
  },
  {
    label: "Eventos",
    items: [
      { href: "/eventos", label: "Eventos", icon: CalendarDays },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/catalogo/produtos", label: "Produtos", icon: Package },
      { href: "/catalogo/canais", label: "Canais", icon: Radio },
      { href: "/catalogo/eventos", label: "Eventos", icon: CalendarDays },
    ],
  },
  {
    label: "Configurações",
    items: [
      { href: "/configuracoes/import", label: "Importar", icon: Upload },
      { href: "/configuracoes/usuarios", label: "Usuários", icon: Users },
    ],
  },
];

export type CurrentUser = {
  id: string;
  nome: string;
  email: string;
  papel?: string;
  ativo?: boolean;
};

function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);
  return user;
}

function getInitials(name: string) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";
}

function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-[15px] tracking-widest uppercase leading-tight text-foreground">
              DashCENAT
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
              dashboard interno
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label || "_main"}>
            {group.label && (
              <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground sidebar-group-label-line">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={onNavigate} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={isActive ? "sidebar-item-active" : ""}
                    >
                      <div className="sidebar-icon-wrap">
                        <Icon
                          className={`w-[18px] h-[18px] sidebar-icon-colored transition-colors duration-150 ${
                            isActive ? "text-primary" : "text-muted-foreground/70"
                          }`}
                          strokeWidth={isActive ? 2 : 1.75}
                        />
                      </div>
                      <span className={`flex-1 ${isActive ? "font-medium" : ""}`}>
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {user && (
          <div className="sidebar-user-card flex items-center gap-3 px-2 py-2 rounded-lg bg-muted/30 cursor-default">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {getInitials(user.nome)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {user.nome}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                {user.email}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors text-[13px] mt-2"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </button>
      </SidebarFooter>
    </>
  );
}

const PAGE_TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/comercial/funil": "Funil Comercial",
  "/comercial/preencher": "Preencher Funil",
  "/comercial/vendas": "Vendas",
  "/comercial/reunioes": "Reuniões",
  "/catalogo/produtos": "Produtos",
  "/catalogo/canais": "Canais",
  "/catalogo/eventos": "Eventos (Catálogo)",
  "/eventos": "Eventos",
  "/marketing/pos": "Pós-Graduação",
  "/marketing/pos-mkt": "Pós - Mkt",
  "/marketing/congressos": "Congressos",
  "/marketing/cursos": "Cursos Livres",
  "/marketing/comunidade": "Comunidade",
  "/marketing/trafego-pago": "Tráfego Pago",
  "/marketing/redes-sociais": "Redes Sociais",
  "/marketing/youtube": "YouTube",
  "/marketing/podcast": "Podcast",
  "/marketing/blog": "Blog",
  "/marketing/email": "Email",
  "/marketing/landing-pages": "Landing Pages",
  "/marketing/seo": "SEO",
  "/marketing/lancamentos": "Lançamentos",
  "/marketing/tracking": "Tracking (GA)",
  "/marketing/tracking/utm": "Gerador UTM",
  "/marketing/hotmart": "Hotmart",
  "/comercial/intercambio": "Intercâmbio",
  "/configuracoes/import": "Importar planilhas",
  "/configuracoes/usuarios": "Usuários",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "DashCENAT";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" data-density="medium">
        <Sidebar collapsible="icon" className="hidden md:flex">
          <SidebarNavContent />
        </Sidebar>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 md:hidden">
            <SidebarNavContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center px-4 md:px-6 border-b bg-card sticky top-0 z-30">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-2"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <SidebarTrigger className="hidden md:flex" />
            <Separator orientation="vertical" className="mx-3 h-5 hidden md:block" />
            <h1 className="text-[var(--font-size-h2)] font-semibold text-foreground">
              {title}
            </h1>
          </header>

          <main className="flex-1 p-4 md:p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
