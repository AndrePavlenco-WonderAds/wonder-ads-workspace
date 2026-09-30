"use client";

// Pede uma resposta à IA e vai recebendo o texto aos bocados — a página
// mostra-o a ser escrito, com o cursor a piscar.

import { useCallback, useRef, useState } from "react";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

export type GenerateBody =
  | { reviewId: string; loc: string; previous?: string }
  | { sample: { author: string; stars: number; text: string; salon?: string }; previous?: string };

export function useReplyStream(slug: string) {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const run = useCallback(
    async (body: GenerateBody): Promise<string | null> => {
      stop();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus("streaming");
      setError(null);
      setText("");
      try {
        const res = await fetch(`/api/reviews-hub/${slug}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Não foi possível gerar a resposta.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setText(acc.replace(/^\s+/, ""));
        }
        const final = acc.trim().replace(/^[«"“]([\s\S]*)[»"”]$/, "$1").trim();
        if (!final) throw new Error("A IA não devolveu texto — tenta outra vez.");
        setText(final);
        setStatus("done");
        return final;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("idle");
          return null;
        }
        setError(err instanceof Error ? err.message : "Erro a gerar a resposta.");
        setStatus("error");
        return null;
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [slug, stop],
  );

  const reset = useCallback(
    (value = "") => {
      stop();
      setText(value);
      setStatus(value ? "done" : "idle");
      setError(null);
    },
    [stop],
  );

  return { status, text, error, run, stop, reset, setText };
}
