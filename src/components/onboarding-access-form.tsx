"use client";

// The form of an "access" onboarding lesson (v77.96: the website host). The
// client types the provider, the login link, the user and the password — or,
// when someone else manages the site, who to contact — and it all goes
// straight to the client's vault («Accesses» on /seo/<slug>) through
// /api/onboarding-accesses/<slug>. Nothing stored ever comes back here: once
// sent, the page only shows the label + date receipt, and «Atualizar» opens
// an EMPTY form that replaces what this step had sent.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/dates";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

const MAX_ENTRIES = 3;

const inputCls =
  "w-full rounded-xl border border-black/12 bg-[#f8f7f2] px-3.5 py-3 text-sm text-black/80 outline-none transition-all duration-200 placeholder:text-black/30 focus:-translate-y-[1px] focus:border-[#783DF5]/50 focus:bg-white focus:ring-2 focus:ring-[#783DF5]/15";

type Entry = {
  provider: string;
  url: string;
  username: string;
  password: string;
  notes: string;
};

const EMPTY: Entry = { provider: "", url: "", username: "", password: "", notes: "" };

type Mode = "credentials" | "third-party";

export type AccessReceipt = { labels: string[]; submittedAt: number };

function entryComplete(e: Entry): boolean {
  return Boolean(
    e.provider.trim() && e.url.trim() && e.username.trim() && e.password,
  );
}

