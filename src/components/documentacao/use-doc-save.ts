"use client";

// Gravar uma página editável da Documentação (v78.46). Cada mudança manda o
// documento inteiro para /api/documentacao/<doc>, com o `updatedAt` que a
// página conhece: se outra pessoa gravou entretanto, o servidor recusa (409)
// e a página fica com o que tinha, em vez de pisar o trabalho dela.

import { useCallback, useRef, useState } from "react";

type Stamped = { updatedAt: number; updatedBy: string | null };

export function useDocSave<T extends Stamped>(doc: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A versão gravada mais recente, mesmo a meio de um setState.
  const baseRef = useRef(initial.updatedAt);

  const save = useCallback(
    async (next: Omit<T, "updatedAt" | "updatedBy">): Promise<boolean> => {
      const before = data;
      setData((d) => ({ ...d, ...next }));
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/documentacao/${doc}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data: next, base: baseRef.current }),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
        if (!res.ok || !json.data) {
          setData(before);
          setError(json.error ?? "Não foi possível gravar. Tenta outra vez.");
          return false;
        }
        baseRef.current = json.data.updatedAt;
        setData(json.data);
        return true;
      } catch {
        setData(before);
        setError("Sem ligação — a mudança não foi gravada.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [data, doc],
  );

  return { data, save, saving, error, clearError: () => setError(null) };
}
