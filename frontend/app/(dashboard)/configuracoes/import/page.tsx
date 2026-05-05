"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Megaphone,
  ShoppingCart,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { uploadXlsx, ETLResult } from "@/lib/upload-xlsx";

type Endpoint = "meta-ads" | "hotmart" | "lancamentos";

interface UploaderConfig {
  endpoint: Endpoint;
  titulo: string;
  descricao: string;
  icon: typeof Megaphone;
  cor: string;
  exemploColunas: string;
}

const UPLOADERS: UploaderConfig[] = [
  {
    endpoint: "meta-ads",
    titulo: "Meta Ads",
    descricao:
      "Upload do export de campanhas do Meta Ads Manager. Idempotente: pode subir de novo, atualiza.",
    icon: Megaphone,
    cor: "from-blue-500 to-blue-700",
    exemploColunas:
      "Nome da campanha · Valor usado · Impressões · Cliques · CTR · Leads...",
  },
  {
    endpoint: "hotmart",
    titulo: "Hotmart",
    descricao:
      "Upload do Sales History da Hotmart (.xls ou .xlsx). UPSERT por transação.",
    icon: ShoppingCart,
    cor: "from-fuchsia-500 to-pink-700",
    exemploColunas:
      "Transação · Nome do Produto · Status · Preço Total · Data de Venda...",
  },
  {
    endpoint: "lancamentos",
    titulo: "Lançamentos",
    descricao:
      "Planilha com nome, ano, mes, métricas e engajamento. UPSERT por (ano, mes, nome).",
    icon: Zap,
    cor: "from-amber-500 to-orange-700",
    exemploColunas:
      "nome · ano · mes · investimento_resultado · leads_total · receita_resultado...",
  },
];

function Uploader({ config, index }: { config: UploaderConfig; index: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ETLResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const r = await uploadXlsx(config.endpoint, file);
      setResult(r);
      toast.success(
        `${config.titulo}: ${r.rows_inserted} novos, ${r.rows_updated} atualizados${
          r.period_detected ? ` (${r.period_detected})` : ""
        }`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao processar";
      setError(msg);
      toast.error(`Falha ${config.titulo}: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Card className="overflow-hidden border-border shadow-[var(--shadow-xs)]">
        <div className={`h-1 bg-gradient-to-r ${config.cor}`} />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-9 h-9 rounded-lg bg-gradient-to-br ${config.cor} flex items-center justify-center`}
                >
                  <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">{config.titulo}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {config.descricao}
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-2 font-mono">
                {config.exemploColunas}
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />

          <Button
            className="w-full"
            variant="outline"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" /> Selecionar arquivo
              </>
            )}
          </Button>

          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Importado com sucesso
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-emerald-700/70 dark:text-emerald-400/70">Processadas</p>
                  <p className="font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                    {result.rows_processed}
                  </p>
                </div>
                <div>
                  <p className="text-emerald-700/70 dark:text-emerald-400/70">Inseridas</p>
                  <p className="font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                    {result.rows_inserted}
                  </p>
                </div>
                <div>
                  <p className="text-emerald-700/70 dark:text-emerald-400/70">Atualizadas</p>
                  <p className="font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                    {result.rows_updated}
                  </p>
                </div>
              </div>
              {result.period_detected && (
                <Badge variant="outline" className="mt-3 text-xs">
                  Período: {result.period_detected}
                </Badge>
              )}
              {result.warnings.length > 0 && (
                <ul className="mt-3 text-xs text-amber-700 list-disc pl-5">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">Erro</p>
                <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar planilhas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suba os exports do Meta Ads, Hotmart e planilhas de lançamento. Os dados ficam disponíveis no Overview do mês detectado.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {UPLOADERS.map((u, i) => (
          <Uploader key={u.endpoint} config={u} index={i} />
        ))}
      </div>

      <Card className="p-4 border-l-4 border-blue-400 bg-blue-50/40 dark:bg-blue-950/20 shadow-[var(--shadow-xs)]">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold mb-1">Como funciona</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Todos os imports são <strong className="text-foreground">idempotentes</strong> — você pode subir a mesma planilha múltiplas vezes e os dados serão atualizados, não duplicados. O Meta Ads usa <code className="text-[10px] bg-muted px-1 py-0.5 rounded">(ano, mês, nome_campanha)</code> como chave; Hotmart usa <code className="text-[10px] bg-muted px-1 py-0.5 rounded">transação</code>; Lançamentos usam <code className="text-[10px] bg-muted px-1 py-0.5 rounded">(ano, mês, nome)</code>.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