export function OnboardingAccessForm({
  slug,
  lessonId,
  providers,
  receipt: initialReceipt,
  next,
}: {
  slug: string;
  lessonId: string;
  providers: string[];
  receipt: AccessReceipt | null;
  next: { href: string; title: string } | null;
}) {
  const router = useRouter();
  const [receipt, setReceipt] = useState<AccessReceipt | null>(initialReceipt);
  const [editing, setEditing] = useState(initialReceipt == null);
  const [mode, setMode] = useState<Mode>("credentials");
  const [entries, setEntries] = useState<Entry[]>([{ ...EMPTY }]);
  const [tpProvider, setTpProvider] = useState("");
  const [tpContact, setTpContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const canSubmit =
    mode === "credentials"
      ? entries.every(entryComplete)
      : tpContact.trim().length >= 5;

  function patch(i: number, p: Partial<Entry>) {
    setEntries((list) => list.map((e, j) => (j === i ? { ...e, ...p } : e)));
  }

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding-accesses/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "credentials"
            ? { lessonId, mode, entries }
            : { lessonId, mode, thirdParty: { provider: tpProvider, contact: tpContact } },
        ),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          data.error === "missing_fields"
            ? "Falta preencher algum campo — confirme também que o link está completo (ex.: https://…)."
            : data.error === "missing_contact"
              ? "Indique-nos o contacto de quem gere o site."
              : "Não foi possível enviar. Tente novamente dentro de instantes.",
        );
        return;
      }
      const labels =
        mode === "credentials"
          ? entries.map((e) => e.provider.trim())
          : [tpProvider.trim() || "gerido por terceiros"];
      setReceipt({ labels, submittedAt: Date.now() });
      setEditing(false);
      setEntries([{ ...EMPTY }]);
      setTpProvider("");
      setTpContact("");
      startRefresh(() => router.refresh());
    } catch {
      setError("Não foi possível enviar. Verifique a ligação e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // ---- Enviado: só o recibo (nome + data), nunca os dados ----
  if (receipt && !editing) {
    return (
      <div className="rounded-2xl border border-emerald-600/20 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-black/85">
              Acessos recebidos — obrigado!
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-black/55">
              Enviados a {formatDate(receipt.submittedAt)}. Já estão guardados na
              vossa ficha e a equipa de SEO pode começar a trabalhar.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {receipt.labels.map((l, i) => (
                <span
                  key={`${l}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-[#f8f7f2] px-2.5 py-1 text-[12px] font-medium text-black/65"
                >
                  <KeyRound className="h-3 w-3 text-[#783DF5]" />
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-black/8 pt-5">
          {next && (
            <Link
              href={next.href}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              style={{ background: BRAND_GRADIENT }}
            >
              Próximo passo
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-black/12 bg-white px-4 py-2.5 text-sm font-semibold text-black/60 transition hover:bg-black/[0.03]"
          >
            <RotateCcw className="h-4 w-4" />
            Atualizar os dados
          </button>
          {refreshing && <Loader2 className="h-4 w-4 animate-spin text-black/30" />}
        </div>
      </div>
    );
  }

  // ---- Formulário ----
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A9834F]">
          Os vossos dados de acesso
        </h2>
        {receipt && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="text-[12px] font-medium text-black/45 transition hover:text-black/70"
          >
            Cancelar
          </button>
        )}
      </div>

      {receipt && (
        <p className="mb-4 rounded-xl border border-[#783DF5]/15 bg-[#783DF5]/[0.04] px-4 py-3 text-[12.5px] leading-relaxed text-black/60">
          Os dados que enviar agora substituem os que enviou a{" "}
          {formatDate(receipt.submittedAt)}. Por segurança, não mostramos os
          anteriores.
        </p>
      )}

      {/* Modo */}
      <div
        role="tablist"
        aria-label="Como nos vai dar o acesso"
        className="mb-5 grid grid-cols-1 gap-1 rounded-xl bg-black/[0.04] p-1 sm:grid-cols-2"
      >
        {(
          [
            { id: "credentials", label: "Tenho os dados de acesso", Icon: KeyRound },
            { id: "third-party", label: "É gerido por outra empresa", Icon: Users },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setMode(id);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all duration-200 ${
                active
                  ? "bg-white text-[#783DF5] shadow-sm"
                  : "text-black/50 hover:text-black/75"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {mode === "credentials" ? (
        <div className="space-y-5">
          {entries.map((e, i) => (
            <fieldset
              key={i}
              className={
                entries.length > 1
                  ? "rounded-xl border border-black/8 bg-[#fcfbf8] p-4"
                  : ""
              }
            >
              {entries.length > 1 && (
                <legend className="sr-only">Acesso {i + 1}</legend>
              )}
              {entries.length > 1 && (
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-black/60">
                    Acesso {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEntries((list) => list.filter((_, j) => j !== i))
                    }
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-black/40 transition hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                    Remover
                  </button>
                </div>
              )}
              <div className="space-y-4">
                <ProviderField
                  value={e.provider}
                  onChange={(v) => patch(i, { provider: v })}
                  providers={providers}
                  required
                />
                <Labeled label="Link de acesso (área de cliente)" required>
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={e.url}
                    onChange={(ev) => patch(i, { url: ev.target.value })}
                    placeholder="https://… — a página onde costuma fazer login"
                    className={inputCls}
                  />
                </Labeled>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Labeled label="Utilizador ou email" required>
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={e.username}
                      onChange={(ev) => patch(i, { username: ev.target.value })}
                      className={inputCls}
                    />
                  </Labeled>
                  <Labeled label="Password" required>
                    <PasswordInput
                      value={e.password}
                      onChange={(v) => patch(i, { password: v })}
                    />
                  </Labeled>
                </div>
                <Labeled label="Notas (opcional)">
                  <textarea
                    value={e.notes}
                    onChange={(ev) => patch(i, { notes: ev.target.value })}
                    rows={2}
                    placeholder="Ex.: o código de verificação chega ao telemóvel de… / o domínio está noutra conta"
                    className={`${inputCls} resize-y`}
                  />
                </Labeled>
              </div>
            </fieldset>
          ))}

          {entries.length < MAX_ENTRIES && (
            <button
              type="button"
              onClick={() => setEntries((list) => [...list, { ...EMPTY }])}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 px-4 py-3 text-[13px] font-medium text-black/50 transition hover:border-[#783DF5]/40 hover:bg-[#783DF5]/[0.03] hover:text-[#783DF5]"
            >
              <Plus className="h-4 w-4" />
              Adicionar outro acesso
              <span className="hidden font-normal text-black/35 sm:inline">
                — ex.: o domínio está num fornecedor e o site noutro
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ProviderField
            value={tpProvider}
            onChange={setTpProvider}
            providers={providers}
            hint="Se souberem"
          />
          <Labeled label="Quem gere o vosso site / alojamento?" required>
            <textarea
              value={tpContact}
              onChange={(ev) => setTpContact(ev.target.value)}
              rows={3}
              placeholder="Nome, empresa, email e/ou telefone — nós tratamos do pedido de acesso diretamente com eles."
              className={`${inputCls} resize-y`}
            />
          </Labeled>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4 border-t border-black/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-black/45 sm:max-w-sm">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Os dados seguem por ligação segura e ficam guardados de forma privada —
          só a equipa da Wonder Ads lhes tem acesso.
        </p>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit || saving}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
          style={{ background: BRAND_GRADIENT }}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" strokeWidth={3} />
          )}
          Enviar acessos
        </button>
      </div>
      {error && <p className="mt-3 text-[12.5px] text-rose-600">{error}</p>}
    </div>
  );
}

function Labeled({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[12.5px] font-semibold text-black/70">
        {label}
        {required && <span className="text-[#C535C9]">*</span>}
        {hint && <span className="font-normal text-black/35">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function ProviderField({
  value,
  onChange,
  providers,
  required,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  providers: string[];
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <Labeled label="Fornecedor do alojamento" required={required} hint={hint}>
        <input
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex.: dominios.pt"
          className={inputCls}
        />
      </Labeled>
      {providers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {providers.map((p) => {
            const active = value.trim().toLowerCase() === p.toLowerCase();
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-all duration-150 ${
                  active
                    ? "border-[#783DF5]/40 bg-[#783DF5]/10 text-[#783DF5]"
                    : "border-black/10 bg-white text-black/55 hover:border-[#783DF5]/30 hover:text-[#783DF5]"
                }`}
              >
                {active && <Check className="-ml-0.5 mr-1 inline h-3 w-3" strokeWidth={3} />}
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <input
        type={revealed ? "text" : "password"}
        autoComplete="new-password"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} pr-11`}
      />
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? "Esconder password" : "Mostrar password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-black/35 transition hover:bg-black/[0.04] hover:text-black/65"
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
