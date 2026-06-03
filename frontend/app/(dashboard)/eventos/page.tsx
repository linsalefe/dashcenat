"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, MapPin, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DoityFacetBars } from "@/components/charts/doity-facet-bars";
import { DoityGeneroDonut } from "@/components/charts/doity-genero-donut";
import { DoityVendasDiarias } from "@/components/charts/doity-vendas-diarias";
import { DoityMetas } from "@/components/eventos/doity-metas";
import { api, ApiError } from "@/lib/api";
import type {
  DoityAnaliseOut,
  DoityConfigOut,
  EventoOut,
} from "@/lib/types/doity";

interface EventoComDoity extends EventoOut {
  doity_event_id: number | null;
  ultimo_sync: string | null;
  ultimo_sync_status: string | null;
  cursor: string | null;
}

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function rotuloPeriodoDaSerie(serie: { data: string }[]): string | null {
  if (!serie.length) return null;
  const primeiro = serie[0].data;
  const ultimo = serie[serie.length - 1].data;
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return fmtData.format(new Date(Date.UTC(y, m - 1, d)));
  };
  if (primeiro === ultimo) return fmt(primeiro);
  return `${fmt(primeiro)} → ${fmt(ultimo)}`;
}

export default function EventosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [eventos, setEventos] = useState<EventoComDoity[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [analise, setAnalise] = useState<DoityAnaliseOut | null>(null);
  const [carregandoAnalise, setCarregandoAnalise] = useState(false);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  // Lista de eventos + config Doity de cada em paralelo
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregandoEventos(true);
      try {
        const lista = await api.get<EventoOut[]>("/eventos");
        const configs = await Promise.all(
          lista.map((ev) =>
            api.get<DoityConfigOut>(`/eventos/${ev.id}/doity`).catch(() => null),
          ),
        );
        if (cancelado) return;
        const enriquecidos: EventoComDoity[] = lista.map((ev, i) => ({
          ...ev,
          doity_event_id: configs[i]?.doity_event_id ?? null,
          ultimo_sync: configs[i]?.ultimo_sync ?? null,
          ultimo_sync_status: configs[i]?.ultimo_sync_status ?? null,
          cursor: configs[i]?.cursor ?? null,
        }));
        enriquecidos.sort((a, b) => {
          const aDoity = a.doity_event_id ? 0 : 1;
          const bDoity = b.doity_event_id ? 0 : 1;
          if (aDoity !== bDoity) return aDoity - bDoity;
          return a.nome.localeCompare(b.nome, "pt-BR");
        });
        setEventos(enriquecidos);
        const desejado = searchParams.get("evento");
        const inicial =
          enriquecidos.find((e) => e.id === desejado) ??
          enriquecidos.find((e) => e.doity_event_id != null) ??
          enriquecidos[0] ??
          null;
        setEventoId(inicial?.id ?? null);
      } catch (e) {
        if (!cancelado) {
          toast.error(e instanceof ApiError ? e.message : "Falha ao carregar eventos");
        }
      } finally {
        if (!cancelado) setCarregandoEventos(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de evento → análise + querystring
  useEffect(() => {
    if (!eventoId) {
      setAnalise(null);
      return;
    }
    const atual = searchParams.get("evento");
    if (atual !== eventoId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("evento", eventoId);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    let cancelado = false;
    (async () => {
      setCarregandoAnalise(true);
      setErroAnalise(null);
      try {
        const data = await api.get<DoityAnaliseOut>(`/doity/analise/${eventoId}`);
        if (!cancelado) setAnalise(data);
      } catch (e) {
        if (!cancelado) {
          const msg = e instanceof ApiError ? e.message : "Falha ao carregar análise";
          setErroAnalise(msg);
          setAnalise(null);
        }
      } finally {
        if (!cancelado) setCarregandoAnalise(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  const eventoSelecionado = useMemo(
    () => eventos.find((e) => e.id === eventoId) ?? null,
    [eventos, eventoId],
  );

  const periodo = analise ? rotuloPeriodoDaSerie(analise.serie_diaria) : null;

  async function sincronizar() {
    if (!eventoSelecionado || sincronizando) return;
    setSincronizando(true);
    try {
      const r = await api.post<{
        ok: boolean;
        total: number;
        novos: number;
        erro: string | null;
      }>(`/eventos/${eventoSelecionado.id}/doity/sync`, {});
      if (r.ok) {
        toast.success(`Sync OK — ${r.total} registros (${r.novos} novos)`);
        const data = await api.get<DoityAnaliseOut>(`/doity/analise/${eventoSelecionado.id}`);
        setAnalise(data);
      } else {
        toast.error(`Sync falhou: ${r.erro ?? "erro desconhecido"}`);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao sincronizar");
    } finally {
      setSincronizando(false);
    }
  }

  // Nenhum evento cadastrado
  if (!carregandoEventos && eventos.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-[var(--font-size-h1)] font-bold tracking-tight">Eventos</h1>
        <Card className="p-12 text-center border border-border">
          <p className="text-muted-foreground">
            Nenhum evento cadastrado em <code className="text-foreground">core.eventos</code>.
          </p>
        </Card>
      </div>
    );
  }

  const algumDoity = eventos.some((e) => e.doity_event_id != null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[var(--font-size-h1)] font-bold tracking-tight">
            {eventoSelecionado?.nome ?? "Eventos"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {eventoSelecionado?.doity_event_id != null && (
              <Badge variant="secondary" className="font-mono">
                Doity #{eventoSelecionado.doity_event_id}
              </Badge>
            )}
            {periodo && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {periodo}
              </span>
            )}
            {eventoSelecionado?.ultimo_sync && (
              <span>
                Último sync: {new Date(eventoSelecionado.ultimo_sync).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {carregandoEventos ? (
            <Skeleton className="h-9 w-[260px]" />
          ) : (
            <Select
              value={eventoId ?? undefined}
              onValueChange={(v) => v && setEventoId(v)}
            >
              <SelectTrigger className="w-[260px] h-9">
                <SelectValue placeholder="Selecione um evento" />
              </SelectTrigger>
              <SelectContent>
                {eventos.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    <span className="flex items-center gap-2">
                      {ev.doity_event_id != null && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                          aria-hidden
                        />
                      )}
                      {ev.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {eventoSelecionado?.doity_event_id != null && (
            <Button
              variant="outline"
              size="sm"
              onClick={sincronizar}
              disabled={sincronizando}
            >
              <RefreshCw
                className={`h-4 w-4 ${sincronizando ? "animate-spin" : ""}`}
              />
              {sincronizando ? "Sincronizando…" : "Sincronizar"}
            </Button>
          )}
        </div>
      </div>

      {!algumDoity && !carregandoEventos && (
        <Card className="p-6 border-dashed border-2 border-border text-sm text-muted-foreground">
          Nenhum evento tem origem Doity configurada. Faça{" "}
          <code>POST /api/v1/eventos/&lt;UUID&gt;/doity</code> com{" "}
          <code>doity_event_id</code> e <code>token</code> pra começar.
        </Card>
      )}

      {/* Bloco 1: Vendas dia a dia */}
      <ChartCard
        title="Vendas dia a dia"
        description={
          analise
            ? `${analise.totais.inscricoes.toLocaleString("pt-BR")} inscritos • ${analise.totais.itens.toLocaleString(
                "pt-BR",
              )} itens (ingressos + oficinas) • ${analise.totais.pagas.toLocaleString(
                "pt-BR",
              )} pagas • ${analise.serie_diaria.length} dias com vendas`
            : "Série diária de inscrições e pagamentos"
        }
        loading={carregandoAnalise && !analise}
      >
        {erroAnalise ? (
          <div className="h-[320px] flex items-center justify-center text-destructive">
            {erroAnalise}
          </div>
        ) : analise ? (
          <DoityVendasDiarias serie={analise.serie_diaria} />
        ) : (
          <Skeleton className="h-[320px] w-full" />
        )}
      </ChartCard>

      {/* Bloco 2: Meta vs realizado */}
      {carregandoAnalise && !analise ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-32 lg:col-span-2" />
          <Skeleton className="h-32 lg:col-span-3" />
        </div>
      ) : analise ? (
        <DoityMetas totais={analise.totais} meta={analise.meta} />
      ) : null}

      {/* Bloco 3: Demografia */}
      {carregandoAnalise && !analise ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[260px]" />
          ))}
        </div>
      ) : analise ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            De onde vem
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard
              title="Por estado"
              description={
                analise.por_estado.length
                  ? `${analise.por_estado.length} UFs (top)`
                  : undefined
              }
            >
              <DoityFacetBars itens={analise.por_estado} />
            </ChartCard>

            <ChartCard
              title="Por cidade"
              description={
                analise.por_cidade.length
                  ? `top ${analise.por_cidade.length}`
                  : undefined
              }
            >
              <DoityFacetBars itens={analise.por_cidade} />
            </ChartCard>

            <ChartCard
              title="Por profissão"
              description={
                analise.por_profissao.length
                  ? `top ${analise.por_profissao.length}`
                  : undefined
              }
            >
              <DoityFacetBars itens={analise.por_profissao} />
            </ChartCard>

            {analise.por_genero.length > 0 && (
              <ChartCard title="Por gênero">
                <DoityGeneroDonut itens={analise.por_genero} />
              </ChartCard>
            )}
          </div>
          {analise.por_estado.length === 0 &&
            analise.por_cidade.length === 0 &&
            analise.por_profissao.length === 0 &&
            analise.por_genero.length === 0 && (
              <Card className="p-6 text-sm text-muted-foreground text-center border-dashed border-2">
                <MapPin className="h-4 w-4 inline mr-1 opacity-60" />
                Sem dados demográficos pra este evento.
              </Card>
            )}
        </div>
      ) : null}
    </div>
  );
}
