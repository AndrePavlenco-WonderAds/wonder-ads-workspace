"use client";

// Propriedade GA4 deste cliente (v77.9).
//
// O relatório resolve a propriedade sozinho pelo domínio do site — e acerta
// quase sempre. Falha exatamente no caso do Kings Gyms: uma conta com várias
// propriedades criadas e vazias, o matcher apanha a errada, e o relatório
// sai com «0 utilizadores orgânicos» debaixo de um chip «GA4 ligado». Aqui
// o consultor vê a que propriedade está ligado, escolhe outra da lista, ou
// cola o código do site (G-XXXXXXX, que é o que se encontra no GA4/GTM) e
// a app traduz para o número da propriedade.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Check,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";

type PropertyRow = { propertyId: string; displayName: string };

type Ga4Info = {
  ok: boolean;
  reason?: string;
  stored: string | null;
  resolution: {
    propertyId: string | null;
    matchedBy: "override" | "stored" | "host" | "apex" | "name" | null;
    matchedName: string | null;
  } | null;
  properties: PropertyRow[];
};

const MATCHED_BY_LABEL: Record<string, string> = {
  override: "fixada em código",
  stored: "escolhida aqui",
  host: "pelo domínio do site",
  apex: "pelo domínio do site",
  name: "pelo nome da propriedade",
};

export function ReportGa4Property({
  slug,
  storedPropertyId,
  bare = false,
}: {
  slug: string;
  storedPropertyId: string | null;
  /** Sem cartão nem cabeçalho próprios — para viver dentro de um disclosure
   *  que já traz ambos. */
  bare?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(storedPropertyId ?? "");
  const [info, setInfo] = useState<Ga4Info | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // A lista e a resolução atual vêm da Google. Carregam ao abrir o cartão —
  // o cartão vive fechado num disclosure, por isso não custa nada a quem
  // não o abre.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    fetch(`/api/reports/${slug}/ga4-properties`)
      .then(async (res) => {
        const j = (await res.json().catch(() => null)) as Ga4Info | null;
        if (!res.ok || !j) throw new Error(`HTTP ${res.status}`);
        if (!cancelled) {
          setInfo(j);
          if (!j.ok) setLoadErr(j.reason ?? "A Google não respondeu.");
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Falhou.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const properties = useMemo(() => info?.properties ?? [], [info]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) || p.propertyId.includes(q),
    );
  }, [properties, query]);

  const current = info?.resolution ?? null;
  const currentName =
    current?.propertyId
      ? (properties.find((p) => p.propertyId === current.propertyId)?.displayName ??
        current.matchedName ??
        null)
      : null;

  const trimmed = value.trim();
  const looksLikeMeasurement = /^G-[A-Z0-9]{6,12}$/i.test(trimmed);
  const looksLikeProperty = /^\d{6,15}$/.test(trimmed);
  const valid = trimmed === "" || looksLikeMeasurement || looksLikeProperty;
  const dirty = trimmed !== (storedPropertyId ?? "");

  async function save(next: string | null) {
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/reports/${slug}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ga4PropertyId: next }),
      });
      const j = (await res.json().catch(() => null)) as
        | { error?: string; config?: { ga4PropertyId?: string | null } }
        | null;
      if (!res.ok) throw new Error(j?.error ?? "Não foi possível guardar.");
      // A rota traduz um G-… para o número da propriedade — mostra-se o que
      // ficou mesmo gravado.
      const stored = j?.config?.ga4PropertyId ?? null;
      setValue(stored ?? "");
      setSaved(
        stored
          ? `Guardado ✓ — propriedade ${stored}. Regenera o relatório para puxar os dados.`
          : "Reposto ✓ — volta a resolver pelo domínio. Regenera o relatório.",
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-1.5 font-mono text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50";

  return (
    <div
      className={
        bare ? "p-5" : "mb-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
      }
    >
      {!bare && (
        <div className="mb-1 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#b79bff]" />
          <h3 className="text-sm font-semibold text-white/85">Propriedade GA4</h3>
        </div>
      )}
      <p className="mb-3 text-[12px] leading-relaxed text-white/45">
        O relatório escolhe a propriedade pelo domínio do site. Se a conta tem
        várias (algumas vazias), escolhe aqui a certa ou cola o código do site.
      </p>

      {/* Estado atual — a resposta à pergunta «a que é que isto está ligado?» */}
      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-[12.5px]">
        {loading && !info ? (
          <span className="inline-flex items-center gap-2 text-white/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />A perguntar à Google…
          </span>
        ) : current?.propertyId ? (
          <span className="text-white/75">
            Ligado a{" "}
            <b className="text-white">{currentName ?? current.propertyId}</b>{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11.5px] text-white/70">
              {current.propertyId}
            </code>
            <span className="text-white/40">
              {" "}
              · {MATCHED_BY_LABEL[current.matchedBy ?? ""] ?? "automático"}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-200/90">
            <AlertCircle className="h-3.5 w-3.5" />
            Nenhuma propriedade encontrada para este cliente — escolhe uma abaixo.
          </span>
        )}
      </div>

      {loadErr && (
        <p className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-amber-300/90">
          <AlertCircle className="h-3.5 w-3.5" />
          {loadErr}
        </p>
      )}

      {/* Escolher da lista */}
      {properties.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-white/70">
              Propriedades visíveis ({properties.length})
            </span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="filtrar…"
                className="w-36 rounded-md border border-white/12 bg-black/25 py-1 pl-6 pr-2 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
              />
            </span>
          </div>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-[12px] text-white/40">Nada com esse nome.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filtered.map((p) => {
                  const active = p.propertyId === trimmed;
                  const isCurrent = p.propertyId === current?.propertyId;
                  return (
                    <li key={p.propertyId}>
                      <button
                        type="button"
                        onClick={() => {
                          setValue(p.propertyId);
                          setSaved(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
                          active
                            ? "bg-[#783DF5]/20 text-white"
                            : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                        <code className="shrink-0 font-mono text-[11px] text-white/45">
                          {p.propertyId}
                        </code>
                        {isCurrent && (
                          <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
                            atual
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Ou colar o id */}
      <label className="flex flex-wrap items-center gap-2.5">
        <span className="w-40 shrink-0 text-[13px] text-white/65">
          ID da propriedade
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(null);
          }}
          placeholder="123456789 ou G-ABC123XYZ"
          spellCheck={false}
          className={inputCls}
        />
      </label>
      <p className="mt-1.5 pl-[10.75rem] text-[11.5px] text-white/35">
        {looksLikeMeasurement
          ? "Código do site (Measurement ID) — a app encontra a propriedade a que pertence."
          : "Número da propriedade (Admin → Detalhes da propriedade) ou o código G-… do site."}
      </p>
      {!valid && (
        <p className="mt-1.5 pl-[10.75rem] text-[11.5px] text-amber-300/90">
          Não parece um ID do GA4: um número, ou um código a começar por G-.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save(trimmed || null)}
          disabled={busy || !valid || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#783DF5] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#8a52ff] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar propriedade
        </button>
        {(storedPropertyId || trimmed) && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              void save(null);
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12.5px] font-medium text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repor automático
          </button>
        )}
        {saved && <span className="text-[12.5px] text-emerald-300/90">{saved}</span>}
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
