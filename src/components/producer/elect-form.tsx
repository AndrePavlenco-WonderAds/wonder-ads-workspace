"use client";

// A eleição do Producer of the Month (v78.58): a direção escolhe o 1.º lugar
// (obrigatório) e, se quiser, o 2.º e o 3.º do pódio. Nada vem escolhido de
// fábrica — a tabela ao lado é só o levantamento.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trophy, X } from "lucide-react";
import { MAX_PRODUCER_NOTE } from "@/lib/producer/shared";

type Person = { username: string; name: string };

const PLACES = ["1.º lugar · Producer of the Month", "2.º lugar", "3.º lugar"];

export function ProducerElectForm({
  month,
  monthLabel,
  people,
  current,
}: {
  month: string;
  monthLabel: string;
  people: Person[];
  /** A eleição já gravada para o mês, se houver. */
  current: { podium: string[]; note: string } | null;
}) {
  const router = useRouter();
  const [podium, setPodium] = useState<string[]>(() => [0, 1, 2].map((i) => current?.podium[i] ?? ""));
  const [note, setNote] = useState(current?.note ?? "");
  const [busy, setBusy] = useState<"save" | "cancel" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function call(method: "POST" | "DELETE") {
    setBusy(method === "POST" ? "save" : "cancel");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/producer", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(method === "POST" ? { month, podium, note } : { month }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; announced?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível gravar.");
      setMsg({
        tone: "ok",
        text:
          method === "DELETE"
            ? "Eleição anulada."
            : data.announced
              ? "Eleito. O #team-wins recebeu o anúncio."
              : "Alterações gravadas (o 1.º lugar não mudou, por isso não houve novo anúncio).",
      });
      if (method === "DELETE") {
        setPodium(["", "", ""]);
        setNote("");
      }
      router.refresh();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  const taken = (i: number) => new Set(podium.filter((u, j) => u && j !== i));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void call("POST");
      }}
      className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.04] p-4 sm:p-5"
    >
      <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
        <Trophy className="h-4 w-4 text-amber-300" />
        {current ? `Pódio de ${monthLabel}` : `Eleger o pódio de ${monthLabel}`}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/50">
        A tabela só ordena. Quem ganha decides tu: o 1.º lugar é obrigatório, o 2.º e o 3.º são opcionais.
      </p>
      <div className="mt-4 space-y-2.5">
        {PLACES.map((label, i) => (
          <label key={label} className="block">
            <span className="text-[11.5px] font-medium text-white/55">{label}</span>
            <select
              value={podium[i]}
              onChange={(e) => setPodium((p) => p.map((u, j) => (j === i ? e.target.value : u)))}
              className="mt-1 w-full rounded-xl border border-white/12 bg-[#0b0c18] px-3 py-2 text-[13.5px] text-white focus:border-amber-300/60 focus:outline-none"
            >
              <option value="">{i === 0 ? "Escolhe…" : "Ninguém"}</option>
              {people.map((p) => (
                <option key={p.username} value={p.username} disabled={taken(i).has(p.username)}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="block">
          <span className="text-[11.5px] font-medium text-white/55">Porquê (opcional, vai para o Slack)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={MAX_PRODUCER_NOTE}
            className="mt-1 w-full resize-y rounded-xl border border-white/12 bg-[#0b0c18] px-3 py-2 text-[13.5px] leading-relaxed text-white placeholder:text-white/30 focus:border-amber-300/60 focus:outline-none"
            placeholder="Ex.: fechou duas renovações e manteve o NPS acima de 9."
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy !== null || !podium[0]}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-[13px] font-semibold text-[#1a1203] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
          {current ? "Guardar o pódio" : "Eleger e anunciar"}
        </button>
        {current && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void call("DELETE")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-[12.5px] font-medium text-white/60 transition hover:border-rose-300/40 hover:text-rose-200 disabled:opacity-40"
          >
            {busy === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Anular a eleição
          </button>
        )}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-white/40" aria-live="polite">
        {msg ? (
          <span className={msg.tone === "ok" ? "text-emerald-300" : "text-rose-300"}>{msg.text}</span>
        ) : (
          "Ao eleger, o #team-wins recebe o anúncio e o pódio aparece no menu de toda a equipa. Mudar só o 2.º, o 3.º ou a nota não volta a anunciar."
        )}
      </p>
    </form>
  );
}
