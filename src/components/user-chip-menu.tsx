"use client";

// Client-side bit of the header user chip: handles the hover/click
// menu + the logout call. Split out from <UserChip> so the chip's
// cookie read happens server-side without forcing the menu's "use
// client" boundary all the way up the tree.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarOff,
  ChevronDown,
  ChevronRight,
  Eye,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Medal,
  MessageCircle,
  Search,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ImpersonationTarget = {
  username: string;
  name: string;
  role: string;
  dept: string;
  isAdmin: boolean;
  /** Etiquetas só de apresentação («Formador»). */
  tags?: string[];
  /** Retrato de public/team/avatar, ou null → inicial. */
  avatar?: string | null;
};

/** «Número do dia» do consultor SEO visto — já resolvido no servidor, para
 *  este ficheiro não ter de tocar nas credenciais. */
export type DailyNumberView = {
  number: number;
  /** Hex sem alfa; fundo, contorno e brilho do azulejo derivam daqui. */
  hex: string;
  /** «verde», «azul»… — para o aria-label. */
  label: string;
  /** «quinta-feira, 10/09/2026» — para o tooltip. */
  day: string;
};

/** Azulejo de 22 px com o número do dia. Cores em estilo inline: vêm de
 *  uma tabela, e o Tailwind só gera as classes que vê escritas no código. */
function NumberTile({ number, hex }: { number: number; hex: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-[7px] border px-1 text-[12px] font-extrabold leading-none tabular-nums"
      style={{
        color: hex,
        backgroundColor: `${hex}1F`,
        borderColor: `${hex}73`,
        boxShadow: `inset 0 1px 0 ${hex}40, 0 2px 10px -3px ${hex}8C`,
      }}
    >
      {number}
    </span>
  );
}

/** Círculo com o retrato da pessoa (3:4, cabeça no topo → object-top) e
 *  fallback para a inicial quando não há foto. */
function AvatarCircle({
  avatar,
  name,
  className,
  ring = "brand-gradient-bg",
  children,
}: {
  avatar: string | null | undefined;
  name: string;
  className: string;
  ring?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${ring} ${className}`}
    >
      {children ??
        (avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          name.trim().charAt(0).toUpperCase()
        ))}
    </span>
  );
}

/** Etiqueta só de apresentação («Formador») — texto com um capelo, sem
 *  caixa: um chip dentro do chip ficava pesado. Não dá acesso a nada. */
function TagText({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 font-semibold ${className}`}>
      <GraduationCap className="h-3 w-3 text-fuchsia-300/90" aria-hidden />
      <span className="bg-[linear-gradient(90deg,#c4b5fd,#f0abfc)] bg-clip-text text-transparent">
        {label}
      </span>
    </span>
  );
}

/** «SEO Consultant» + departamento só quando o cargo ainda não o diz —
 *  nada de «SEO Consultant · SEO». */
function roleWithDept(role: string, dept: string): string {
  if (!dept || role.toLowerCase().includes(dept.toLowerCase())) return role;
  return `${role} · ${dept === "All" ? "Todos os departamentos" : dept}`;
}

function Dot() {
  return <span aria-hidden className="h-[3px] w-[3px] shrink-0 rounded-full bg-white/25" />;
}

