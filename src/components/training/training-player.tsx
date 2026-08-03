"use client";

// Player da Formação com tracking de visualização.
//
// O objetivo é simples de dizer e chato de fazer: saber quanto de cada vídeo
// foi realmente visto. Cada provider dá-nos ferramentas diferentes:
//
//  • YouTube — IFrame Player API (`enablejsapi=1`). Amostramos
//    getCurrentTime/getDuration; é fiável.
//  • Vimeo — player.js, evento `timeupdate`. Fiável.
//  • Ficheiro (mp4/webm) — <video> nativo com onTimeUpdate. Fiável.
//  • Loom — O EMBED DO LOOM NÃO EXPÕE PROGRESSO DE REPRODUÇÃO. Não há forma
//    honesta de medir 90%. Em vez de inventar um número, mostramos um botão de
//    confirmação que só ativa depois do tempo estimado da aula ter passado na
//    página, e a conclusão fica marcada `manual: true` — o admin vê que aquela
//    não foi medida.
//
// Escritas: no máximo uma a cada 15s, mais uma ao sair da página e outra
// assim que se cruza o limiar. Um POST por tick de vídeo encheria o KV de
// operações sem acrescentar nada.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, PlayCircle } from "lucide-react";
import type { VideoProvider } from "@/lib/training/catalog";

const THRESHOLD = 90;
const SAVE_INTERVAL_MS = 15_000;

type Props = {
  lessonId: string;
  title: string;
  videoUrl: string | null;
  provider: VideoProvider | null;
  /** Percentagem já registada, para não recomeçar a UI do zero. */
  initialPercent: number;
  initialCompleted: boolean;
  /** Minutos estimados — define quando o botão manual do Loom desbloqueia. */
  estMinutes: number;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: Record<string, unknown>,
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: {
      Player: new (el: HTMLElement, opts?: Record<string, unknown>) => VimeoPlayer;
    };
  }
}

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

type VimeoPlayer = {
  on: (
    event: string,
    cb: (data: { seconds: number; duration: number; percent: number }) => void,
  ) => void;
  destroy: () => Promise<void>;
};

/** Carrega um script externo uma única vez e resolve quando `ready()` passa. */
function loadScript(src: string, ready: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (ready()) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    const poll = () => {
      if (ready()) resolve();
      else setTimeout(poll, 120);
    };
    if (!existing) {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
    poll();
  });
}

/** youtu.be/ID, /watch?v=ID e /embed/ID → o id. */
function youtubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ??
    url.match(/youtu\.be\/([\w-]{6,})/) ??
    url.match(/\/embed\/([\w-]{6,})/) ??
    url.match(/\/shorts\/([\w-]{6,})/);
  return m ? m[1] : null;
}

/** Qualquer link do Vimeo → URL de embed. */
function vimeoEmbedUrl(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}

/** Link de partilha do Loom → embed. */
function loomEmbedUrl(url: string): string {
  return url.replace("/share/", "/embed/");
}

