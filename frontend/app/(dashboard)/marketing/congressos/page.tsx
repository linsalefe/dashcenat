"use client";

import { Calendar } from "lucide-react";
import { FrenteMidiaPagaPage } from "@/components/marketing/frente-midia-paga-page";

export default function CongressosPage() {
  return (
    <FrenteMidiaPagaPage
      frente="congresso"
      titulo="Congressos"
      subtitulo="Funil de mídia paga, metas e resultados por evento"
      icone={Calendar}
      gradient="bg-gradient-to-br from-violet-600 to-purple-800"
      corBotao="violet"
      labelSingular="Evento"
      labelPlural="Eventos"
      descricaoReceitaCard="Receita total dos Congressos no período"
    />
  );
}
