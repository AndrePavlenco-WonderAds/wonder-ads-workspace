// Cartão pequeno com o «Número do dia» do consultor SEO — 1, 2, 3 ou 4, cada
// número com a sua cor — ao lado do nome, no canto superior direito. Renderiza
// null para quem não está na roda e ao fim de semana, por isso o header pode
// montá-lo sempre sem pensar.
//
// Componente de servidor: a data é a de Lisboa, decidida no servidor, para o
// cartão ser o mesmo em qualquer browser e fuso. As cores vão em estilo
// inline — vêm de uma tabela, e o Tailwind só gera as classes que vê escritas
// no código.

import { getEmployeeDisplay } from "@/lib/auth/credentials";
import {
  colorForNumber,
  dailyNumberFor,
  dailyRoster,
  describeDay,
  lisbonISODate,
} from "@/lib/seo-daily-number";

export function DailyNumberCard({ username }: { username: string | null }) {
  const iso = lisbonISODate();
  const mine = dailyNumberFor(username, iso);
  if (!mine) return null;

  // Tooltip: quem tem que número hoje, para a roda ser legível de relance
  // sem ter de perguntar aos colegas.
  const roster = (dailyRoster(iso) ?? [])
    .map(
      (r) =>
        `${r.number} ${colorForNumber(r.number).label} · ${
          getEmployeeDisplay(r.username)?.name ?? r.username
        }`,
    )
    .join("\n");
  const title = `Número do dia · ${describeDay(iso)}\n${roster}`;
  const { hex, label } = mine.color;

  return (
    <span
      role="img"
      aria-label={`O teu número de hoje é ${mine.number} (${label})`}
      title={title}
      className="inline-flex h-8 min-w-8 shrink-0 select-none items-center justify-center rounded-lg border px-2 text-[15px] font-extrabold leading-none tabular-nums transition hover:scale-105"
      style={{
        color: hex,
        backgroundColor: `${hex}1F`,
        borderColor: `${hex}80`,
        boxShadow: `0 4px 14px -4px ${hex}99`,
      }}
    >
      {mine.number}
    </span>
  );
}
