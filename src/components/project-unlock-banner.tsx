"use client";

// A pastilha das páginas públicas de um projeto em pausa que um SuperAdmin
// desbloqueou (v80.36): diz ao cliente até quando a página continua aberta,
// com o tempo a contar. Só aparece quando o projeto está mesmo em pausa e a
// parte desta página está desbloqueada; num projeto ativo não mostra nada.
// Pergunta o estado à API (as páginas podem ser estáticas: nada de headers()
// no layout).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { remainingLabel, unitForSection, unlockUnit, type ActiveUnlock } from "@/lib/paused-unlocks-shared";

type Status = { paused: false } | { paused: true; lang: "pt" | "en"; unlocks: ActiveUnlock[] };

const HIDE_KEY = "wa-unlock-pill-min";

export function ProjectUnlockBanner({ slug }: { slug: string }) {
  const pathname = usePathname();
  const section = pathname.split("/")[2] ?? "";
  const unit = unitForSection(section);
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [min, setMin] = useState(false);

  useEffect(() => {
    if (!unit) return;
    let alive = true;
    fetch(`/api/project-access/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : null))
      .then((s) => {
        if (alive && s) setStatus(s);
      })
      .catch(() => undefined);
    try {
      setMin(window.sessionStorage.getItem(HIDE_KEY) === "1");
    } catch {
      /* sem storage: fica aberta */
    }
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [slug, unit]);

  const grant = unit && status && status.paused ? status.unlocks.find((u) => u.unit === unit.id) ?? null : null;
  const expiresAt = grant?.until ?? null;

  // Quando o prazo acaba com a página aberta, recarrega: o middleware já a
  // fecha (mostra «Projeto em pausa») — ninguém tem de a bloquear à mão.
  useEffect(() => {
    if (expiresAt === null) return;
    const ms = expiresAt - Date.now();
    if (ms > 24 * 60 * 60 * 1000) return; // o intervalo de 1 min trata do resto
    const t = window.setTimeout(() => window.location.reload(), Math.max(0, ms) + 20_000);
    return () => window.clearTimeout(t);
  }, [expiresAt, now]);

  if (!unit || !grant || !status || !status.paused) return null;

  const lang = status.lang;
  const label = unlockUnit(grant.unit)?.client[lang] ?? "";
  const ended = grant.until !== null && grant.until <= now;
  const text =
    grant.until === null
      ? lang === "pt"
        ? `Projeto em pausa · ${label}: continua disponível`
        : `Project on pause · ${label}: still available`
      : ended
        ? lang === "pt"
          ? `O acesso a ${label.toLowerCase()} terminou`
          : `Access to ${label.toLowerCase()} has ended`
        : lang === "pt"
          ? `Acesso temporário · ${label} disponível até ${formatDate(grant.until)}`
          : `Temporary access · ${label} available until ${formatDate(grant.until)}`;
  const left = grant.until === null || ended ? null : remainingLabel(grant.until, now, lang);

  const setMinimised = (v: boolean) => {
    setMin(v);
    try {
      window.sessionStorage.setItem(HIDE_KEY, v ? "1" : "0");
    } catch {
      /* ignorar */
    }
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      {min ? (
        <button
          type="button"
          onClick={() => setMinimised(false)}
          aria-label={lang === "pt" ? "Ver o prazo de acesso" : "Show access period"}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#17142B]/90 px-3 py-2 text-[12px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
        >
          <Clock className="h-3.5 w-3.5" />
          {left ?? (grant.until === null ? "∞" : "0")}
        </button>
      ) : (
        <div
          role="status"
          className="pointer-events-auto flex max-w-[640px] items-center gap-3 rounded-2xl bg-[#17142B]/92 py-2.5 pl-3.5 pr-2 text-white shadow-[0_14px_36px_-14px_rgba(0,0,0,0.65)]"
        >
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10">
            <Clock className="h-4 w-4" />
            {!ended && grant.until !== null && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400 motion-reduce:animate-none" />
            )}
          </span>
          <p className="min-w-0 text-[12.5px] leading-snug sm:text-[13px]">
            <span className="text-white/85">{text}</span>
            {left && <span className="ml-1.5 font-semibold text-amber-300">· {left}</span>}
          </p>
          <button
            type="button"
            onClick={() => setMinimised(true)}
            aria-label={lang === "pt" ? "Minimizar" : "Minimise"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** O tempo que falta, a contar ao minuto — na página «Projeto em pausa». */
export function UnlockCountdown({ until, lang }: { until: number | null; lang: "pt" | "en" }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return <span suppressHydrationWarning>{remainingLabel(until, now, lang)}</span>;
}
