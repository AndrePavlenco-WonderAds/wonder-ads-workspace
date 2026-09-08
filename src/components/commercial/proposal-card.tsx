"use client";

// Cartão de uma proposta no departamento Comercial (v77.12).
//
// O que mudou face à lista antiga: o tipo (Renovação ↔ Cross-sell) edita-se
// no próprio chip; a resposta do cliente regista-se aqui («Aceitou» /
// «Recusou», e «Anular» para voltar a «Enviada»); o consultor deixa de ser
// um nome perdido numa linha de pontos e passa a um cartão com retrato,
// cargo e e-mail; os metadados ficam em células com rótulo em vez de uma
// frase separada por «·». As propostas carregadas em PDF têm ainda o botão
// de descarregar o ficheiro e, para quem pode editar, o de apagar.

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Mail,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import { LogoChip } from "@/components/logo-chip";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  KIND_LABEL,
  PROPOSAL_KINDS,
  STATUS_LABEL,
  type ProposalKind,
  type ProposalStatus,
} from "@/lib/proposals";
import type { ProposalConsultant } from "@/lib/proposals/consultant";
import type { ProposalDecision, ProposalFile, ProposalSource } from "@/lib/proposals/store";

export type ProposalCardData = {
  slug: string;
  href: string;
  clientSlug: string | null;
  clientName: string;
  logo: string | null;
  gradient: string;
  title: string;
  kind: ProposalKind;
  status: ProposalStatus;
  date: string;
  period: string;
  investment: string;
  summary: string;
  source: ProposalSource;
  decision: ProposalDecision | null;
  file: ProposalFile | null;
  uploadedAt: number | null;
  uploadedByName: string | null;
  consultant: ProposalConsultant;
};

const STATUS_CLASS: Record<ProposalStatus, string> = {
  rascunho: "border-white/15 bg-white/5 text-white/55",
  enviada: "border-amber-300/40 bg-amber-400/10 text-amber-100",
  aceite: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100",
  recusada: "border-rose-300/50 bg-rose-400/15 text-rose-100",
};

const STATUS_DOT: Record<ProposalStatus, string> = {
  rascunho: "bg-white/40",
  enviada: "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]",
  aceite: "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]",
  recusada: "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.8)]",
};

const KIND_ICON: Record<ProposalKind, typeof FileSignature> = {
  renovacao: FileSignature,
  "cross-sell": Sparkles,
};

