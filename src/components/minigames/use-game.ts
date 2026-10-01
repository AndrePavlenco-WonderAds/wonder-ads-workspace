"use client";

// A sala ao vivo no browser: polling da vista + ações. Sem WebSockets — a
// Vercel não os mantém abertos — e para um jogo de equipa 1,5 s chega bem.
// Com o separador escondido o ritmo baixa para 6 s; ao voltar, lê logo.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameView } from "@/lib/minigames/types";

const FAST_MS = 1500;
const HIDDEN_MS = 6000;

export function useGame(id: string, initial: GameView) {
  const [view, setView] = useState<GameView>(initial);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Desvio entre o relógio do servidor e o deste aparelho — o countdown usa-o.
  const [offset, setOffset] = useState(() => initial.serverNow - Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);
  // Uma ação acabada de fazer ganha a um poll que saiu antes dela.
  const lastAction = useRef(0);

  const accept = useCallback((next: GameView) => {
    setView(next);
    setOffset(next.serverNow - Date.now());
  }, []);

  const poll = useCallback(async () => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const startedAt = Date.now();
    try {
      const res = await fetch(`/api/minigames/${id}`, { cache: "no-store", signal: ctrl.signal });
      if (res.status === 404) {
        setGone(true);
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as GameView;
      if (startedAt < lastAction.current) return;
      accept(next);
    } catch {
      // rede a falhar ou abort — o próximo poll trata disso
    }
  }, [id, accept]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const wait = typeof document !== "undefined" && document.hidden ? HIDDEN_MS : FAST_MS;
    timer.current = setTimeout(async () => {
      await poll();
      schedule();
    }, wait);
  }, [poll]);

  useEffect(() => {
    if (gone) return;
    schedule();
    const onVisible = () => {
      if (!document.hidden) {
        void poll();
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
      inflight.current?.abort();
    };
  }, [schedule, poll, gone]);

  // Quando o tempo da ronda acaba, pede logo a vista (a revelação é do
  // servidor) em vez de esperar pelo poll seguinte.
  useEffect(() => {
    if (view.phase !== "guessing" || view.deadline === null) return;
    const ms = view.deadline - (Date.now() + offset) + 150;
    const t = setTimeout(() => void poll(), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [view.phase, view.deadline, offset, poll]);

  const act = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      setBusy(action);
      setError(null);
      lastAction.current = Date.now();
      inflight.current?.abort();
      try {
        const res = await fetch(`/api/minigames/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        });
        const data = (await res.json().catch(() => ({}))) as GameView & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Algo correu mal — tenta outra vez.");
          void poll();
          return false;
        }
        accept(data);
        return true;
      } catch {
        setError("Sem ligação — tenta outra vez.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [id, accept, poll],
  );

  return { view, gone, error, clearError: () => setError(null), busy, act, offset };
}

/** Segundos que faltam até `deadline` (relógio do servidor), a cada 250 ms.
 *  O primeiro render usa `serverNow` — o mesmo valor no HTML do servidor e
 *  na hidratação; com Date.now() os dois davam números diferentes. */
export function useCountdown(deadline: number | null, offset: number, serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [deadline, offset]);
  if (deadline === null) return null;
  return Math.max(0, (deadline - now) / 1000);
}
