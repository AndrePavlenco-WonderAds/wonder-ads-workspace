"use client";

// Per-client Google Business Profile listings.
//
// Most clients have one listing, auto-matched by the website on the ficha. But
// a clinic with a unit in Cascais and another em Lisboa has ONE LISTING PER
// UNIT, each with its own website clicks, direction requests and calls —
// rolling them into a single number hides which unit is actually being found,
// which is exactly the thing the client wants to know.
//
// Since v78.65 every listing that shares the client's website is discovered
// on its own (shown here read-only, from the cached Google list). The rows
// below are only for units with another website, or none. Each listing, found
// or added, is its own block of three rows in the report (and three more rows
// to fill by hand when the API is down), named after the unit. The
// consolidated total on the card is the sum of all of them.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, MapPin, AlertCircle, Plus, X, Search } from "lucide-react";
import { MAX_GBP_PROFILES, type GbpProfile } from "@/lib/report/report-types";
import type { GbpDiscoveredLocation } from "@/lib/gbp";

/** A listing while being edited. */
type ProfileDraft = { id: string; label: string; locationId: string };

/** What the server found by website, from the cached Google list. null =
 *  nothing cached yet (no report generated and nobody searched). */
export type GbpDiscovered = {
  main: GbpDiscoveredLocation | null;
  auto: GbpDiscoveredLocation[];
} | null;

/** Listings the service account can see, for the id picker. */
type KnownLocation = {
  id: string;
  title?: string;
  websiteUri?: string;
  websiteHost: string | null;
};

const newId = () => `g${Math.random().toString(36).slice(2, 9)}`;

const HINTS: { label: string; locationId: string }[] = [
  { label: "Unidade Cascais", locationId: "1234567890123456789" },
  { label: "Unidade Lisboa", locationId: "9876543210987654321" },
  { label: "Unidade Oeiras", locationId: "1122334455667788990" },
];

