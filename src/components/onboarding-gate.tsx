"use client";

// First-visit legal gate: the client must confirm they've signed the contract
// and paid the invoice before entering onboarding. Shown once per client
// (confirmation is recorded server-side). Renders as a blocking modal overlay.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Loader2,
  ArrowRight,
  FileSignature,
  Receipt,
} from "lucide-react";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

export function OnboardingGate({
  slug,
  clientTitle,
}: {
  slug: string;
  clientTitle: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const ok = value.trim().toLowerCase() === "confirmar";

  async function confirm() {
    if (!ok) return;
    setState("saving");
    try {
      const res = await fetch(`/api/onboarding-gate/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "done") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: "rgba(20,16,32,0.55)" }}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-black/8 bg-white shadow-2xl">
        {/* gradient header */}
        <div className="relative px-7 pt-8 pb-6" style={{ background: BRAND_GRADIENT }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <ShieldCheck className="h-6 w-6 text-white" />
          </span>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            Antes de começar
          </h2>
          <p className="mt-1 text-[13px] font-medium text-white/80">
            {clientTitle}
          </p>
        </div>

        <div className="px-7 py-6">
          <p className="text-[14.5px] leading-relaxed text-black/70">
            Este processo de onboarding só pode ser realizado depois de
            concluídos <strong className="font-semibold text-black/85">os dois passos</strong> abaixo:
          </p>

          {/* The two required actions, emphasised */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-[#783DF5]/20 bg-[#783DF5]/[0.05] px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#783DF5]/12">
                <FileSignature className="h-4 w-4 text-[#783DF5]" />
              </span>
              <p className="text-[13.5px] font-bold text-black/85 underline decoration-[#783DF5]/50 decoration-2 underline-offset-2">
                Contrato assinado
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#783DF5]/20 bg-[#783DF5]/[0.05] px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#783DF5]/12">
                <Receipt className="h-4 w-4 text-[#783DF5]" />
              </span>
              <p className="text-[13.5px] font-bold text-black/85 underline decoration-[#783DF5]/50 decoration-2 underline-offset-2">
                Fatura liquidada
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-black/8 bg-[#f8f7f2] px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#A9834F]" />
            <p className="text-[12.5px] leading-relaxed text-black/55">
              Trata-se de um processo confidencial e legalmente registado. A sua
              confirmação fica associada a esta conta.
            </p>
          </div>

          <label className="mt-6 block">
            <span className="text-[13px] font-medium text-black/70">
              Escreva <span className="font-bold text-[#783DF5]">Confirmar</span>{" "}
              para declarar que já assinou o contrato e pagou a fatura.
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
              placeholder="Confirmar"
              autoFocus
              className="mt-2 w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-black/80 outline-none transition-all duration-200 focus:border-[#783DF5]/50 focus:ring-2 focus:ring-[#783DF5]/15"
            />
          </label>

          {state === "error" && (
            <p className="mt-2 text-[12px] text-rose-600">
              Não foi possível confirmar. Tente novamente.
            </p>
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={!ok || state === "saving"}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: BRAND_GRADIENT }}
          >
            {state === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Confirmar e continuar
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