const KIND_CLASS: Record<ProposalKind, string> = {
  renovacao: "border-violet-300/40 bg-violet-400/10 text-violet-100",
  "cross-sell": "border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-100",
};

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProposalCard({ p, canEdit }: { p: ProposalCardData; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kindOpen, setKindOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const kindRef = useRef<HTMLDivElement | null>(null);

  // O menu do tipo fecha com Escape ou com um clique fora dele — senão
  // ficava aberto até se clicar outra vez no chip.
  useEffect(() => {
    if (!kindOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (kindRef.current && !kindRef.current.contains(e.target as Node)) setKindOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKindOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [kindOpen]);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`/api/commercial/proposals/${p.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gravar.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/commercial/proposals/${p.slug}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar.");
      setBusy(null);
    }
  }

  const KindIcon = KIND_ICON[p.kind];
  const decided = p.decision;
  const accent =
    p.status === "aceite"
      ? "from-emerald-400/70 to-emerald-400/0"
      : p.status === "recusada"
        ? "from-rose-400/70 to-rose-400/0"
        : "from-[#783DF5]/70 to-[#783DF5]/0";
  const working = busy !== null || pending;

  return (
    <li className="brand-gradient-border group/card relative overflow-hidden rounded-2xl bg-white/[0.035] backdrop-blur-md">
      {/* Barra de estado à esquerda */}
      <span aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${accent}`} />

      <div className="p-5 sm:p-6">
        {/* ----- Linha 1: chips + ações ----- */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tipo (editável) */}
            <div ref={kindRef} className="relative">
              <button
                type="button"
                disabled={!canEdit || working}
                onClick={() => setKindOpen((v) => !v)}
                title={canEdit ? "Mudar o tipo da proposta" : KIND_LABEL[p.kind]}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${KIND_CLASS[p.kind]} ${
                  canEdit ? "hover:brightness-125" : "cursor-default"
                } disabled:opacity-70`}
              >
                <KindIcon className="h-3 w-3" />
                {KIND_LABEL[p.kind]}
                {canEdit && <ChevronDown className={`h-3 w-3 opacity-70 transition ${kindOpen ? "rotate-180" : ""}`} />}
              </button>
              {kindOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#0d0d14] p-1 shadow-2xl shadow-black/60"
                >
                  {PROPOSAL_KINDS.map((k) => {
                    const Icon = KIND_ICON[k];
                    const active = k === p.kind;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setKindOpen(false);
                          if (!active) void patch({ kind: k }, "kind");
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${
                          active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {KIND_LABEL[k]}
                        {active && <Check className="ml-auto h-3.5 w-3.5 text-emerald-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Estado */}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${STATUS_CLASS[p.status]}`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
              {STATUS_LABEL[p.status]}
            </span>

            <span className="text-[11px] text-white/40">{formatDate(p.date)}</span>

            {p.source === "upload" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">
                <FileText className="h-3 w-3" /> PDF
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              Abrir proposta
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {p.file && (
              <a
                href={`${p.file.url}${p.file.url.includes("?") ? "&" : "?"}download=1`}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                title={`${p.file.name}${p.file.size ? ` · ${formatSize(p.file.size)}` : ""}`}
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </a>
            )}
            <CopyPublicLinkButton path={p.href} />
          </div>
        </div>

        {/* ----- Linha 2: logo + título + resumo ----- */}
        <div className="mt-4 flex items-start gap-4">
          <div className="shrink-0">
            <LogoChip logo={p.logo} emoji={null} alt={`${p.clientName} logo`} gradient={p.gradient} size="lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">
              {p.clientSlug ? (
                <Link href={`/seo/${p.clientSlug}`} className="hover:underline">
                  {p.clientName}
                </Link>
              ) : (
                p.clientName
              )}
              <span className="text-white/30"> · </span>
              <span className="text-white/80">{p.title}</span>
            </h3>
            {p.summary && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-white/60">{p.summary}</p>}
          </div>
        </div>

        {/* ----- Linha 3: células de metadados ----- */}
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr_1.3fr]">
          <Cell label="Período">
            <span className="text-[13px] font-medium text-white/85">{p.period || "—"}</span>
          </Cell>
          <Cell label="Investimento">
            <span className="text-[13px] font-semibold text-white">{p.investment || "—"}</span>
          </Cell>
          <Cell label="Consultor">
            <ConsultantChip c={p.consultant} />
          </Cell>
          <Cell label="Resposta do cliente" highlight={Boolean(decided)}>
            {decided ? (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${
                    decided.status === "aceite" ? "text-emerald-200" : "text-rose-200"
                  }`}
                >
                  {decided.status === "aceite" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {decided.status === "aceite" ? "Aceitou a proposta" : "Recusou a proposta"}
                </span>
                <span className="text-[11px] text-white/45">
                  {formatDateTime(decided.at)}
                  {decided.byName ? ` · por ${decided.byName}` : ""}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void patch({ decision: null }, "undo")}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-60"
                    title="Anular a decisão e voltar a «Enviada»"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Anular
                  </button>
                )}
              </div>
            ) : canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void patch({ decision: "aceite" }, "aceite")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {busy === "aceite" ? "A gravar…" : "Cliente aceitou"}
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void patch({ decision: "recusada" }, "recusada")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-300/40 bg-rose-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  {busy === "recusada" ? "A gravar…" : "Cliente recusou"}
                </button>
              </div>
            ) : (
              <span className="text-[12px] text-white/45">Aguarda resposta</span>
            )}
          </Cell>
        </div>

        {/* ----- Rodapé: origem + apagar ----- */}
        {(p.source === "upload" || error) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-white/35">
              {p.source === "upload" && p.uploadedAt
                ? `Carregada a ${formatDateTime(p.uploadedAt)}${p.uploadedByName ? ` por ${p.uploadedByName}` : ""}${
                    p.file?.pages ? ` · ${p.file.pages} página${p.file.pages === 1 ? "" : "s"}` : ""
                  }`
                : ""}
            </p>
            {p.source === "upload" && canEdit && (
              confirmDelete ? (
                <span className="inline-flex items-center gap-2 text-[11px] text-white/60">
                  Apagar esta proposta?
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void remove()}
                    className="rounded-md border border-rose-300/40 bg-rose-400/10 px-2 py-1 font-semibold text-rose-100 hover:bg-rose-400/20 disabled:opacity-60"
                  >
                    {busy === "delete" ? "A apagar…" : "Sim, apagar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md border border-white/10 px-2 py-1 text-white/60 hover:text-white"
                  >
                    Não
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-white/35 transition hover:text-rose-200"
                >
                  <Trash2 className="h-3 w-3" />
                  Apagar
                </button>
              )
            )}
          </div>
        )}
        {error && <p className="mt-2 text-[12px] text-rose-300">{error}</p>}
      </div>
    </li>
  );
}

function Cell({
  label,
  children,
  highlight = false,
}: {
  label: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 ${
        highlight ? "border-white/15 bg-white/[0.06]" : "border-white/8 bg-white/[0.03]"
      }`}
    >
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ConsultantChip({ c }: { c: ProposalConsultant }) {
  const initial = c.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex items-center gap-2.5">
      {c.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.avatar}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full border border-white/15 object-cover object-[50%_35%]"
        />
      ) : (
        <span className="brand-gradient-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white">
          {initial}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-semibold text-white">{c.name}</p>
        <p className="truncate text-[11px] text-white/50">
          {c.role ?? "Consultor"}
          {c.email && (
            <>
              <span className="text-white/25"> · </span>
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-white">
                <Mail className="h-3 w-3" />
                {c.email}
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