export function ReportGbpProfiles({
  slug,
  gbpMainLabel,
  extraGbpProfiles,
  discovered = null,
  bare = false,
}: {
  slug: string;
  gbpMainLabel: string | null;
  extraGbpProfiles: GbpProfile[];
  /** Fichas encontradas pelo website do cliente (v78.65). */
  discovered?: GbpDiscovered;
  /** Sem cartão nem cabeçalho próprios — para viver dentro de um disclosure
   *  que já traz ambos (v77.1). */
  bare?: boolean;
}) {
  const router = useRouter();
  const [mainLabel, setMainLabel] = useState(gbpMainLabel ?? "");
  const [rows, setRows] = useState<ProfileDraft[]>(() =>
    extraGbpProfiles.map((p) => ({ ...p })),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The Google listings, loaded on demand. The Business Profile API has a very
  // low quota, so this is never fetched automatically — only when the
  // consultant asks for it (and the endpoint serves from cache when it can).
  const [known, setKnown] = useState<KnownLocation[] | null>(null);
  const [loadingKnown, setLoadingKnown] = useState(false);
  const [knownErr, setKnownErr] = useState<string | null>(null);

  const setRow = (id: string, patch: Partial<ProfileDraft>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function loadKnown() {
    setLoadingKnown(true);
    setKnownErr(null);
    try {
      const res = await fetch("/api/admin/gbp/locations");
      const j = (await res.json().catch(() => null)) as {
        status?: string;
        message?: string;
        locations?: KnownLocation[];
      } | null;
      if (!res.ok || !j) throw new Error(`HTTP ${res.status}`);
      if (j.status !== "ok") {
        throw new Error(
          j.status === "not-configured"
            ? "Sem service account Google neste deployment."
            : (j.message ?? "A Google não devolveu as fichas."),
        );
      }
      setKnown(j.locations ?? []);
    } catch (e) {
      setKnownErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setLoadingKnown(false);
    }
  }

  async function save() {
    // A half-filled row would vanish server-side without a word — say so.
    const filled = rows.filter((r) => r.label.trim() || r.locationId.trim());
    if (filled.some((r) => !r.label.trim() || !r.locationId.trim())) {
      setErr("Cada localização precisa de um nome e de um Location ID.");
      return;
    }
    const ids = filled.map((r) => r.locationId.trim().replace(/^locations\//, ""));
    if (new Set(ids).size !== ids.length) {
      setErr("Há duas localizações com o mesmo Location ID — os cliques seriam contados a dobrar.");
      return;
    }
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/reports/${slug}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gbpMainLabel: mainLabel.trim(),
          extraGbpProfiles: filled.map((r) => ({
            id: r.id,
            label: r.label.trim(),
            locationId: r.locationId.trim(),
          })),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Não foi possível guardar.");
      }
      setRows(filled);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  /** The Google listing behind an id the consultant typed/picked, if we know it. */
  const matchOf = (locationId: string): KnownLocation | undefined => {
    const bare = locationId.trim().replace(/^locations\//, "");
    if (!bare || !known) return undefined;
    return known.find((l) => l.id === bare);
  };

  const inputCls =
    "min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-1.5 font-mono text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50";
  const nameCls =
    "w-40 shrink-0 rounded-lg border border-white/12 bg-black/25 px-3 py-1.5 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50";

  return (
    <div
      className={
        bare
          ? "p-5"
          : "mb-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
      }
    >
      {!bare && (
        <div className="mb-1 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#b79bff]" />
          <h3 className="text-sm font-semibold text-white/85">
            Localizações do Google Business Profile
          </h3>
        </div>
      )}
      <p className="mb-4 text-[12px] leading-relaxed text-white/45">
        Todas as fichas Google com o website do cliente entram sozinhas no
        relatório, cada uma com os seus números. Só precisas de adicionar aqui
        as que têm outro website — ou nenhum.
      </p>

      {/* O que entra sozinho — da cache da lista Google, sem gastar quota. */}
      {discovered === null ? (
        <p className="mb-4 text-[12px] text-white/40">
          Ainda não conheço as fichas deste cliente: gera o relatório uma vez,
          ou carrega em «Procurar na Google» abaixo.
        </p>
      ) : discovered.main ? (
        <div className="mb-4 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] px-3.5 py-3">
          <div className="mb-1.5 text-[12px] font-semibold text-emerald-200/85">
            {discovered.auto.length === 0
              ? "1 ficha encontrada pelo website"
              : `${discovered.auto.length + 1} fichas encontradas pelo website`}
          </div>
          <ul className="flex flex-col gap-0.5">
            {[discovered.main, ...discovered.auto].map((l, i) => (
              <li
                key={l.id}
                className="flex flex-wrap items-baseline gap-x-2 text-[12px]"
              >
                <span className="text-white/80">{l.title}</span>
                {i === 0 && discovered.auto.length > 0 && (
                  <span className="text-[10.5px] uppercase tracking-wide text-emerald-300/70">
                    principal
                  </span>
                )}
                <code className="font-mono text-[11px] text-white/30">{l.id}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-amber-300/90">
          <AlertCircle className="h-3.5 w-3.5" />
          Nenhuma ficha Google tem o website deste cliente — confirma o website
          na ficha ou fixa o Location ID.
        </p>
      )}

      {/* Nome da ficha principal — só faz sentido havendo mais do que uma. */}
      <label className="flex flex-wrap items-center gap-2.5">
        <span className="w-40 shrink-0 text-[13px] text-white/65">
          Localização principal
        </span>
        <input
          type="text"
          value={mainLabel}
          onChange={(e) => setMainLabel(e.target.value)}
          placeholder={
            discovered?.main && discovered.auto.length > 0
              ? `ex.: ${discovered.main.label}`
              : "ex.: Clínica Cascais"
          }
          maxLength={60}
          className={nameCls}
        />
      </label>
      {discovered?.main && discovered.auto.length > 0 && (
        <p className="mt-1.5 pl-[10.75rem] text-[11.5px] text-white/35">
          Vazio = «{discovered.main.label}», o nome da unidade na Google.
        </p>
      )}

      <div className="mt-5 border-t border-white/8 pt-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12.5px] font-semibold text-white/70">
            Localizações com outro website (ou sem website)
          </div>
          <button
            type="button"
            onClick={() => void loadKnown()}
            disabled={loadingKnown}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1 text-[12px] font-medium text-white/60 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
          >
            {loadingKnown ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Procurar na Google
          </button>
        </div>


        {knownErr && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-amber-300/90">
            <AlertCircle className="h-3.5 w-3.5" />
            {knownErr}
          </p>
        )}
        {known && (
          <div className="mb-3 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2.5">
            {known.length === 0 ? (
              <p className="text-[12px] text-white/40">
                A Google não devolveu nenhuma localização para esta conta.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {known.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-baseline gap-2 text-[12px]">
                    <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/80">
                      {l.id}
                    </code>
                    <span className="text-white/65">{l.title ?? "—"}</span>
                    {l.websiteHost && (
                      <span className="text-white/30">{l.websiteHost}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Datalist para autocompletar o ID a partir da lista carregada. */}
        {known && known.length > 0 && (
          <datalist id={`gbp-locations-${slug}`}>
            {known.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title ?? l.websiteHost ?? l.id}
              </option>
            ))}
          </datalist>
        )}

        {rows.length > 0 && (
          <div className="mb-3 flex flex-col gap-2.5">
            {rows.map((row, i) => {
              const hint = HINTS[i % HINTS.length];
              const match = matchOf(row.locationId);
              return (
                <div key={row.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => setRow(row.id, { label: e.target.value })}
                      placeholder={hint.label}
                      maxLength={60}
                      className={nameCls}
                    />
                    <input
                      type="text"
                      value={row.locationId}
                      onChange={(e) => setRow(row.id, { locationId: e.target.value })}
                      placeholder={hint.locationId}
                      spellCheck={false}
                      list={known && known.length > 0 ? `gbp-locations-${slug}` : undefined}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
                      title="Remover localização"
                      aria-label={`Remover localização ${row.label || i + 1}`}
                      className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:border-red-400/40 hover:text-red-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {match && (
                    <span className="pl-[10.75rem] text-[11.5px] text-emerald-300/70">
                      {match.title ?? "localização encontrada"}
                      {match.websiteHost ? ` · ${match.websiteHost}` : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            setRows((list) => [...list, { id: newId(), label: "", locationId: "" }])
          }
          disabled={rows.length >= MAX_GBP_PROFILES}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar localização
        </button>
        {rows.length >= MAX_GBP_PROFILES && (
          <span className="ml-2 text-[12px] text-white/35">
            Máximo de {MAX_GBP_PROFILES} localizações adicionais.
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#783DF5] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#8a52ff] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Guardar localizações
        </button>
        {saved && (
          <span className="text-[12.5px] text-emerald-300/90">
            Guardado ✓ — regenera o relatório para puxar os dados.
          </span>
        )}
        {err && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-red-300/90">
            <AlertCircle className="h-3.5 w-3.5" />
            {err}
          </span>
        )}
      </div>
    </div>
  );
}
