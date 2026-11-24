"use client";

// «Acionar o Botão» — a caixa da direção (v80.34). Cada pedido chega com o
// cliente, o problema em 2 linhas e as sugestões do consultor; a direção
// responde (opcional) e fecha. A resposta aparece ao consultor na página e
// no sino.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { BOTAO_REPLY_MAX, botaoClientLabel, type BotaoRequest } from "@/lib/botao/shared";

export function BotaoInbox({ requests }: { requests: BotaoRequest[] }) {
  const open = requests.filter((r) => r.status === "novo");
  const closed = requests.filter((r) => r.status === "resolvido");
  const [tab, setTab] = useState<"novo" | "resolvido">("novo");
  const list = tab === "novo" ? open : closed;

  return (
    <div>
      <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {(
          [
            ["novo", `Por analisar (${open.length})`],
            ["resolvido", `Resolvidos (${closed.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`rounded-xl px-4 py-2 text-[13px] font-medium transition ${
              tab === id ? "bg-white text-[#07080d]" : "text-white/60 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {list.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center text-[14px] text-white/45">
            {tab === "novo" ? "Nenhum botão por analisar." : "Ainda nenhum pedido resolvido."}
          </p>
        )}
        {list.map((r) => (
          <InboxCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

function InboxCard({ r }: { r: BotaoRequest }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/botao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, reply }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível fechar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível fechar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article id={r.id} className="scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-white/45">
        <span className="text-[14px] font-semibold text-white">{r.name}</span>
        <span>{r.dept}</span>
        <span>·</span>
        <span suppressHydrationWarning>{formatDateTime(r.createdAt)}</span>
        <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-white/75">{botaoClientLabel(r)}</span>
        {r.meeting && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#c4a6ff]/35 bg-[#783DF5]/15 px-2.5 py-0.5 text-[#e4d6ff]">
            <CalendarClock className="h-3.5 w-3.5" /> Vai marcar reunião
          </span>
        )}
      </div>

      <p className="mt-3 text-[17px] font-semibold leading-snug text-white">{r.problem}</p>

      <ol className="mt-3 space-y-1.5">
        {r.solutions.map((s, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-white/70">
            <span className="shrink-0 font-semibold text-[#c4a6ff]">Sugestão {i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {r.status === "resolvido" ? (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-white/75">
          <p className="font-semibold text-emerald-200" suppressHydrationWarning>
            Resolvido por {r.resolvedByName ?? "direção"}
            {r.resolvedAt ? ` · ${formatDateTime(r.resolvedAt)}` : ""}
          </p>
          {r.reply && <p className="mt-1">{r.reply}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5 border-t border-white/[0.07] pt-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={BOTAO_REPLY_MAX}
            rows={2}
            placeholder="Resposta ao consultor (opcional) — aparece-lhe na página e no sino."
            className="block w-full resize-y rounded-xl border border-white/12 bg-black/30 px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/70"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resolve}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-[#07080d] transition hover:bg-white/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Marcar como resolvido
            </button>
            {error && <span className="text-[13px] text-rose-300">{error}</span>}
          </div>
        </div>
      )}
    </article>
  );
}
