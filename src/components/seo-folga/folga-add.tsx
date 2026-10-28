"use client";

// Lançar um extra na Folga de custos (v78.37). Antes de gravar, mostra como
// fica o saldo — e avisa quando o extra passa a folga, porque a partir daí
// o extra devia ser cobrado ou aprovado pela direção.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import {
  FOLGA_CATEGORIES,
  FOLGA_START,
  eurCents,
  type FolgaCategory,
  type FolgaKind,
} from "@/lib/seo-folga";

type Props = {
  slug: string;
  remaining: number;
  available: number;
  /** Lite sem folga: só se lança «cobrado ao cliente». */
  chargeOnly: boolean;
  today: string;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-[#a78bfa]/60 focus:outline-none focus:ring-2 focus:ring-[#a78bfa]/20";

export function FolgaAdd({ slug, remaining, available, chargeOnly, today }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<FolgaCategory>("conteudo");
  const [kind, setKind] = useState<FolgaKind>(chargeOnly ? "cobrado" : "folga");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const eur = Number(amount.replace(",", "."));
  const cents = Number.isFinite(eur) && eur > 0 ? Math.round(eur * 100) : 0;
  const after = kind === "folga" ? remaining - cents : remaining;
  const afterPct = available > 0 ? Math.max(0, Math.min(100, (after / available) * 100)) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/seo/folga/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, eur: cents / 100, category, kind, date, note }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível lançar o extra.");
      setTitle("");
      setAmount("");
      setNote("");
      setDate(today);
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-[17px] font-semibold text-white">Lançar um extra</h2>
      <p className="mt-1 text-[13px] text-white/50">
        {chargeOnly
          ? "Cliente Lite: o extra fica no registo como cobrado ao cliente."
          : "O que oferecemos ao cliente além do contratado."}
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-white/60">O que foi</span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: 2 artigos extra para o blog"
            maxLength={120}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-white/60">Valor</span>
            <div className="relative">
              <input
                className={`${inputCls} pr-8 tabular-nums`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0,00"
                required
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-white/40">€</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-white/60">Data</span>
            <input
              type="date"
              className={`${inputCls} [color-scheme:dark]`}
              value={date}
              min={`${FOLGA_START}-01`}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium text-white/60">Categoria</legend>
          <div className="flex flex-wrap gap-1.5">
            {FOLGA_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                  category === c.id
                    ? "border-[#a78bfa]/60 bg-[#783DF5]/25 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium text-white/60">Quem paga</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                ["folga", "Sai da folga"],
                ["cobrado", "Cobrado ao cliente"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                disabled={chargeOnly && k === "folga"}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-lg px-3 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  kind === k ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-white/60">Nota (opcional)</span>
          <textarea
            className={inputCls}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Quem pediu, porque se ofereceu…"
            maxLength={500}
          />
        </label>
      </div>

      {/* Como fica — antes de gravar. */}
      {kind === "folga" && cents > 0 && (
        <div className={`mt-5 rounded-2xl border p-3.5 ${after < 0 ? "border-rose-400/35 bg-rose-500/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-white/55">Depois deste extra</span>
            <span className={`font-semibold tabular-nums ${after < 0 ? "text-rose-200" : "text-white"}`}>{eurCents(after)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${after < 0 ? 100 : afterPct}%`, background: after < 0 ? "#e11d48" : "var(--brand-gradient)" }}
            />
          </div>
          {after < 0 && (
            <p className="mt-2 text-[12.5px] leading-snug text-rose-200/90">
              Passa a folga em {eurCents(-after)}. Confirma com a direção ou lança-o como cobrado ao cliente.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-[13px] text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={saving || cents === 0 || title.trim().length < 2}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "var(--brand-gradient)" }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {done ? "Extra lançado" : "Lançar extra"}
      </button>
    </form>
  );
}
