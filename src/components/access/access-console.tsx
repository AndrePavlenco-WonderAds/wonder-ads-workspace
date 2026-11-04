"use client";

// A consola de acessos (v78.72) — só o André. Lista quem entra na app (e
// quem já entrou), e por pessoa: copiar o acesso, gerar uma password nova,
// terminar as sessões abertas, cancelar e reativar.
//
// A password só chega ao browser quando o André abre o cartão de acesso
// (POST «revelar») ou acabou de a gerar; nunca vem no HTML da página.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Ban,
  Check,
  Copy,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  UserX,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  ACCESS_ACTION_LABEL,
  ACCESS_LOGIN_URL,
  accessMessage,
  type AccessAction,
  type AccessLogEvent,
  type AccessRowView,
} from "@/lib/access/shared";

type Tab = "ativos" | "passados" | "todos";

type Modal =
  | { kind: "card"; username: string; password: string | null; loading: boolean; fresh: null | { endedSessions: boolean } }
  | { kind: "regenerar" | "cancelar" | "reativar" | "terminar-sessoes"; username: string; busy: boolean; endSessions: boolean };

type Toast = { id: number; text: string; tone: "ok" | "erro" };

const DEPT_LABEL: Record<string, string> = {
  All: "Direção",
  SEO: "SEO",
  ADS: "ADS",
  Web: "Web",
  Commercial: "Comercial",
};
const DEPT_ORDER = ["All", "SEO", "ADS", "Web", "Commercial"];
const DAY = 24 * 60 * 60 * 1000;

function relative(ms: number | null, now: number): string {
  if (!ms) return "";
  const diff = Math.max(0, now - ms);
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  return formatDate(ms);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/admin/acessos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || "Não foi possível guardar. Tenta outra vez.");
  return json;
}

// ---------------------------------------------------------------------------

