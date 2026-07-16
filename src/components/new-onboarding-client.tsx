"use client";

// SuperAdmin-only card on the SEO board to start onboarding for a client and
// get their shareable public link. New clients (not yet on the board) are
// promoted onto it automatically when they submit the onboarding form.

import { useState } from "react";
import { Check, Link as LinkIcon, Loader2, Rocket } from "lucide-react";

export function NewOnboardingClient() {
  const [title, setTitle] = useState("");
  const [consultant, setConsultant] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!title.trim()) return;
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/onboarding-clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, consultant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const url = new URL(
        `/${data.slug}/onboarding`,
        window.location.origin,
      ).toString();
      setLink(url);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar.");
      setState("error");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copiar link:", link);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="brand-gradient-bg flex h-8 w-8 items-center justify-center rounded-lg">
          <Rocket className="h-4 w-4 text-white" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Iniciar onboarding
          </h3>
          <p className="text-[11px] text-white/45">
            Gera o link de onboarding para enviar ao cliente por email.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nome do cliente"
          className="flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#783DF5]/60 focus:bg-white/[0.06]"
        />
        <input
          type="text"
          value={consultant}
          onChange={(e) => setConsultant(e.target.value)}
          placeholder="Consultor (opcional)"
          className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#783DF5]/60 focus:bg-white/[0.06] sm:w-52"
        />
        <button
          type="button"
          onClick={create}
          disabled={!title.trim() || state === "saving"}
          className="brand-gradient-bg inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          Criar link
        </button>
      </div>

      {state === "error" && (
        <p className="mt-2 text-[12px] text-rose-300">{error}</p>
      )}

      {state === "done" && link && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[#b79bff]" />
          <span className="flex-1 truncate font-mono text-[12px] text-white/70">
            {link}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <LinkIcon className="h-3.5 w-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}
