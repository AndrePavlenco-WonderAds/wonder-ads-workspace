"use client";

// Per-client Google Business Profile listings.
//
// Most clients have one listing, auto-matched by the website on the ficha. But
// a clinic with a unit in Cascais and another em Lisboa has ONE LISTING PER
// UNIT, each with its own website clicks, direction requests and calls —
// rolling them into a single number hides which unit is actually being found,
// which is exactly the thing the client wants to know.
//
// Each listing added here becomes its own block of three rows in the report
// (and three more rows to fill by hand when the API is down), named after the
// unit. The consolidated total on the card is the sum of all of them.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, MapPin, AlertCircle, Plus, X, Search } from "lucide-react";
import { MAX_GBP_PROFILES, type GbpProfile } from "@/lib/report/report-types";

/** A listing while being edited. */
type ProfileDraft = { id: string; label: string; locationId: string };

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
}: {
  slug: string;
  gbpMainLabel: string | null;
  extraGbpProfiles: GbpProfile[];
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
      setErr("Cada ficha precisa de um nome e de um Location ID.");
      return;
    }
    const ids = filled.map((r) => r.locationId.trim().replace(/^locations\//, ""));
    if (new Set(ids).size !== ids.length) {
      setErr("Há duas fichas com o mesmo Location ID — os cliques seriam contados a dobrar.");
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
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="mb-1 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">
          Fichas do Google Business Profile
        </h3>
      </div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-white/50">
        Por defeito o relatório usa <b className="text-white/70">uma</b> ficha, encontrada
        pelo website do cliente. Se o cliente tem{" "}
        <b className="text-white/70">mais do que uma unidade</b>, cada unidade tem a sua
        própria ficha — acrescenta-as aqui e o relatório passa a mostrar{" "}
        <b className="text-white/70">os cliques, direções e chamadas de cada uma</b>, além
        do total consolidado. Sem isto, as unidades ficam todas escondidas dentro do mesmo
        número.
      </p>

      {/* Nome da ficha principal — só faz sentido havendo mais do que uma. */}
      <label className="flex flex-wrap items-center gap-2.5">
        <span className="w-40 shrink-0 text-[13px] text-white/65">Ficha principal</span>
        <input
          type="text"
          value={mainLabel}
          onChange={(e) => setMainLabel(e.target.value)}
          placeholder="Ficha principal"
          maxLength={60}
          className={nameCls}
        />
        <span className="text-[12px] text-white/35">
          nome da ficha que já é usada (ex.: <i>Clínica Cascais</i>)
        </span>
      </label>

      <div className="mt-5 border-t border-white/8 pt-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12.5px] font-semibold text-white/70">
            Fichas adicionais
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
            Procurar fichas na Google
          </button>
        </div>
        <p className="mb-3 text-[12.5px] leading-relaxed text-white/45">
          O <b className="text-white/65">Location ID</b> é o número da ficha no Google
          Business Profile. Carrega em <i>Procurar fichas na Google</i> para as listar e
          copiar o ID certo — cada ficha adicional custa mais dois pedidos à API por
          relatório, por isso a lista só é pedida quando a pedes.
        </p>

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
                A Google não devolveu nenhuma ficha para esta conta.
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
                      title="Remover ficha"
                      aria-label={`Remover ficha ${row.label || i + 1}`}
                      className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:border-red-400/40 hover:text-red-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {match && (
                    <span className="pl-[10.75rem] text-[11.5px] text-emerald-300/70">
                      {match.title ?? "ficha encontrada"}
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
          Adicionar ficha
        </button>
        {rows.length >= MAX_GBP_PROFILES && (
          <span className="ml-2 text-[12px] text-white/35">
            Máximo de {MAX_GBP_PROFILES} fichas adicionais.
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
          Guardar fichas
        </button>
        {saved && (
          <span className="text-[12.5px] text-emerald-300/90">
            Guardado ✓ — gera o relatório de novo para puxar os dados de cada ficha.
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
