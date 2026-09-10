// As medalhas no header — até três, entre a hora local e o sino. Cada uma
// leva ao /medalhas, onde se vê o catálogo e se escolhe quais mostrar.
// Servidor: lê a sessão e as propostas; renderiza null sem sessão, sem
// medalhas ou se algo falhar — o header nunca trava uma página.

import Link from "next/link";
import { getCurrentUserMedals } from "@/lib/medals/server";
import { MedalBadge } from "./medal-badge";

export async function HeaderMedals() {
  const mine = await getCurrentUserMedals();
  if (!mine || mine.display.length === 0) return null;
  return (
    <Link
      href="/medalhas"
      className="group hidden items-center gap-1 rounded-full border border-transparent px-1 py-0.5 transition hover:border-white/12 hover:bg-white/[0.04] sm:flex"
      aria-label={`As tuas medalhas: ${mine.display.map((m) => m.name).join(", ")}. Abrir a galeria.`}
    >
      {mine.display.map((m) => (
        <span key={m.id} title={`${m.name} · ${m.requirement}`} className="inline-flex transition group-hover:scale-105">
          <MedalBadge medal={m} size={34} />
        </span>
      ))}
    </Link>
  );
}
