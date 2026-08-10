// "Gerar Weekly Update" — deixou de abrir um modal por cliente (v76.45) e
// passou a levar ao estúdio partilhado em /seo/weekly-reports.
//
// PORQUÊ: o modal antigo escrevia a mensagem a partir do ROADMAP, que diz o
// que estava PLANEADO para a semana — não o que foi realmente feito. E
// obrigava a repetir o mesmo trabalho uma vez por cada cliente da carteira.
//
// O estúdio parte dos DAILY UPDATES (o que o consultor já escreve todos os
// dias, e que é o registo real do que aconteceu) e devolve a carteira
// inteira de uma vez, uma mensagem por cliente. Deixar aqui um segundo
// caminho, mais fraco, que produzisse uma mensagem diferente para o mesmo
// cliente na mesma semana, era garantir que mais cedo ou mais tarde saíam as
// duas.

import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function WeeklyUpdateButton({
  clientName,
}: {
  /** Só para o title do link — a geração é da carteira toda. */
  clientName?: string;
}) {
  return (
    <Link
      href="/seo/weekly-reports"
      title={
        clientName
          ? `Abre o estúdio de weekly reports — cola os daily updates da semana e sai a mensagem para ${clientName} e para os restantes clientes.`
          : "Abre o estúdio de weekly reports."
      }
      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-500/20 hover:text-white"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      Gerar Weekly Report
    </Link>
  );
}
