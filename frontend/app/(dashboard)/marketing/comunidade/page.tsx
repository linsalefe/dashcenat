"use client";

import { Users } from "lucide-react";
import { FrenteMidiaPagaPage } from "@/components/marketing/frente-midia-paga-page";

export default function ComunidadePage() {
  return (
    <FrenteMidiaPagaPage
      frente="comunidade"
      titulo="Comunidade"
      subtitulo="Funil de mídia paga, metas e resultados da comunidade CENAT"
      icone={Users}
      gradient="bg-gradient-to-br from-fuchsia-600 to-pink-700"
      corBotao="fuchsia"
      labelSingular="Item"
      labelPlural="Itens"
      descricaoReceitaCard="Total faturado em comunidade no período"
    />
  );
}
