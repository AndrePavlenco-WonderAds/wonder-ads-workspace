"use client";

// Que secções entram neste relatório. Vêm todas incluídas; o consultor
// desliga as que não quer que o cliente veja — a escolha grava no snapshot
// e o documento (interno, PDF e link público) esconde-as de imediato.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, LayoutList } from "lucide-react";
import type { ReportSectionKey } from "@/lib/report/report-types";

export type SectionOption = { key: ReportSectionKey; label: string };

export function ReportSectionsToggle({
  slug,
  period,
  sections,
  hidden,
}: {
  slug: string;
  period: string;
  /** As secções que este relatório pode ter, na ordem do documento. */
  sections: SectionOption[];
  hidden: ReportSectionKey[];
}) {
  const router = useRouter();
  const [off, setOff] = useState<Set<ReportSectionKey>>(() => new Set(hidden));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const toggle = (key: ReportSectionKey) => {
    setOff((p) => {
      const next = new Set(p);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/${slug}/${period}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hiddenSections: Array.from(off) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setDirty(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-2 flex items-center gap-2">
        <LayoutList className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-[13px] font-semibold text-white/85">
          Secções do relatório
        </h3>
        {off.size > 0 && (
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/45">
            {off.size} retirada{off.size === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => {
          const on = !off.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition ${
                on
                  ? "border-[#783DF5]/40 bg-[#783DF5]/12 text-white/85"
                  : "border-white/10 bg-white/[0.015] text-white/35 line-through hover:text-white/55"
              }`}
              title={on ? "Incluída — clica para retirar" : "Retirada — clica para incluir"}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[#b79bff]" : "bg-white/20"}`}
                aria-hidden
              />
              {s.label}
            </button>
          );
        })}
      </div>
      {(dirty || saved || err) && (
        <div className="mt-3 flex items-center gap-3">
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#783DF5]/50 bg-[#783DF5]/15 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#783DF5]/25 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Aplicar secções
            </button>
          )}
          {saved && !busy && (
            <span className="text-[12px] text-emerald-300">Aplicado ✓</span>
          )}
          {err && (
            <span className="text-[12px] text-rose-400">
              Não foi possível guardar: {err}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
