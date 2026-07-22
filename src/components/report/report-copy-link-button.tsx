"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/** Copies the client-facing read-only report URL to the clipboard. The path
 *  is resolved against the current origin so it works on localhost + prod. */
export function ReportCopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const url =
        typeof window !== "undefined"
          ? new URL(path, window.location.origin).toString()
          : path;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08]"
      title="Copiar o link read-only para enviar ao cliente"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Link copiado" : "Copiar link do cliente"}
    </button>
  );
}
