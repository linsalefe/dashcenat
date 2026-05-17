"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

// ============================================================
// Tipos
// ============================================================

export interface DateRange {
  since: Date;
  until: Date;
}

export type PresetKey =
  | "hoje"
  | "ontem"
  | "ultimos_7"
  | "ultimos_14"
  | "ultimos_28"
  | "ultimos_30"
  | "esta_semana"
  | "semana_passada"
  | "este_mes"
  | "mes_passado"
  | "maximo"
  | "custom";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange, preset: PresetKey) => void;
  className?: string;
  align?: "start" | "center" | "end";
}

// ============================================================
// Helpers de data
// ============================================================

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const dia = x.getDay(); // 0=dom, 1=seg, ...
  const diff = dia === 0 ? -6 : 1 - dia;
  return addDays(x, diff);
}

function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function endOfMonth(d: Date) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  return addDays(x, -1);
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function parseIsoDate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatRange(r: DateRange): string {
  const mes = (d: Date) =>
    d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  const diaMes = (d: Date) => `${d.getDate()} de ${mes(d)}`;
  const sameYear = r.since.getFullYear() === r.until.getFullYear();
  const ano = r.until.getFullYear();

  if (sameDay(r.since, r.until)) {
    return `${diaMes(r.since)} de ${ano}`;
  }
  if (sameYear) {
    return `${diaMes(r.since)} - ${diaMes(r.until)} de ${ano}`;
  }
  return `${diaMes(r.since)} de ${r.since.getFullYear()} - ${diaMes(
    r.until,
  )} de ${ano}`;
}

// ============================================================
// Presets
// ============================================================

const PRESETS: { key: PresetKey; label: string; compute: () => DateRange }[] = [
  {
    key: "hoje",
    label: "Hoje",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: t, until: t };
    },
  },
  {
    key: "ontem",
    label: "Ontem",
    compute: () => {
      const o = addDays(startOfDay(new Date()), -1);
      return { since: o, until: o };
    },
  },
  {
    key: "ultimos_7",
    label: "Últimos 7 dias",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: addDays(t, -6), until: t };
    },
  },
  {
    key: "ultimos_14",
    label: "Últimos 14 dias",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: addDays(t, -13), until: t };
    },
  },
  {
    key: "ultimos_28",
    label: "Últimos 28 dias",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: addDays(t, -27), until: t };
    },
  },
  {
    key: "ultimos_30",
    label: "Últimos 30 dias",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: addDays(t, -29), until: t };
    },
  },
  {
    key: "esta_semana",
    label: "Esta semana",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: startOfWeekMonday(t), until: t };
    },
  },
  {
    key: "semana_passada",
    label: "Semana passada",
    compute: () => {
      const t = startOfDay(new Date());
      const inicioAtual = startOfWeekMonday(t);
      const inicioPassada = addDays(inicioAtual, -7);
      return { since: inicioPassada, until: addDays(inicioAtual, -1) };
    },
  },
  {
    key: "este_mes",
    label: "Este mês",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: startOfMonth(t), until: t };
    },
  },
  {
    key: "mes_passado",
    label: "Mês passado",
    compute: () => {
      const t = startOfDay(new Date());
      const inicioAtual = startOfMonth(t);
      const inicioPassado = new Date(inicioAtual);
      inicioPassado.setMonth(inicioPassado.getMonth() - 1);
      return { since: inicioPassado, until: addDays(inicioAtual, -1) };
    },
  },
  {
    key: "maximo",
    label: "Máximo (90 dias)",
    compute: () => {
      const t = startOfDay(new Date());
      return { since: addDays(t, -89), until: t };
    },
  },
];

export function detectPreset(r: DateRange): PresetKey {
  for (const p of PRESETS) {
    const c = p.compute();
    if (sameDay(c.since, r.since) && sameDay(c.until, r.until)) {
      return p.key;
    }
  }
  return "custom";
}

export function presetRange(key: PresetKey): DateRange {
  const p = PRESETS.find((x) => x.key === key);
  if (!p) {
    const t = startOfDay(new Date());
    return { since: startOfMonth(t), until: t };
  }
  return p.compute();
}

