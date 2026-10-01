"use client";

// «Jogo ao vivo» no header — aparece a toda a equipa enquanto há uma sala
// de Mini-games aberta. Vem do servidor no primeiro render e confirma de
// 30 em 30 s (só com o separador à vista): uma sala aberta enquanto alguém
// está parado numa página aparece sem ser preciso navegar.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2 } from "lucide-react";

type Active = { id: string; hostName: string } | null;

const POLL_MS = 30_000;

export function LiveGamePill({ initial }: { initial: Active }) {
  const [active, setActive] = useState<Active>(initial);
  const pathname = usePathname();

  useEffect(() => {
    let stop = false;
    async function check() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/minigames/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { active: Active };
        if (!stop) setActive(data.active);
      } catch {}
    }
    const t = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!active || pathname === `/minigames/${active.id}`) return null;
  return (
    <Link
      href={`/minigames/${active.id}`}
      className="brand-gradient-border group inline-flex items-center gap-2 rounded-full bg-[#783DF5]/12 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#783DF5]/25"
      title={`Sala de ${active.hostName} — entrar`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
      </span>
      <Gamepad2 className="h-3.5 w-3.5 text-[#d2b4ff] transition group-hover:rotate-[-8deg]" />
      <span className="hidden md:inline">Jogo ao vivo</span>
    </Link>
  );
}
