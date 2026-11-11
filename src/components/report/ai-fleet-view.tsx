"use client";

// Painel «IA no site» (v78.92) — todos os clientes SEO ativos numa tabela:
// as IAs conseguem ler o site? o plugin está ligado e a contar tudo?

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, RefreshCw } from "lucide-react";
import type { FleetRow, FleetSnapshot } from "@/lib/report/ai-fleet";

type Client = { slug: string; title: string; site: string | null; connected: boolean };

const domain = (url: string | null) => {
  if (!url) return "—";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const ver = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

function Pill({ tone, children, title }: { tone: "ok" | "warn" | "bad" | "mute"; children: React.ReactNode; title?: string }) {
  const cls = {
    ok: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200/90",
    warn: "border-amber-400/30 bg-amber-500/[0.06] text-amber-200/90",
    bad: "border-red-400/35 bg-red-500/[0.08] text-red-200/90",
    mute: "border-white/12 text-white/45",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${cls}`}>
      {children}
    </span>
  );
}

function AccessCell({ row }: { row: FleetRow | undefined }) {
  if (!row) return <Pill tone="mute">por verificar</Pill>;
  if (!row.site) return <Pill tone="mute">sem site na ficha</Pill>;
  if (row.browser === null) return <Pill tone="warn">o site não respondeu</Pill>;
  if (row.browser >= 400) return <Pill tone="warn" title="O site recusou até um browser normal vindo do workspace — inconclusivo">inconclusivo ({row.browser})</Pill>;
  const detail = row.agents.map((a) => `${a.name}: ${a.status ?? "sem resposta"}`).join(" · ");
  if (row.blocked.length === 0) return <Pill tone="ok" title={detail}>todas entram</Pill>;
  const users = row.agents.filter((a) => a.kind === "user" && row.blocked.includes(a.name));
  const search = row.agents.filter((a) => a.kind === "search" && row.blocked.includes(a.name));
  return (
    <span className="flex flex-wrap gap-1" title={detail}>
      {users.map((a) => (
        <Pill key={a.name} tone="bad">✕ {a.label} ({a.status})</Pill>
      ))}
      {search.map((a) => (
        <Pill key={a.name} tone="warn">✕ {a.label} ({a.status})</Pill>
      ))}
    </span>
  );
}

function PluginCell({ client, row, latest }: { client: Client; row: FleetRow | undefined; latest: string }) {
  const wp = row?.platform === "WordPress";
  if (!client.connected) {
    if (row && !wp && row.platform !== "?") return <span className="text-[11px] text-white/30">não é WordPress</span>;
    return (
      <Link href={`/seo/${client.slug}/report`} className="text-[11px] text-[#c9b2ff] underline-offset-2 hover:underline">
        por ligar →
      </Link>
    );
  }
  if (!row) return <Pill tone="mute">ligado</Pill>;
  const p = row.plugin;
  if (!p.ok) return <Pill tone="bad" title={p.message ?? undefined}>não responde</Pill>;
  const old = p.version && ver(p.version, latest) < 0;
  const hostCache = p.caches.find((c) => c.handled === "host");
  const manual = p.caches.filter((c) => c.handled === "manual" || (c.handled === "auto" && !c.applied));
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Pill tone={old ? "warn" : "mute"} title={old ? `Há a ${latest}. A 1.0.0 atualiza-se carregando o .zip uma vez; a partir da 1.1.0 é automático.` : undefined}>
        v{p.version}
        {old ? " ↑" : ""}
      </Pill>
      {p.verdict === "ok" && <Pill tone="ok">a contar tudo</Pill>}
      {p.verdict === "cache" && (
        <Pill tone="warn" title={hostCache?.note ?? manual.map((m) => `${m.name}: ${m.note}`).join(" · ")}>
          cache {hostCache ? `(${hostCache.name})` : ""}
        </Pill>
      )}
      {p.verdict === "blocked" && <Pill tone="bad">o site recusa IAs</Pill>}
      {p.verdict === "error" && <Pill tone="warn">não se verificou</Pill>}
      {p.verdict === null && <Pill tone="mute" title="A 1.0.0 não se verifica sozinha">sem verificação</Pill>}
    </span>
  );
}

export function AiFleetView({ clients, initial, latestPlugin }: { clients: Client[]; initial: FleetSnapshot | null; latestPlugin: string }) {
  const [snap, setSnap] = useState<FleetSnapshot | null>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bySlug = useMemo(() => new Map((snap?.rows ?? []).map((r) => [r.slug, r])), [snap]);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reports/ai-fleet", { method: "POST" });
      const json = (await res.json().catch(() => null)) as (FleetSnapshot & { error?: string }) | null;
      if (!res.ok || !json) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setSnap(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  const rows = snap?.rows ?? [];
  const blockedSites = rows.filter((r) => r.agents.some((a) => a.kind === "user" && r.blocked.includes(a.name)));
  const wpRows = rows.filter((r) => r.platform === "WordPress");
  const connected = clients.filter((c) => c.connected).length;
  const counting = rows.filter((r) => r.plugin.verdict === "ok").length;

  return (
    <div className="mt-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <Bot className="h-6 w-6 text-[#c9b2ff]" /> IA no site
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-white/50">
            Todos os clientes SEO ativos: as IAs (ChatGPT, Claude, Perplexity, Mistral e os robôs de pesquisa delas)
            conseguem ler o site? E, nos WordPress, o plugin «IA no site» está ligado e a contar tudo?
          </p>
        </div>
        <div className="flex items-center gap-3">
          {snap && <span className="text-[11px] text-white/35">Última verificação: {when(snap.at)}</span>}
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#783DF5] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {busy ? "A verificar (≈1 min)…" : "Verificar todos agora"}
          </button>
        </div>
      </header>
      {err && <p className="mt-3 text-[12px] text-red-300/90">{err}</p>}

      {snap && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={`rounded-xl border px-4 py-3 ${blockedSites.length ? "border-red-400/30 bg-red-500/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
            <div className="text-2xl font-bold text-white">{blockedSites.length}</div>
            <div className="text-[12px] text-white/55">
              {blockedSites.length === 1 ? "site recusa" : "sites recusam"} pelo menos um assistente de IA
              {blockedSites.length > 0 && <span className="text-white/40"> — {blockedSites.map((r) => r.title).join(", ")}</span>}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <div className="text-2xl font-bold text-white">
              {connected}
              <span className="text-base font-medium text-white/35"> / {wpRows.length || "—"}</span>
            </div>
            <div className="text-[12px] text-white/55">sites WordPress com o plugin ligado</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <div className="text-2xl font-bold text-white">{counting}</div>
            <div className="text-[12px] text-white/55">plugins a contar tudo (sem cache pelo meio)</div>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-[12.5px]">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Plataforma</th>
              <th className="px-3 py-2 font-medium">As IAs entram?</th>
              <th className="px-3 py-2 font-medium">Plugin «IA no site»</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const r = bySlug.get(c.slug);
              return (
                <tr key={c.slug} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <div className="font-medium text-white/85">{c.title}</div>
                    <div className="text-[11px] text-white/35">{domain(c.site)}</div>
                  </td>
                  <td className="px-3 py-2 text-white/60">{r ? r.platform : "—"}</td>
                  <td className="px-3 py-2">
                    <AccessCell row={r} />
                  </td>
                  <td className="px-3 py-2">
                    <PluginCell client={c} row={r} latest={latestPlugin} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        «✕ ChatGPT (403)» = o site recusa o assistente: ele não consegue ler o site nem para responder a quem pergunta
        por ele. Os robôs de pesquisa a amarelo podem ser só proteção contra robôs falsos (o pedido sai do workspace, não da
        OpenAI) — confirma pedindo ao próprio ChatGPT para abrir o site. Os pedidos de teste não entram nas contagens do plugin.
      </p>
    </div>
  );
}
