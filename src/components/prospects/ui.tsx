"use client";

// Peças pequenas da Ficha do prospect (v80.0): cartões, cabeçalhos de secção,
// retratos, tempo relativo, texto com links e o contexto partilhado (a ficha,
// quem está a ver, o envio de operações e a guarda de edições por gravar).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import type { ProspectFile } from "@/lib/prospects/shared";
import type { ProspectOp } from "@/lib/prospects/ops";
import { formatDate } from "@/lib/dates";

// ── Contexto ────────────────────────────────────────────────────────────

export type PersonView = { name: string; avatar: string | null; role: string };

export type ProspectViewer = {
  username: string;
  name: string;
  canWrite: boolean;
  isAdmin: boolean;
  impersonating: boolean;
};

export type ProspectCtxValue = {
  slug: string;
  file: ProspectFile;
  viewer: ProspectViewer;
  people: Record<string, PersonView>;
  /** Envia uma operação; true quando gravou. O erro aparece no aviso. */
  send: (op: ProspectOp) => Promise<boolean>;
  /** Marca/desmarca um editor com alterações por gravar (aviso ao sair). */
  setDirty: (key: string, dirty: boolean) => void;
  now: number;
};

export const ProspectCtx = createContext<ProspectCtxValue | null>(null);

export function useProspect(): ProspectCtxValue {
  const v = useContext(ProspectCtx);
  if (!v) throw new Error("useProspect fora da ficha");
  return v;
}

export function personOf(people: Record<string, PersonView>, username: string | null | undefined): PersonView {
  if (!username) return { name: "—", avatar: null, role: "" };
  return people[username] ?? { name: username, avatar: null, role: "" };
}

/** Editor com alterações por gravar → avisa ao sair da página. */
export function useDirtyFlag(key: string, dirty: boolean) {
  const { setDirty } = useProspect();
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [key, dirty, setDirty]);
}

// ── Tempo ───────────────────────────────────────────────────────────────

/** «agora», «há 5 min», «há 2 h», «ontem», «há 3 dias», senão a data. */
export function relTime(ms: number, now: number): string {
  if (!ms) return "—";
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return formatDate(ms);
}

// ── Retrato ─────────────────────────────────────────────────────────────

export function Avatar({
  person,
  size = 22,
  ring = false,
}: {
  person: PersonView;
  size?: number;
  ring?: boolean;
}) {
  const initial = person.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] font-semibold text-white ${
        ring ? "ring-2 ring-[#0b0b12]" : ""
      }`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
    >
      {person.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        initial
      )}
    </span>
  );
}

export function PersonChip({ username, size = 20 }: { username: string | null; size?: number }) {
  const { people } = useProspect();
  const p = personOf(people, username);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar person={p} size={size} />
      <span className="truncate">{p.name}</span>
    </span>
  );
}

// ── Cartões e secções ───────────────────────────────────────────────────

export function Card({
  id,
  children,
  className = "",
  tone = "default",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "brand" | "amber";
}) {
  const toneClass =
    tone === "brand"
      ? "border-[#783DF5]/30 bg-[linear-gradient(160deg,rgba(120,61,245,0.10),rgba(255,255,255,0.02)_55%)]"
      : tone === "amber"
        ? "border-amber-400/20 bg-[linear-gradient(160deg,rgba(251,191,36,0.06),rgba(255,255,255,0.015)_60%)]"
        : "border-white/10 bg-white/[0.025]";
  return (
    <section id={id} className={`scroll-mt-24 rounded-2xl border p-5 sm:p-6 ${toneClass} ${className}`}>
      {children}
    </section>
  );
}

export function SectionHead({
  icon: Icon,
  title,
  hint,
  right,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: ReactNode;
  right?: ReactNode;
  tone?: "default" | "brand" | "amber";
}) {
  const tile =
    tone === "brand"
      ? "brand-gradient-bg text-white"
      : tone === "amber"
        ? "border border-amber-400/25 bg-amber-400/10 text-amber-200"
        : "border border-white/10 bg-white/[0.05] text-violet-200";
  return (
    <header className="mb-4 flex items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tile}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[14.5px] font-semibold tracking-tight text-white">{title}</h2>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-white/45">{hint}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
    </header>
  );
}

// ── Botões ──────────────────────────────────────────────────────────────

export function GhostButton({
  onClick,
  children,
  title,
  disabled,
  tone = "default",
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  tone?: "default" | "danger";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === "danger"
          ? "text-rose-200/70 hover:bg-rose-500/10 hover:text-rose-100"
          : "text-white/55 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function EditButton({ onClick, label = "Editar" }: { onClick: () => void; label?: string }) {
  return (
    <GhostButton onClick={onClick} title={label}>
      <Pencil className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </GhostButton>
  );
}

export function PrimaryButton({
  onClick,
  children,
  disabled,
  busy,
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className="brand-gradient-bg inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/** «Apagar?» com Sim/Não no sítio — sem pop-ups (nada de modais por cima
 *  do header, ver o aviso dos overlays). */
export function DeleteButton({
  onConfirm,
  label = "Apagar",
}: {
  onConfirm: () => Promise<unknown> | void;
  label?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <GhostButton tone="danger" onClick={() => setAsking(true)} title={label}>
        <Trash2 className="h-3.5 w-3.5" />
      </GhostButton>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 py-0.5 pl-2 pr-0.5 text-[11px] text-rose-100">
      {label}?
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
          setAsking(false);
        }}
        className="inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold hover:bg-rose-500/25"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="inline-flex items-center rounded-md px-1.5 py-0.5 hover:bg-white/10"
        aria-label="Cancelar"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ── Campos ──────────────────────────────────────────────────────────────

export const inputClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/30 outline-none transition focus:border-[#783DF5]/60 focus:bg-white/[0.06]";

/** Textarea que cresce com o texto. ⌘/Ctrl+Enter grava, Esc cancela. */
export function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows = 4,
  autoFocus,
  onSubmit,
  onCancel,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
  onSubmit?: () => void;
  onCancel?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 640)}px`;
  }, []);
  useEffect(resize, [value, resize]);
  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && onSubmit) {
          e.preventDefault();
          onSubmit();
        } else if (e.key === "Escape" && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
      className={`${inputClass} resize-none leading-relaxed ${className}`}
    />
  );
}