export function TrainingPlayer({
  lessonId,
  title,
  videoUrl,
  provider,
  initialPercent,
  initialCompleted,
  estMinutes,
}: Props) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(initialPercent);
  const [completed, setCompleted] = useState(initialCompleted);
  const [saving, setSaving] = useState(false);

  // Refs para o loop de gravação — evitam recriar o player a cada render.
  const lastSavedAt = useRef(0);
  const latest = useRef({ seconds: 0, percent: initialPercent });
  const crossedThreshold = useRef(initialCompleted);

  const save = useCallback(
    async (opts: { force?: boolean; manual?: boolean } = {}) => {
      const { seconds, percent: pct } = latest.current;
      if (!opts.manual && pct <= 0) return;
      const now = Date.now();
      if (!opts.force && now - lastSavedAt.current < SAVE_INTERVAL_MS) return;
      lastSavedAt.current = now;
      try {
        const res = await fetch("/api/formacao/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            watchedSeconds: Math.round(seconds),
            percent: opts.manual ? THRESHOLD : pct,
            manual: opts.manual === true,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            progress?: { completedAt: number | null };
          };
          if (data.progress?.completedAt) setCompleted(true);
        }
      } catch {
        /* offline ou pedido cancelado — a próxima amostra volta a tentar */
      }
    },
    [lessonId],
  );

  /** Recebe uma amostra do player, atualiza a UI e grava quando é devido. */
  const onSample = useCallback(
    (seconds: number, duration: number) => {
      if (!duration || !Number.isFinite(duration)) return;
      const pct = Math.min(100, Math.round((seconds / duration) * 100));
      latest.current = { seconds, percent: pct };
      setPercent((prev) => (pct > prev ? pct : prev));
      if (pct >= THRESHOLD && !crossedThreshold.current) {
        crossedThreshold.current = true;
        // Cruzar o limiar grava já — não se espera pelo próximo intervalo,
        // senão fechar o separador logo a seguir perdia a conclusão.
        void save({ force: true }).then(() => router.refresh());
        return;
      }
      void save();
    },
    [save, router],
  );

  // ---- YouTube ----
  useEffect(() => {
    if (provider !== "youtube" || !videoUrl || !hostRef.current) return;
    const id = youtubeId(videoUrl);
    if (!id) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void loadScript(
      "https://www.youtube.com/iframe_api",
      () => Boolean(window.YT?.Player),
    ).then(() => {
      if (cancelled || !hostRef.current || !window.YT) return;
      player = new window.YT.Player(hostRef.current, {
        videoId: id,
        playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            // 1 = a reproduzir → começa a amostrar; qualquer outro estado pára.
            if (e.data === 1 && !timer) {
              timer = setInterval(() => {
                if (!player) return;
                onSample(player.getCurrentTime(), player.getDuration());
              }, 5000);
            } else if (e.data !== 1 && timer) {
              clearInterval(timer);
              timer = null;
              void save({ force: true });
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        /* o iframe já pode ter sido removido pelo React */
      }
    };
  }, [provider, videoUrl, onSample, save]);

  // ---- Vimeo ----
  useEffect(() => {
    if (provider !== "vimeo" || !videoUrl || !hostRef.current) return;
    const embed = vimeoEmbedUrl(videoUrl);
    if (!embed) return;
    let player: VimeoPlayer | null = null;
    let cancelled = false;

    void loadScript(
      "https://player.vimeo.com/api/player.js",
      () => Boolean(window.Vimeo?.Player),
    ).then(() => {
      if (cancelled || !hostRef.current || !window.Vimeo) return;
      player = new window.Vimeo.Player(hostRef.current, {
        url: embed,
        responsive: true,
      });
      player.on("timeupdate", (d) => onSample(d.seconds, d.duration));
      player.on("pause", () => void save({ force: true }));
      player.on("ended", () => void save({ force: true }));
    });

    return () => {
      cancelled = true;
      void player?.destroy().catch(() => {});
    };
  }, [provider, videoUrl, onSample, save]);

  // Gravação final ao sair da página / mudar de separador.
  useEffect(() => {
    const flush = () => void save({ force: true });
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [save]);

  // ---- Loom: temporizador de permanência (sem eventos de progresso) ----
  const [dwellSeconds, setDwellSeconds] = useState(0);
  useEffect(() => {
    if (provider !== "loom" || completed) return;
    const t = setInterval(() => setDwellSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [provider, completed]);

  const dwellNeeded = Math.max(60, Math.round(estMinutes * 60 * 0.9));
  const canConfirm = dwellSeconds >= dwellNeeded;

  async function confirmManual() {
    setSaving(true);
    latest.current = { seconds: dwellSeconds, percent: THRESHOLD };
    await save({ force: true, manual: true });
    setSaving(false);
    setPercent((p) => Math.max(p, THRESHOLD));
    router.refresh();
  }

  // Aula por gravar. Enquanto o programa não estiver todo filmado, ESTE é o
  // estado que a equipa mais vê — por isso é um painel escuro e sóbrio, não um
  // bloco de gradiente a ocupar o ecrã inteiro. O sinal de que falta algo dá-se
  // com uma etiqueta e um contorno tracejado, não com brilho.
  if (!videoUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/12 bg-white/[0.015]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-[0.14] blur-2xl"
          style={{ background: "var(--brand-gradient)" }}
        />
        <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 px-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <PlayCircle className="h-6 w-6 text-white/35" />
          </span>
          <span className="readout text-amber-200/70">Brevemente</span>
          <span className="max-w-xs text-center text-[12px] leading-relaxed text-white/40">
            Esta aula ainda não foi gravada. Não bloqueia a tua progressão —
            podes avançar para a seguinte.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="relative aspect-video w-full">
          {provider === "youtube" || provider === "vimeo" ? (
            // Os SDKs substituem este div pelo respetivo iframe.
            <div ref={hostRef} className="absolute inset-0 h-full w-full" />
          ) : provider === "file" ? (
            <video
              src={videoUrl}
              controls
              className="absolute inset-0 h-full w-full"
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                onSample(v.currentTime, v.duration);
              }}
              onPause={() => void save({ force: true })}
            />
          ) : (
            <iframe
              src={provider === "loom" ? loomEmbedUrl(videoUrl) : videoUrl}
              title={title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </div>

      {/* Barra de visualização */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-1.5 min-w-[140px] flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="brand-gradient-bg h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        {completed ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aula concluída
          </span>
        ) : (
          <span className="tabular text-[11.5px] font-medium text-white/50">
            {percent}% visto · conta como visto aos {THRESHOLD}%
          </span>
        )}
      </div>

      {/* Loom não reporta progresso — confirmação manual, marcada como tal. */}
      {provider === "loom" && !completed && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-[12px] text-amber-100/85">
            O Loom não permite medir automaticamente quanto do vídeo foi visto.
            Confirma tu quando acabares — fica registado como confirmação
            manual.
          </p>
          <button
            type="button"
            onClick={confirmManual}
            disabled={!canConfirm || saving}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-white/85 transition hover:border-[#783DF5]/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : canConfirm ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {canConfirm
              ? "Já vi esta aula"
              : `Disponível daqui a ${Math.ceil((dwellNeeded - dwellSeconds) / 60)} min`}
          </button>
        </div>
      )}
    </div>
  );
}