// ============================================================
// Componente
// ============================================================

export function DateRangePicker({
  value,
  onChange,
  className,
  align = "end",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // Estado interno enquanto o popover está aberto
  const [draft, setDraft] = useState<DateRange>(value);
  const [sinceText, setSinceText] = useState(isoDate(value.since));
  const [untilText, setUntilText] = useState(isoDate(value.until));
  const [presetSel, setPresetSel] = useState<PresetKey>(detectPreset(value));

  // Sincroniza ao abrir
  useEffect(() => {
    if (open) {
      setDraft(value);
      setSinceText(isoDate(value.since));
      setUntilText(isoDate(value.until));
      setPresetSel(detectPreset(value));
    }
  }, [open, value]);

  // react-day-picker selected (range)
  const selected = useMemo(
    () => ({ from: draft.since, to: draft.until }),
    [draft],
  );

  function aplicaPreset(key: PresetKey) {
    setPresetSel(key);
    if (key === "custom") return;
    const r = presetRange(key);
    setDraft(r);
    setSinceText(isoDate(r.since));
    setUntilText(isoDate(r.until));
  }

  function onCalendarSelect(range: { from?: Date; to?: Date } | undefined) {
    if (!range?.from) return;
    const since = startOfDay(range.from);
    const until = range.to ? startOfDay(range.to) : since;
    const novo = { since, until };
    setDraft(novo);
    setSinceText(isoDate(since));
    setUntilText(isoDate(until));
    setPresetSel(detectPreset(novo));
  }

  function onInputBlur() {
    const s = parseIsoDate(sinceText);
    const u = parseIsoDate(untilText);
    if (s && u && s.getTime() <= u.getTime()) {
      const novo = { since: s, until: u };
      setDraft(novo);
      setPresetSel(detectPreset(novo));
    } else {
      // Resetar inputs pro draft atual se inválido
      setSinceText(isoDate(draft.since));
      setUntilText(isoDate(draft.until));
    }
  }

  function aplicar() {
    onChange(draft, presetSel);
    setOpen(false);
  }

  function cancelar() {
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 gap-2 font-normal", className)}
          />
        }
      >
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="tabular-nums">{formatRange(value)}</span>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-auto max-w-[calc(100vw-2rem)] p-0 ring-1 ring-border"
      >
        <div className="flex flex-col sm:flex-row">
          {/* Lateral — presets */}
          <aside className="w-full sm:w-52 border-b sm:border-b-0 sm:border-r p-2 max-h-[420px] overflow-y-auto">
            <RadioGroup
              value={presetSel}
              onValueChange={(v) => aplicaPreset(v as PresetKey)}
              className="gap-0"
            >
              {PRESETS.map((p) => (
                <label
                  key={p.key}
                  className={cn(
                    "flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors",
                    presetSel === p.key && "bg-muted/70 font-medium",
                  )}
                >
                  <RadioGroupItem value={p.key} />
                  <span>{p.label}</span>
                </label>
              ))}
            </RadioGroup>
          </aside>

          {/* Calendário + footer */}
          <div className="flex flex-col">
            <div className="p-2">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={selected}
                onSelect={onCalendarSelect}
                defaultMonth={draft.since}
                locale={ptBR}
                className="p-0"
              />
            </div>

            <div className="flex items-center gap-2 border-t p-2.5">
              <Input
                type="date"
                value={sinceText}
                onChange={(e) => setSinceText(e.target.value)}
                onBlur={onInputBlur}
                className="h-8 w-[140px] text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={untilText}
                onChange={(e) => setUntilText(e.target.value)}
                onBlur={onInputBlur}
                className="h-8 w-[140px] text-xs"
              />
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelar}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={aplicar}
                  className="h-8 text-xs"
                >
                  Atualizar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helpers exportados pra integração nas páginas
export const dateRangeHelpers = {
  isoDate,
  parseIsoDate,
  startOfDay,
  startOfMonth,
  presetRange,
  detectPreset,
};