export function UserChipMenu({
  name,
  avatar = null,
  role,
  tags = [],
  dept,
  isAdmin = false,
  isViewer = false,
  canWeeklyReports = false,
  expiresLabel,
  sessionLeft = 1,
  canImpersonate = false,
  realName,
  viewingAs = null,
  dailyNumber = null,
  people = [],
}: {
  name: string;
  /** Retrato da pessoa VISTA (segue a lente, como o nome). */
  avatar?: string | null;
  role: string;
  /** Etiquetas só de apresentação, ao lado do cargo («Formador»). */
  tags?: string[];
  dept: string;
  /** SuperAdmin (Andre / Alex / Alice) — vê a área de Superadmin da Formação. */
  isAdmin?: boolean;
  /** Perfil viewer (só leitura, um departamento) — o menu fica só com o
   *  logout: Tools, Medalhas, Ausências e Formação estão fechadas a ele. */
  isViewer?: boolean;
  /** Quem edita SEO vê o estúdio de Weekly Reports no menu. */
  canWeeklyReports?: boolean;
  /** «6 dias» / «20 h» — o servidor escolhe a unidade. */
  expiresLabel: string;
  /** Fração da sessão que ainda falta (0–1) — a barrinha do menu. */
  sessionLeft?: number;
  /** Quem FEZ LOGIN é SuperAdmin — só esses veem o «Ver como». */
  canImpersonate?: boolean;
  /** Nome de quem fez login (≠ `name` quando há lente ativa). */
  realName?: string;
  /** Username que está a ser visto, ou null. */
  viewingAs?: string | null;
  /** «Número do dia» — só consultores SEO em dias úteis; null esconde. */
  dailyNumber?: DailyNumberView | null;
  people?: ImpersonationTarget[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPicking(false);
  }, []);

  // Fecha com um clique fora ou com Esc (e devolve o foco ao chip).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  /** Setas ↑/↓ (e Home/End) andam pelos itens do menu. */
  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    if ((e.target as HTMLElement).tagName === "INPUT" && (e.key === "Home" || e.key === "End")) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : e.key === "ArrowDown" ? (i + 1) % items.length
      : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }
  const [loggingOut, setLoggingOut] = useState(false);
  const [picking, setPicking] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  /** Uma troca de pele muda o que TODAS as páginas servem, e metade delas
   *  são componentes de servidor com cache. Um router.refresh() deixaria
   *  restos da vista anterior misturados com a nova — por isso recarrega-se
   *  a página inteira, como no logout. */
  async function viewAs(username: string | null) {
    setSwitching(username ?? "__self__");
    try {
      const res = await fetch("/api/auth/impersonate", {
        method: username ? "POST" : "DELETE",
        ...(username
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ username }),
            }
          : {}),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.location.reload();
    } catch {
      setSwitching(null);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
    } catch {
      /* fall through — the cookie has maxAge=0 either way */
    }
    // Hard navigation so middleware sees the cleared cookie and
    // shows the gate cleanly.
    window.location.href = "/login";
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group relative inline-flex h-9 items-center gap-2.5 rounded-full border py-0 pl-1 pr-2.5 transition-all duration-300 ${
          viewingAs
            ? "border-amber-400/50 bg-amber-500/[0.06] text-white hover:border-amber-400/80 hover:bg-amber-500/[0.1]"
            : `bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-[#783DF5]/45 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-14px_rgba(120,61,245,0.8)] ${
                open ? "border-[#783DF5]/50" : "border-white/10"
              }`
        }`}
      >
        {/* Anel com o gradiente da marca à volta do retrato (âmbar a ver
            como outra pessoa). */}
        <span
          className={`shrink-0 rounded-full p-[1.5px] transition-transform duration-300 group-hover:scale-105 ${
            viewingAs ? "bg-amber-400" : "brand-gradient-bg"
          }`}
        >
          <AvatarCircle
            avatar={avatar}
            name={name}
            className="h-7 w-7 text-[11px] ring-2 ring-[#0b0b12]"
            ring={viewingAs && !avatar ? "bg-amber-500" : "brand-gradient-bg"}
          >
            {/* Com lente ativa e sem retrato, o olho continua a ser o sinal;
                com retrato, o anel âmbar assume esse papel e a cara fica. */}
            {viewingAs && !avatar ? <Eye className="h-3 w-3" /> : undefined}
          </AvatarCircle>
        </span>
        <span className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
          <span className="truncate text-[12.5px] font-semibold tracking-tight">{name}</span>
          <span className="mt-px flex items-center gap-1.5 text-[10px] text-white/45">
            <span className="truncate">{role}</span>
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Dot />
                <TagText label={t} />
              </span>
            ))}
          </span>
        </span>
        {/* «Número do dia» — dentro do chip, entre o cargo e a seta, com um
            separador fino para ler como parte da identidade e não como um
            botão à parte. Só o número: o painel com a roda toda no menu
            (v77.22) saiu a pedido do André. */}
        {dailyNumber && (
          <span
            role="img"
            aria-label={`Número do dia: ${dailyNumber.number} (${dailyNumber.label})`}
            title={`Número do dia · ${dailyNumber.day}`}
            className="inline-flex items-center gap-2.5"
          >
            <span aria-hidden className="hidden h-5 w-px bg-white/10 sm:block" />
            <NumberTile number={dailyNumber.number} hex={dailyNumber.hex} />
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-white/45 transition duration-300 group-hover:text-white/80 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Menu da conta"
          onKeyDown={onMenuKeyDown}
          className="chip-menu-in absolute right-0 top-full z-40 mt-2.5 w-[19rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b12]/95 shadow-[0_24px_70px_-16px_rgba(0,0,0,0.85),0_0_0_1px_rgba(120,61,245,0.08)] backdrop-blur-xl"
        >
          <div className="relative overflow-hidden border-b border-white/8 px-4 pb-3.5 pt-4">
            {/* Brilho da marca por trás da identidade. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-14 left-1/2 h-28 w-56 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(120,61,245,0.35),transparent)] blur-2xl"
            />
            <div className="relative flex items-center gap-3">
              <span className={`shrink-0 rounded-full p-[2px] ${viewingAs ? "bg-amber-400" : "brand-gradient-bg"}`}>
                <AvatarCircle
                  avatar={avatar}
                  name={name}
                  className="h-11 w-11 text-[15px] ring-2 ring-[#0b0b12]"
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight text-white">{name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-white/55">
                  <span>{roleWithDept(role, dept)}</span>
                  {tags.map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <Dot />
                      <TagText label={t} />
                    </span>
                  ))}
                </p>
              </div>
            </div>
            {viewingAs ? (
              <p className="relative mt-3 flex items-center gap-1.5 text-[10.5px] text-amber-200/85">
                <Eye className="h-3 w-3 shrink-0" />
                A ver como esta pessoa · sessão de {realName}
              </p>
            ) : (
              <div className="relative mt-3.5">
                <div className="flex items-center justify-between text-[10.5px] text-white/40">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    Sessão ativa
                  </span>
                  <span>termina daqui a ~{expiresLabel}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="brand-gradient-bg h-full rounded-full"
                    style={{ width: `${Math.max(4, Math.round(Math.min(1, sessionLeft) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Voltar a mim — primeiro, quando há lente ativa: é a coisa que se
              procura com mais pressa. */}
          {viewingAs && (
            <div className="border-b border-white/8 p-2">
              <button
                type="button"
                role="menuitem"
                onClick={() => viewAs(null)}
                disabled={switching !== null}
                className="chip-item-in flex w-full items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2.5 text-left transition hover:bg-amber-500/[0.16] focus-visible:bg-amber-500/[0.16] focus-visible:outline-none disabled:opacity-60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-200">
                  {switching === "__self__" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowLeft className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-amber-100">Voltar a ser {realName}</span>
                  <span className="block text-[10.5px] text-amber-100/55">Sair da vista só de leitura</span>
                </span>
              </button>
            </div>
          )}

          <div className="max-h-[min(70vh,34rem)] overflow-y-auto">
            {!isViewer && (
              <MenuSection label="Atalhos">
                {/* Tools em 1.º lugar a pedido do André — é o item do menu
                    que se abre mais vezes. Para toda a gente com sessão: a
                    página é de leitura e só o SuperAdmin edita. */}
                <MenuLink href="/tools" icon={KeyRound} label="Tools" hint="Acessos às ferramentas da agência" index={0} onPick={close} />
                <MenuLink href="/formacao" icon={GraduationCap} label="Formação" hint="Aulas, testes e exames" index={1} onPick={close} />
                <MenuLink href="/medalhas" icon={Medal} label="Medalhas" hint="A tua galeria e as três do topo" index={2} onPick={close} />
                {/* Weekly Reports — trabalho semanal sobre a carteira toda,
                    não uma ação de um cliente. Só para quem edita SEO; a
                    página volta a verificar no servidor. */}
                {canWeeklyReports && (
                  <MenuLink href="/seo/weekly-reports" icon={MessageCircle} label="Weekly Reports" hint="Mensagens semanais aos clientes" index={3} onPick={close} />
                )}
              </MenuSection>
            )}

            {!isViewer && (
              <MenuSection label="Pessoal">
                {/* Pedir Ausência — a folha de RH e o histórico dos próprios
                    pedidos vivem em /ausencias. */}
                <MenuLink href="/ausencias" icon={CalendarOff} label="Pedir Ausência" hint="Férias, consultas e outras ausências" index={4} onPick={close} />
              </MenuSection>
            )}

            {(canImpersonate || isAdmin) && (
              <MenuSection label="SuperAdmin" tone="amber">
                {/* Ver como — só para quem fez login como SuperAdmin. */}
                {canImpersonate && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      aria-expanded={picking}
                      onClick={() => setPicking((v) => !v)}
                      style={{ animationDelay: "150ms" }}
                      className="chip-item-in group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-amber-500/[0.08] focus-visible:bg-amber-500/[0.1] focus-visible:outline-none"
                    >
                      <IconTile icon={Users} tone="amber" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium text-amber-100/90">Ver como…</span>
                        <span className="block truncate text-[10.5px] text-white/40">Abrir a app como outra pessoa, só a ver</span>
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition ${picking ? "rotate-180" : ""}`} />
                    </button>
                    {picking && (
                      <PeoplePicker
                        people={people}
                        viewingAs={viewingAs}
                        switching={switching}
                        onPick={(u) => viewAs(u)}
                      />
                    )}
                  </>
                )}
                {/* Registar Falta — só o C-Level. O gate verdadeiro é o
                    layout de /admin (isAdmin) e a API volta a verificar. */}
                {isAdmin && (
                  <MenuLink href="/admin/faltas" icon={UserMinus} label="Registar Falta" hint="Faltas da equipa (RH)" tone="amber" index={6} onPick={close} />
                )}
                {isAdmin && (
                  <MenuLink href="/formacao/admin" icon={LayoutDashboard} label="Formação — Superadmin" hint="Inscrições, conteúdos e resultados" tone="amber" index={7} onPick={close} />
                )}
              </MenuSection>
            )}
          </div>

          <div className="border-t border-white/8 p-2">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={loggingOut}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-medium text-rose-200/90 transition hover:bg-rose-500/10 hover:text-rose-100 focus-visible:bg-rose-500/10 focus-visible:outline-none disabled:opacity-60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 transition group-hover:bg-rose-500/20">
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </span>
              {loggingOut ? "A terminar a sessão…" : "Terminar sessão"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Peças do menu ───────────────────────────────────────────────────────

function MenuSection({
  label,
  tone = "default",
  children,
}: {
  label: string;
  tone?: "default" | "amber";
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.06] px-2 pb-2 pt-2.5 last:border-b-0">
      <p
        className={`px-2.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.2em] ${
          tone === "amber" ? "text-amber-300/60" : "text-white/30"
        }`}
      >
        {label}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function IconTile({ icon: Icon, tone = "default" }: { icon: LucideIcon; tone?: "default" | "amber" }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition duration-300 group-hover:scale-105 ${
        tone === "amber"
          ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-300 group-hover:bg-amber-400/15"
          : "border-white/[0.08] bg-white/[0.04] text-[#a78bfa] group-hover:border-[#783DF5]/40 group-hover:bg-[#783DF5]/15 group-hover:text-violet-200"
      }`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function MenuLink({
  href,
  icon,
  label,
  hint,
  tone = "default",
  index,
  onPick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  tone?: "default" | "amber";
  index: number;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onPick}
      style={{ animationDelay: `${40 + index * 25}ms` }}
      className={`chip-item-in group flex items-center gap-3 rounded-xl px-2.5 py-2 transition focus-visible:outline-none ${
        tone === "amber"
          ? "hover:bg-amber-500/[0.08] focus-visible:bg-amber-500/[0.1]"
          : "hover:bg-white/[0.05] focus-visible:bg-white/[0.07]"
      }`}
    >
      <IconTile icon={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[12.5px] font-medium ${tone === "amber" ? "text-amber-100/90" : "text-white/85 group-hover:text-white"}`}>
          {label}
        </span>
        <span className="block truncate text-[10.5px] text-white/40">{hint}</span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 -translate-x-1 text-white/30 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
    </Link>
  );
}

/** A lista do «Ver como», com pesquisa quando a equipa é grande. */
function PeoplePicker({
  people,
  viewingAs,
  switching,
  onPick,
}: {
  people: ImpersonationTarget[];
  viewingAs: string | null;
  switching: string | null;
  onPick: (username: string) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = needle
    ? people.filter((p) => `${p.name} ${p.role} ${p.dept}`.toLowerCase().includes(needle))
    : people;
  return (
    <div className="chip-item-in mx-1 mb-1 mt-1 overflow-hidden rounded-xl border border-white/[0.07] bg-black/30">
      {people.length > 6 && (
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-white/35" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar pessoa…"
            className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-white/30"
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto py-1">
        {list.map((p) => {
          const active = p.username === viewingAs;
          return (
            <button
              key={p.username}
              type="button"
              role="menuitem"
              onClick={() => !active && onPick(p.username)}
              disabled={switching !== null || active}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition focus-visible:outline-none disabled:cursor-default ${
                active ? "bg-amber-500/[0.12]" : "hover:bg-white/[0.06] focus-visible:bg-white/[0.08] disabled:opacity-60"
              }`}
            >
              <AvatarCircle
                avatar={p.avatar}
                name={p.name}
                className={`h-7 w-7 text-[10px] ${active ? "ring-2 ring-amber-400/80" : ""}`}
                ring={active && !p.avatar ? "bg-amber-500" : "brand-gradient-bg"}
              >
                {switching === p.username ? <Loader2 className="h-3 w-3 animate-spin" /> : undefined}
              </AvatarCircle>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-white/85">{p.name}</span>
                <span className="flex items-center gap-1.5 truncate text-[10px] text-white/40">
                  <span className="truncate">{roleWithDept(p.role, p.dept)}</span>
                  {p.tags?.map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <Dot />
                      <TagText label={t} className="text-[10px]" />
                    </span>
                  ))}
                </span>
              </span>
              {active && <Eye className="h-3 w-3 shrink-0 text-amber-300" />}
            </button>
          );
        })}
        {list.length === 0 && <p className="px-3 py-3 text-center text-[11px] text-white/35">Ninguém com esse nome.</p>}
      </div>
    </div>
  );
}
