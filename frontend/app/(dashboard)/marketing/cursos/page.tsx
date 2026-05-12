"use client";

import { Award } from "lucide-react";
import { FrenteMidiaPagaPage } from "@/components/marketing/frente-midia-paga-page";

export default function CursosPage() {
  return (
    <FrenteMidiaPagaPage
      frente="curso"
      titulo="Cursos Livres"
      subtitulo="Funil de mídia paga, metas e resultados por curso"
      icone={Award}
      gradient="bg-gradient-to-br from-rose-500 to-red-700"
      corBotao="rose"
      labelSingular="Curso"
      labelPlural="Cursos"
      descricaoReceitaCard="Total faturado em cursos livres no período"
    />
  );
}