export function AccessConsole({
  initialRows,
  initialEvents,
  configured,
}: {
  initialRows: AccessRowView[];
  initialEvents: AccessLogEvent[];
  configured: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [events, setEvents] = useState(initialEvents);
  const [tab, setTab] = useState<Tab>("ativos");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // «/» salta para a pesquisa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "/" && !modal && el?.tagName !== "INPUT" && el?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const byUser = useMemo(() => new Map(rows.map((r) => [r.username, r])), [rows]);
  const active = rows.filter((r) => r.status === "ativo");
  const past = rows.filter((r) => r.status !== "ativo");
  const inVault = active.filter((r) => r.vaultSetAt).length;
  const recent = active.filter((r) => r.lastLoginAt && now - r.lastLoginAt < 7 * DAY).length;

  const visible = useMemo(() => {
    const q = query
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    return rows.filter((r) => {
      if (tab === "ativos" && r.status !== "ativo") return false;
      if (tab === "passados" && r.status === "ativo") return false;
      if (!q) return true;
      const hay = `${r.name} ${r.fullName} ${r.username} ${r.role} ${DEPT_LABEL[r.dept] ?? r.dept}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, tab, query]);

  const groups = useMemo(() => {
    const map = new Map<string, AccessRowView[]>();
    for (const r of visible) {
      const k = DEPT_ORDER.includes(r.dept) ? r.dept : "Outros";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...DEPT_ORDER, "Outros"].filter((k) => map.has(k)).map((k) => ({ key: k, rows: map.get(k)! }));
  }, [visible]);

  const replaceRow = (row: AccessRowView) => setRows((rs) => rs.map((r) => (r.username === row.username ? row : r)));

  // ---- ações ----

  const openCard = useCallback(
    async (username: string) => {
      setModal({ kind: "card", username, password: null, loading: true, fresh: null });
      try {
        const { password } = await post<{ password: string | null }>({ action: "revelar", username });
        setModal((m) => (m && m.kind === "card" && m.username === username ? { ...m, password, loading: false } : m));
      } catch (err) {
        setModal(null);
        toast((err as Error).message, "erro");
      }
    },
    [toast],
  );

  const confirm = useCallback(
    async (m: Extract<Modal, { busy: boolean }>) => {
      setModal({ ...m, busy: true });
      try {
        const res = await post<{ row: AccessRowView; event: AccessLogEvent; password?: string }>({
          action: m.kind,
          username: m.username,
          endSessions: m.endSessions,
        });
        replaceRow(res.row);
        setEvents((e) => [res.event, ...e]);
        const first = res.row.name;
        if (m.kind === "regenerar") {
          setModal({
            kind: "card",
            username: m.username,
            password: res.password ?? null,
            loading: false,
            fresh: { endedSessions: Boolean(res.event.endedSessions) },
          });
          return;
        }
        setModal(null);
        toast(
          m.kind === "cancelar"
            ? `Acesso de ${first} cancelado`
            : m.kind === "reativar"
              ? `${first} pode voltar a entrar`
              : `Sessões de ${first} terminadas`,
        );
      } catch (err) {
        setModal({ ...m, busy: false });
        toast((err as Error).message, "erro");
      }
    },
    [toast],
  );

  const ask = (kind: Extract<Modal, { busy: boolean }>["kind"], username: string) =>
    setModal({ kind, username, busy: false, endSessions: true });

  const modalRow = modal ? byUser.get(modal.username) ?? null : null;

  return (
    <>
      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout flex items-center gap-1.5 text-amber-200/60">
            <LockKeyhole className="h-3 w-3" />
            SuperAdmin · só o COO
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Acessos à app</span>
          </h1>
          <p className="mt-1.5 max-w-[660px] text-[12.5px] leading-relaxed text-white/45">
            Quem entra no workspace, quem já entrou e como. Copia o acesso para o enviar, gera uma password nova ou
            fecha a porta a quem já não deve entrar. Aplica-se em segundos, sem deploy.
          </p>
        </div>
      </header>

      {!configured && (
        <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-100">
          O armazenamento (KV) não está configurado neste ambiente: dá para ver a lista, mas não para mudar nada.
        </p>
      )}

      {/* números */}
      <section className="animate-fade-up mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={UserCheck} value={active.length} label="Acessos ativos" tone="text-emerald-300" />
        <Stat icon={UserX} value={past.length} label="Acessos passados" tone={past.length ? "text-rose-300" : "text-white/60"} />
        <Stat
          icon={KeyRound}
          value={inVault}
          suffix={`/ ${active.length}`}
          label="Passwords copiáveis"
          tone="text-[#c3aaff]"
        />
        <Stat icon={Users} value={recent} label="Entraram nos últimos 7 dias" tone="text-sky-300" />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="animate-fade-up min-w-0">
          {/* barra de filtros */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Filtrar acessos" className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
              {(
                [
                  ["ativos", "Ativos", active.length],
                  ["passados", "Passados", past.length],
                  ["todos", "Todos", rows.length],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                    tab === key ? "bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {label}
                  <span className={`tabular rounded-md px-1.5 text-[10.5px] ${tab === key ? "bg-white/10 text-white/80" : "text-white/35"}`}>{n}</span>
                </button>
              ))}
            </div>
            <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[300px]">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/35" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar pessoa, cargo, utilizador…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-8 text-[12.5px] text-white placeholder:text-white/30 focus:border-[#783DF5]/60 focus:outline-none"
              />
              <kbd className="pointer-events-none absolute right-2.5 rounded border border-white/10 px-1.5 text-[10px] text-white/30">/</kbd>
            </label>
          </div>

          {groups.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-white/12 px-5 py-8 text-center text-[12.5px] text-white/45">
              {query ? `Ninguém corresponde a «${query}».` : tab === "passados" ? "Ainda não há acessos passados." : "Sem acessos para mostrar."}
            </p>
          ) : (
            <div className="mt-5 space-y-6">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    {DEPT_LABEL[g.key] ?? g.key}
                    <span className="tabular text-white/25">{g.rows.length}</span>
                  </p>
                  <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                    {g.rows.map((r) => (
                      <AccessRow
                        key={r.username}
                        row={r}
                        now={now}
                        disabled={!configured}
                        onCopy={() => openCard(r.username)}
                        onAsk={(kind) => ask(kind, r.username)}
                        onCopyUser={async () => {
                          toast((await copyText(r.username)) ? `«${r.username}» copiado` : "Não deu para copiar", "ok");
                        }}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="animate-fade-up min-w-0 space-y-4">
          <HistoryPanel events={events} now={now} />
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3.5 text-[11.5px] leading-relaxed text-white/40">
            <p className="flex items-center gap-1.5 font-semibold text-white/55">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/80" />
              Notas
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>As passwords antigas só existem como hash: ninguém as consegue ler. Gera uma nova para a poderes copiar.</li>
              <li>As passwords novas ficam no cofre, cifradas. Só tu as abres, aqui.</li>
              <li>Um cancelamento chega a todas as sessões em até 30 segundos.</li>
              <li>O último login regista-se a partir de 04/11/2026.</li>
            </ul>
          </div>
        </aside>
      </div>

      {modal && modalRow && (
        <Overlay onClose={() => (modal.kind === "card" || !modal.busy ? setModal(null) : undefined)}>
          {modal.kind === "card" ? (
            <AccessCard
              row={modalRow}
              password={modal.password}
              loading={modal.loading}
              fresh={modal.fresh}
              onClose={() => setModal(null)}
              onRegenerate={() => ask("regenerar", modalRow.username)}
              onCopied={(what) => toast(what)}
            />
          ) : (
            <ConfirmAction modal={modal} row={modalRow} onCancel={() => setModal(null)} onConfirm={confirm} onToggle={(v) => setModal({ ...modal, endSessions: v })} />
          )}
        </Overlay>
      )}

      <ToastStack toasts={toasts} />
    </>
  );
}

// ---------------------------------------------------------------------------

function Stat({ icon: Icon, value, suffix, label, tone }: { icon: LucideIcon; value: number; suffix?: string; label: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
      <p className={`text-[26px] font-bold leading-none tabular-nums ${tone}`}>
        {value}
        {suffix && <span className="ml-1 text-[14px] font-semibold text-white/30">{suffix}</span>}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-white/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
    </div>
  );
}

function Avatar({ row, size = 40 }: { row: AccessRowView; size?: number }) {
  const dot =
    row.status === "ativo" ? "bg-emerald-400" : row.status === "cancelado" ? "bg-rose-400" : "bg-white/30";
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      {row.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.avatar}
          alt=""
          className={`h-full w-full rounded-full border border-white/10 object-cover ${row.status === "ativo" ? "" : "grayscale opacity-60"}`}
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.05] font-bold text-white/70 ${row.status === "ativo" ? "" : "opacity-60"}`}
          style={{ fontSize: size * 0.36 }}
        >
          {row.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0d0d14] ${dot}`} />
    </span>
  );
}

function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "amber" | "sky" | "violet" }) {
  const tones = {
    default: "border-white/10 bg-white/[0.04] text-white/55",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    sky: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    violet: "border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[10.5px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  tone = "default",
  disabled,
  title,
  iconOnly,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "primary" | "rose" | "emerald";
  disabled?: boolean;
  title?: string;
  iconOnly?: boolean;
}) {
  const tones = {
    default: "border-white/[0.09] bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.07] hover:text-white",
    primary: "border-[#783DF5]/40 bg-[#783DF5]/15 text-[#ddd0ff] hover:border-[#783DF5]/70 hover:bg-[#783DF5]/25 hover:text-white",
    rose: "border-rose-400/20 bg-rose-500/[0.06] text-rose-200/80 hover:border-rose-400/45 hover:bg-rose-500/15 hover:text-rose-100",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:border-emerald-400/55 hover:bg-emerald-400/20 hover:text-emerald-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? (iconOnly ? label : undefined)}
      aria-label={label}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

function AccessRow({
  row,
  now,
  disabled,
  onCopy,
  onAsk,
  onCopyUser,
}: {
  row: AccessRowView;
  now: number;
  disabled: boolean;
  onCopy: () => void;
  onAsk: (kind: "regenerar" | "cancelar" | "reativar" | "terminar-sessoes") => void;
  onCopyUser: () => void;
}) {
  const dim = row.status !== "ativo";
  return (
    <li className={`group flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition hover:bg-white/[0.02] ${dim ? "bg-black/10" : ""}`}>
      <Avatar row={row} />
      <div className="min-w-0 flex-1 basis-[240px]">
        <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-semibold ${dim ? "text-white/55" : "text-white"}`}>
          {row.fullName}
          {row.isSelf && <Chip tone="violet">tu</Chip>}
          <Chip>{row.role}</Chip>
          {row.isAdmin && <Chip tone="amber">SuperAdmin</Chip>}
          {row.viewerOf && <Chip tone="sky">Só leitura · {row.viewerOf.toUpperCase()}</Chip>}
          {row.tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/40">
          <button
            type="button"
            onClick={onCopyUser}
            title="Copiar o utilizador"
            className="inline-flex items-center gap-1 rounded font-mono text-white/55 transition hover:text-white"
          >
            <User className="h-3 w-3" />
            {row.username}
          </button>
          {row.status === "removido" && row.former ? (
            <span className="text-white/40">
              {formatDate(row.former.from)} → {formatDate(row.former.until)} · {row.former.note}
            </span>
          ) : (
            <>
              {row.status === "cancelado" && row.revokedAt && (
                <span suppressHydrationWarning className="inline-flex items-center gap-1 text-rose-300/80">
                  <Ban className="h-3 w-3" />
                  Cancelado a {formatDateTime(row.revokedAt)}
                </span>
              )}
              <span suppressHydrationWarning title={row.lastLoginAt ? formatDateTime(row.lastLoginAt) : undefined} className="inline-flex items-center gap-1">
                <LogOut className="h-3 w-3 rotate-180" />
                {row.lastLoginAt ? `Último login ${relative(row.lastLoginAt, now)}` : "Sem login registado"}
              </span>
              {row.vaultSetAt ? (
                <span suppressHydrationWarning className="inline-flex items-center gap-1 text-[#c3aaff]/80" title={`Gerada a ${formatDateTime(row.vaultSetAt)}`}>
                  <KeyRound className="h-3 w-3" />
                  No cofre desde {formatDate(row.vaultSetAt)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-white/30" title="Criada antes da consola: só existe como hash">
                  <LockKeyhole className="h-3 w-3" />
                  Password antiga · não copiável
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {row.status === "ativo" && (
          <>
            <ActionButton icon={Copy} label="Copiar acesso" tone="primary" onClick={onCopy} disabled={disabled} />
            <ActionButton icon={RefreshCw} label="Regenerar" onClick={() => onAsk("regenerar")} disabled={disabled} />
            {!row.isSelf && (
              <ActionButton
                icon={LogOut}
                label="Terminar sessões abertas"
                iconOnly
                onClick={() => onAsk("terminar-sessoes")}
                disabled={disabled}
              />
            )}
            <ActionButton
              icon={Ban}
              label="Cancelar"
              tone="rose"
              onClick={() => onAsk("cancelar")}
              disabled={disabled || row.isSelf}
              title={row.isSelf ? "Não podes cancelar o teu próprio acesso" : undefined}
            />
          </>
        )}
        {row.status === "cancelado" && (
          <ActionButton icon={RotateCcw} label="Reativar" tone="emerald" onClick={() => onAsk("reativar")} disabled={disabled} />
        )}
        {row.status === "removido" && (
          <span className="rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/35">Conta apagada do código</span>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

const EVENT_TONE: Record<AccessAction, { icon: LucideIcon; cls: string }> = {
  regenerar: { icon: RefreshCw, cls: "border-[#783DF5]/35 bg-[#783DF5]/15 text-[#c3aaff]" },
  cancelar: { icon: Ban, cls: "border-rose-400/30 bg-rose-500/10 text-rose-300" },
  reativar: { icon: RotateCcw, cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  "terminar-sessoes": { icon: LogOut, cls: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
};

function HistoryPanel({ events, now }: { events: AccessLogEvent[]; now: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? events : events.slice(0, 12);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
        <History className="h-3.5 w-3.5" />
        Histórico
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-white/40">Ainda nada. Cada alteração feita aqui fica registada, com a hora.</p>
      ) : (
        <ol className="relative mt-3 space-y-3 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-white/[0.06]">
          {shown.map((e) => {
            const t = EVENT_TONE[e.action];
            return (
              <li key={e.id} className="relative flex gap-3">
                <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${t.cls}`}>
                  <t.icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[12.5px] leading-snug text-white/80">
                    <span className="font-semibold">{ACCESS_ACTION_LABEL[e.action]}</span>
                    <span className="text-white/45"> · {e.name}</span>
                  </p>
                  <p suppressHydrationWarning className="mt-0.5 text-[11px] text-white/35" title={formatDateTime(e.at)}>
                    {relative(e.at, now)}
                    {e.action === "regenerar" && e.endedSessions ? " · sessões terminadas" : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {events.length > 12 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-[11.5px] font-semibold text-white/45 transition hover:text-white">
          {all ? "Mostrar menos" : `Ver tudo (${events.length})`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="animate-fade-up relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-3xl border border-white/10 bg-[#11111a] shadow-[0_40px_120px_-30px_rgba(120,61,245,0.55)]">
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CopyField({
  icon: Icon,
  label,
  value,
  display,
  mono,
  onCopied,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  display?: ReactNode;
  mono?: boolean;
  onCopied: (what: string) => void;
  trailing?: ReactNode;
}) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-white/35" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">{label}</p>
        <p className={`truncate text-[13.5px] text-white ${mono ? "font-mono tracking-wide" : ""}`}>{display ?? value}</p>
      </div>
      {trailing}
      <button
        type="button"
        onClick={async () => {
          if (await copyText(value)) {
            setDone(true);
            onCopied(`${label} copiado`);
            setTimeout(() => setDone(false), 1600);
          }
        }}
        aria-label={`Copiar ${label.toLowerCase()}`}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
          done ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function AccessCard({
  row,
  password,
  loading,
  fresh,
  onClose,
  onRegenerate,
  onCopied,
}: {
  row: AccessRowView;
  password: string | null;
  loading: boolean;
  fresh: null | { endedSessions: boolean };
  onClose: () => void;
  onRegenerate: () => void;
  onCopied: (what: string) => void;
}) {
  const [show, setShow] = useState(Boolean(fresh));
  const [copied, setCopied] = useState(false);
  const message = accessMessage(row, password);
  const preview = accessMessage(row, password ? "•".repeat(password.length) : null);

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Avatar row={row} size={44} />
        <div className="min-w-0 flex-1">
          <p className="readout text-white/35">Acesso à app</p>
          <p className="truncate text-[17px] font-semibold text-white">{row.fullName}</p>
          <p className="text-[12px] text-white/45">{row.role}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {fresh && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-[12px] leading-relaxed text-emerald-100">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
          <span>
            Password nova gerada: a antiga já não entra.
            {fresh.endedSessions ? " As sessões abertas terminam em até 30 segundos." : ""} Copia e envia já.
          </span>
        </p>
      )}

      <div className="mt-4 space-y-2">
        <CopyField icon={Link2} label="Endereço" value={ACCESS_LOGIN_URL} display={ACCESS_LOGIN_URL.replace("https://", "")} onCopied={onCopied} />
        <CopyField icon={User} label="Utilizador" value={row.username} mono onCopied={onCopied} />
        {loading ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3.5 text-[12.5px] text-white/45">
            <Loader2 className="h-4 w-4 animate-spin" />A abrir o cofre…
          </div>
        ) : password ? (
          <CopyField
            icon={KeyRound}
            label="Password"
            value={password}
            mono
            display={show ? password : "•".repeat(password.length)}
            onCopied={onCopied}
            trailing={
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Esconder a password" : "Mostrar a password"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/5 hover:text-white"
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            }
          />
        ) : (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-3">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-amber-100">
              <LockKeyhole className="h-3.5 w-3.5 text-amber-300" />
              Esta password não está no cofre
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-100/70">
              Foi criada antes da consola e só existe como hash: nem a app a consegue ler. Gera uma nova para a poderes
              copiar e enviar.
            </p>
            <button
              type="button"
              onClick={onRegenerate}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-[12px] font-semibold text-amber-100 transition hover:bg-amber-300/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Gerar password nova
            </button>
          </div>
        )}
      </div>

      {!loading && (
        <>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">A mensagem que vais copiar</p>
          <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/30 px-3.5 py-3 font-sans text-[12px] leading-relaxed text-white/65">
            {preview}
          </pre>
          <button
            type="button"
            onClick={async () => {
              if (await copyText(message)) {
                setCopied(true);
                onCopied(password ? "Mensagem com o acesso copiada" : "Mensagem copiada (sem password)");
                setTimeout(() => setCopied(false), 1800);
              }
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-bold text-white shadow-[0_14px_40px_-14px_rgba(120,61,245,0.8)] transition hover:-translate-y-0.5 hover:brightness-110"
            style={{ background: "var(--brand-gradient)" }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : password ? "Copiar mensagem completa" : "Copiar mensagem sem password"}
          </button>
        </>
      )}
    </div>
  );
}

const CONFIRM_COPY: Record<
  "regenerar" | "cancelar" | "reativar" | "terminar-sessoes",
  { icon: LucideIcon; tone: string; button: string; buttonCls: string; title: (n: string) => string }
> = {
  regenerar: {
    icon: RefreshCw,
    tone: "border-[#783DF5]/35 bg-[#783DF5]/15 text-[#c3aaff]",
    button: "Gerar password",
    buttonCls: "text-white shadow-[0_14px_40px_-14px_rgba(120,61,245,0.8)]",
    title: (n) => `Gerar uma password nova para ${n}?`,
  },
  cancelar: {
    icon: Ban,
    tone: "border-rose-400/35 bg-rose-500/15 text-rose-300",
    button: "Cancelar acesso",
    buttonCls: "bg-rose-500 text-white hover:bg-rose-400",
    title: (n) => `Cancelar o acesso de ${n}?`,
  },
  reativar: {
    icon: RotateCcw,
    tone: "border-emerald-400/35 bg-emerald-400/15 text-emerald-300",
    button: "Reativar acesso",
    buttonCls: "bg-emerald-500 text-white hover:bg-emerald-400",
    title: (n) => `Reativar o acesso de ${n}?`,
  },
  "terminar-sessoes": {
    icon: LogOut,
    tone: "border-amber-400/35 bg-amber-400/15 text-amber-200",
    button: "Terminar sessões",
    buttonCls: "bg-amber-400 text-black hover:bg-amber-300",
    title: (n) => `Terminar as sessões de ${n}?`,
  },
};

function ConfirmAction({
  modal,
  row,
  onCancel,
  onConfirm,
  onToggle,
}: {
  modal: Extract<Modal, { busy: boolean }>;
  row: AccessRowView;
  onCancel: () => void;
  onConfirm: (m: Extract<Modal, { busy: boolean }>) => void;
  onToggle: (v: boolean) => void;
}) {
  const c = CONFIRM_COPY[modal.kind];
  const points: string[] =
    modal.kind === "regenerar"
      ? [
          "A password atual deixa de funcionar logo.",
          "A nova fica no cofre, cifrada: podes copiá-la aqui sempre que precisares.",
        ]
      : modal.kind === "cancelar"
        ? [
            "Deixa de conseguir entrar na app.",
            "As sessões abertas caem em até 30 segundos.",
            "Nada é apagado: tickets, relatórios e histórico ficam como estão.",
            "Podes reativar quando quiseres.",
          ]
        : modal.kind === "reativar"
          ? [
              row.vaultSetAt
                ? "Volta a entrar com a password do cofre (podes copiá-la depois)."
                : "Volta a entrar com a password que tinha.",
              "As sessões de antes do cancelamento continuam fechadas.",
            ]
          : ["Tem de voltar a entrar com a password.", "A conta continua ativa; a password não muda."];

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${c.tone}`}>
          <c.icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold leading-snug text-white">{c.title(row.fullName)}</p>
          <p className="mt-0.5 text-[12px] text-white/45">
            {row.role} · <span className="font-mono">{row.username}</span>
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-white/70">
            <Check className="mt-1 h-3 w-3 shrink-0 text-white/35" />
            {p}
          </li>
        ))}
      </ul>

      {modal.kind === "cancelar" && row.isAdmin && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-[12px] text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          {row.fullName} é SuperAdmin: perde também o acesso ao Control Suite.
        </p>
      )}

      {modal.kind === "regenerar" &&
        (row.isSelf ? (
          <p className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[12px] text-white/55">
            É a tua conta: as tuas sessões ficam abertas. Guarda a password nova antes de fechares o cartão.
          </p>
        ) : (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
            <input
              type="checkbox"
              checked={modal.endSessions}
              onChange={(e) => onToggle(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#783DF5]"
            />
            <span className="text-[12.5px] leading-relaxed text-white/75">
              Terminar também as sessões abertas
              <span className="block text-[11.5px] text-white/40">Tem de voltar a entrar, já com a password nova.</span>
            </span>
          </label>
        ))}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={modal.busy}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-[13px] font-semibold text-white/70 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => onConfirm(modal)}
          disabled={modal.busy}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition disabled:opacity-60 ${c.buttonCls}`}
          style={modal.kind === "regenerar" ? { background: "var(--brand-gradient)" } : undefined}
        >
          {modal.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <c.icon className="h-4 w-4" />}
          {c.button}
        </button>
      </div>
    </div>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || toasts.length === 0) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <p
          key={t.id}
          role="status"
          className={`animate-fade-up inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-semibold shadow-[0_18px_50px_-18px_rgba(0,0,0,0.8)] ${
            t.tone === "ok" ? "border-emerald-400/30 bg-[#0f1a16] text-emerald-100" : "border-rose-400/35 bg-[#1c1015] text-rose-100"
          }`}
        >
          {t.tone === "ok" ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
          {t.text}
        </p>
      ))}
    </div>,
    document.body,
  );
}