export function KeyHint() {
  return (
    <span className="hidden text-[10.5px] text-white/30 sm:inline">
      <kbd className="rounded border border-white/15 px-1 font-sans">⌘</kbd>
      <kbd className="ml-0.5 rounded border border-white/15 px-1 font-sans">↵</kbd> grava ·{" "}
      <kbd className="rounded border border-white/15 px-1 font-sans">Esc</kbd> cancela
    </span>
  );
}

// ── Texto ───────────────────────────────────────────────────────────────

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function linkify(line: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    out.push(
      <a
        key={`${keyBase}-${i}`}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-violet-200 underline decoration-violet-300/40 underline-offset-2 hover:text-white"
      >
        {m[0]}
      </a>,
    );
    last = i + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Texto das notas: parágrafos, listas com «- » ou «• », links clicáveis. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${k}`} className="my-1.5 space-y-1 pl-1">
        {list.map((item, j) => (
          <li key={j} className="flex gap-2">
            <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-violet-300/70" />
            <span className="min-w-0">{linkify(item, `li-${k}-${j}`)}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  text.split("\n").forEach((line, i) => {
    const bullet = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flush(i);
    if (!line.trim()) {
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      return;
    }
    // «Título:» no início da linha fica a negrito — o guião das notas.
    const head = line.match(/^([^:]{2,40}):(\s.*)?$/);
    blocks.push(
      <p key={`p-${i}`} className="break-words">
        {head ? (
          <>
            <span className="font-semibold text-white">{head[1]}:</span>
            {head[2] ? linkify(head[2], `p-${i}`) : null}
          </>
        ) : (
          linkify(line, `p-${i}`)
        )}
      </p>,
    );
  });
  flush(-1);
  return <div className={`text-[13.5px] leading-relaxed text-white/80 ${className}`}>{blocks}</div>;
}

/** O convite de um campo vazio — clicável para quem escreve. */
export function EmptyHint({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  if (!onClick) {
    return <p className="text-[12.5px] italic text-white/35">{children}</p>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-dashed border-white/12 px-4 py-3.5 text-left text-[12.5px] text-white/40 transition hover:border-[#783DF5]/45 hover:bg-[#783DF5]/[0.05] hover:text-white/70"
    >
      {children}
    </button>
  );
}
