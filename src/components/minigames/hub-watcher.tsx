"use client";

// O hub /minigames atualiza-se sozinho: de 5 em 5 s (só com o separador à
// vista) pergunta qual é a sala aberta e, se mudou, volta a pedir a página
// ao servidor. Quem está à espera vê o «Entrar na sala» aparecer sem F5.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const POLL_MS = 5000;

export function HubWatcher({ activeId, waiting }: { activeId: string | null; waiting: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let stop = false;
    async function check() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/minigames/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { active: { id: string } | null };
        if (!stop && (data.active?.id ?? null) !== activeId) router.refresh();
      } catch {}
    }
    const t = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [activeId, router]);

  if (!waiting) return null;
  return (
    <p className="flex items-center gap-2.5 text-sm text-white/55">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#A35BFF]" />
      Ainda não há sala aberta. Só os SuperAdmins abrem salas — quando abrirem, o botão «Entrar na sala» aparece aqui
      sozinho.
    </p>
  );
}
