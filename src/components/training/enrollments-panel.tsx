"use client";

// Gestão de inscrições: atribuir/alterar as especializações de cada pessoa.
//
// Cada especialização é um chip que se liga e desliga. É deliberado não ser um
// dropdown: uma pessoa pode acumular especializações (SEO + Comercial, por
// exemplo) e num dropdown isso não se vê nem se faz. Grava-se uma linha de
// cada vez — o alvo é uma pessoa, não a tabela toda.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";

export type EnrollmentRow = {
  username: string;
  name: string;
  role: string;
  dept: string;
  trackSlugs: string[];
  /** True quando veio de uma atribuição explícita (e não do departamento). */
  assigned: boolean;
  assignedBy?: string;
};

export function EnrollmentsPanel({
  rows,
  tracks,
}: {
  rows: EnrollmentRow[];
  tracks: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function save(
    username: string,
    trackSlugs: string[],
    clear = false,
  ) {
    setPending(username);
    setError(null);
    try {
      const res = await fetch("/api/formacao/admin/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, trackSlugs, clear }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gravar.");
        return;
      }
      setSaved((p) => ({ ...p, [username]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [username]: false })), 2500);
      router.refresh();
    } catch {
      setError("Falha de rede — tenta outra vez.");
    } finally {
      setPending(null);
    }
  }

  /** Liga/desliga uma especialização mantendo as restantes. */
  function toggle(row: EnrollmentRow, slug: string) {
    const next = row.trackSlugs.includes(slug)
      ? row.trackSlugs.filter((s) => s !== slug)
      : [...row.trackSlugs, slug];
    save(row.username, next);
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-[13px] text-rose-100/90">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead className="bg-white/[0.03] text-[10.5px] uppercase tracking-[0.12em] text-white/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Pessoa</th>
              <th className="px-4 py-3 font-semibold">Departamento</th>
              <th className="px-4 py-3 font-semibold">Especializações</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const busy = pending === r.username;
              return (
                <tr key={r.username} className="border-t border-white/8">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="brand-gradient-bg flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white">
                        {r.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {r.name}
                        </p>
                        <p className="text-[10.5px] text-white/40">{r.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/60">{r.dept}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tracks.map((t) => {
                        const on = r.trackSlugs.includes(t.slug);
                        return (
                          <button
                            key={t.slug}
                            type="button"
                            disabled={busy}
                            aria-pressed={on}
                            onClick={() => toggle(r, t.slug)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition disabled:opacity-50 ${
                              on
                                ? "border-[#783DF5]/50 bg-[#783DF5]/15 text-white"
                                : "border-white/12 text-white/45 hover:border-white/30 hover:text-white/80"
                            }`}
                          >
                            {on && <Check className="h-3 w-3" />}
                            {t.name}
                          </button>
                        );
                      })}
                      {r.trackSlugs.length === 0 && !busy && (
                        <span className="text-[11.5px] text-white/30">
                          sem especialização
                        </span>
                      )}
                      {busy && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                      )}
                      {saved[r.username] && (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.assigned ? (
                      <span className="inline-flex items-center gap-2 text-[11.5px] text-white/50">
                        atribuída
                        {r.assignedBy && (
                          <span className="text-white/30">
                            por {r.assignedBy}
                          </span>
                        )}
                        <button
                          type="button"
                          title="Voltar a derivar do departamento"
                          onClick={() => save(r.username, [], true)}
                          className="rounded p-1 text-white/35 transition hover:bg-white/10 hover:text-white/70"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-white/35">
                        derivada do departamento
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
