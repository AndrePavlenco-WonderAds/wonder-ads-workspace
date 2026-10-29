"use client";

// Lançar um extra na Folga de custos (v78.37). Antes de gravar, mostra como
// fica o saldo — e avisa quando o extra passa a folga, porque a partir daí
// o extra devia ser cobrado ou aprovado pela direção (e a direção recebe um
// aviso no sino). Desde a v78.40 o extra pode ficar ligado a uma tarefa do
// roadmap ou a um ticket do cliente. Desde a v78.50, escolher uma categoria
// com preço de referência preenche o valor — que o consultor pode mudar.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import {
  FOLGA_CATEGORIES,
  FOLGA_START,
  categoryLabel,
  eurCents,
  priceInput,
  toCents,
  type FolgaCategory,
  type FolgaKind,
  type FolgaPrices,
} from "@/lib/seo-folga";

export type FolgaLinkOption = { id: string; label: string; group: string };

type Props = {
  slug: string;
  tasks: FolgaLinkOption[];
  tickets: FolgaLinkOption[];
  remaining: number;
  available: number;
  /** Lite sem folga: só se lança «cobrado ao cliente». */
  chargeOnly: boolean;
  today: string;
  /** Preços de referência por categoria (iguais em todos os projetos). */
  prices: FolgaPrices;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-[#a78bfa]/60 focus:outline-none focus:ring-2 focus:ring-[#a78bfa]/20";

const priceTitle = (eur: number | undefined) =>
  eur === undefined ? undefined : `Preço de referência: ${eurCents(toCents(eur))}`;

export function FolgaAdd({ slug, tasks, tickets, remaining, available, chargeOnly, today, prices }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  // O valor que a categoria escreveu no campo. Enquanto o campo o tiver, é
  // nosso e muda com a categoria; quando o consultor escreve outro, fica o dele.
  const [autoAmount, setAutoAmount] = useState<string | null>(null);
  const [category, setCategory] = useState<FolgaCategory>("conteudo");
  const [kind, setKind] = useState<FolgaKind>(chargeOnly ? "cobrado" : "folga");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [linkKind, setLinkKind] = useState<"none" | "task" | "ticket">("none");
  const [linkId, setLinkId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const eur = Number(amount.replace(",", "."));
  const cents = Number.isFinite(eur) && eur > 0 ? Math.round(eur * 100) : 0;
  const after = kind === "folga" ? remaining - cents : remaining;
  const afterPct = available > 0 ? Math.max(0, Math.min(100, (after / available) * 100)) : 0;
  const refPrice = prices[category];
  const usingRef = refPrice !== undefined && cents === toCents(refPrice);

  function pickCategory(id: FolgaCategory) {
    setCategory(id);
    const price = prices[id];
    const ours = amount === "" || amount === autoAmount;
    if (!ours) return;
    if (price !== undefined) {
      const v = priceInput(price);
      setAmount(v);
      setAutoAmount(v);
    } else if (autoAmount !== null) {
      // O preço era da categoria anterior: não serve para esta.
      setAmount("");
      setAutoAmount(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/seo/folga/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          eur: cents / 100,
          category,
          kind,
          date,
          note,
          link: linkKind !== "none" && linkId ? { kind: linkKind, id: linkId } : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível lançar o extra.");
      setTitle("");
      setAmount("");
      setAutoAmount(null);
      setNote("");
      setDate(today);
      setLinkKind("none");
      setLinkId("");
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
          ? "Sem folga neste projeto: o extra fica no registo como cobrado ao cliente."
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

        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium text-white/60">Categoria</legend>
          <div className="flex flex-wrap gap-1.5">
            {FOLGA_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCategory(c.id)}
                aria-pressed={category === c.id}
                title={priceTitle(prices[c.id])}
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
        {refPrice !== undefined && (
          <p className="-mt-2 text-[12px] leading-snug text-white/45">
            {usingRef ? (
              <>Preço de referência de {categoryLabel(category)}. Se este extra custou outro valor, muda-o.</>
            ) : (
              <>
                Preço de referência de {categoryLabel(category)}: {eurCents(toCents(refPrice))}.{" "}
                <button
                  type="button"
                  onClick={() => {
                    const v = priceInput(refPrice);
                    setAmount(v);
                    setAutoAmount(v);
                  }}
                  className="font-medium text-[#c4a6ff] underline-offset-2 hover:underline"
                >
                  Usar
                </button>
              </>
            )}
          </p>
        )}


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

        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium text-white/60">Ligado a (opcional)</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                ["none", "Nada", true],
                ["task", "Tarefa", tasks.length > 0],
                ["ticket", "Ticket", tickets.length > 0],
              ] as const
            ).map(([k, label, enabled]) => (
              <button
                key={k}
                type="button"
                disabled={!enabled}
                title={!enabled ? (k === "task" ? "Este cliente não tem roadmap" : "Este cliente não tem tickets no Web") : undefined}
                onClick={() => {
                  setLinkKind(k);
                  setLinkId("");
                }}
                aria-pressed={linkKind === k}
                className={`rounded-lg px-3 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  linkKind === k ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {linkKind !== "none" && (
            <select
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              aria-label={linkKind === "task" ? "Tarefa do roadmap" : "Ticket"}
              className={`${inputCls} mt-2 bg-[#15121f]`}
            >
              <option value="">{linkKind === "task" ? "Escolhe a tarefa do roadmap…" : "Escolhe o ticket…"}</option>
              {Object.entries(
                (linkKind === "task" ? tasks : tickets).reduce<Record<string, FolgaLinkOption[]>>((acc, o) => {
                  (acc[o.group] ??= []).push(o);
                  return acc;
                }, {}),
              ).map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
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
        disabled={saving || cents === 0 || title.trim().length < 2 || (linkKind !== "none" && !linkId)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "var(--brand-gradient)" }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {done ? "Extra lançado" : "Lançar extra"}
      </button>
    </form>
  );
}
