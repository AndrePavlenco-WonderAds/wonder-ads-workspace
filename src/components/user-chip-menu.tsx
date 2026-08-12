"use client";

// Client-side bit of the header user chip: handles the hover/click
// menu + the logout call. Split out from <UserChip> so the chip's
// cookie read happens server-side without forcing the menu's "use
// client" boundary all the way up the tree.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarOff,
  ChevronDown,
  Eye,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  UserCircle2,
  Users,
} from "lucide-react";

export type ImpersonationTarget = {
  username: string;
  name: string;
  role: string;
  dept: string;
  isAdmin: boolean;
};

export function UserChipMenu({
  name,
  role,
  dept,
  isAdmin = false,
  expiresLabel,
  canImpersonate = false,
  realName,
  viewingAs = null,
  people = [],
}: {
  name: string;
  role: string;
  dept: string;
  /** SuperAdmin (Andre / Alex / Alice) — vê a área de Superadmin da Formação. */
  isAdmin?: boolean;
  /** Pre-formatted "X days" / "Yh" — server picks the granularity. */
  expiresLabel: string;
  /** Quem FEZ LOGIN é SuperAdmin — só esses veem o «Ver como». */
  canImpersonate?: boolean;
  /** Nome de quem fez login (≠ `name` quando há lente ativa). */
  realName?: string;
  /** Username que está a ser visto, ou null. */
  viewingAs?: string | null;
  people?: ImpersonationTarget[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group inline-flex items-center gap-2 rounded-full border bg-white/[0.04] px-2 py-1 pr-2.5 text-[11.5px] font-medium transition ${
          viewingAs
            ? "border-amber-400/50 text-white hover:border-amber-400/80 hover:bg-amber-500/[0.1]"
            : "border-white/12 text-white/85 hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.08] hover:text-white"
        }`}
      >
        <span
          aria-hidden
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${
            viewingAs
              ? "bg-amber-500 shadow-[0_4px_14px_-4px_rgba(245,158,11,0.6)]"
              : "brand-gradient-bg shadow-[0_4px_14px_-4px_rgba(120,61,245,0.6)]"
          }`}
        >
          {viewingAs ? <Eye className="h-3 w-3" /> : initial}
        </span>
        <span className="hidden flex-col text-left leading-tight sm:flex">
          <span>{name}</span>
          <span className="text-[9.5px] font-normal text-white/45">
            {role}
          </span>
        </span>
        <ChevronDown
          className={`h-3 w-3 text-white/55 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-white/12 bg-[color:var(--background)]/95 shadow-[0_18px_60px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md"
        >
          <div className="border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-[color:var(--brand-purple)]" />
              <div>
                <p className="text-sm font-semibold text-white">{name}</p>
                <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                  {role} · {dept}
                </p>
              </div>
            </div>
            {viewingAs ? (
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-amber-200/85">
                <Eye className="h-3 w-3 shrink-0" />
                A ver como esta pessoa · sessão de {realName}
              </p>
            ) : (
              <p className="mt-2 text-[10.5px] text-white/45">
                Session expires in ~{expiresLabel}
              </p>
            )}
          </div>

          {/* Voltar a mim — primeiro item quando há lente ativa, porque é a
              coisa que se procura com mais pressa. */}
          {viewingAs && (
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => viewAs(null)}
              disabled={switching !== null}
              className="flex w-full items-center gap-2 border-b border-white/8 bg-amber-500/[0.06] px-4 py-2.5 text-left text-[12px] font-semibold text-amber-100 transition hover:bg-amber-500/[0.14] disabled:opacity-60"
            >
              {switching === "__self__" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowLeft className="h-3.5 w-3.5" />
              )}
              Voltar a ser {realName}
            </button>
          )}

          {/* Ver como — só para quem fez login como SuperAdmin. Dois cliques
              até à lista, três até estar na pele de alguém. */}
          {canImpersonate && (
            <>
              <button
                type="button"
                role="menuitem"
                aria-expanded={picking}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPicking((v) => !v)}
                className="flex w-full items-center gap-2 border-b border-white/8 px-4 py-2.5 text-left text-[12px] font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Users className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
                Ver como…
                <ChevronDown
                  className={`ml-auto h-3 w-3 text-white/45 transition ${picking ? "rotate-180" : ""}`}
                />
              </button>
              {picking && (
                <div className="max-h-64 overflow-y-auto border-b border-white/8 bg-black/25 py-1">
                  {people.map((p) => {
                    const active = p.username === viewingAs;
                    return (
                      <button
                        key={p.username}
                        type="button"
                        role="menuitem"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => !active && viewAs(p.username)}
                        disabled={switching !== null || active}
                        className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition disabled:cursor-default ${
                          active
                            ? "bg-amber-500/[0.12]"
                            : "hover:bg-white/[0.06] disabled:opacity-60"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white ${
                            active ? "bg-amber-500" : "brand-gradient-bg"
                          }`}
                        >
                          {switching === p.username ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            p.name.trim().charAt(0).toUpperCase()
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-white/85">
                            {p.name}
                          </span>
                          <span className="block truncate text-[10px] text-white/40">
                            {p.role} · {p.dept}
                          </span>
                        </span>
                        {active && (
                          <Eye className="h-3 w-3 shrink-0 text-amber-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {/* Pedir Ausência — para TODA a gente com sessão: a folha de RH e
              o histórico dos próprios pedidos vivem em /ausencias. */}
          <Link
            href="/ausencias"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            className="flex w-full items-center gap-2 border-b border-white/8 px-4 py-2.5 text-left text-[12px] font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
          >
            <CalendarOff className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
            Pedir Ausência
          </Link>
          {/* Formação — visível a toda a gente com sessão. A área de
              Superadmin só aparece aos SuperAdmins; a rota está protegida no
              servidor de qualquer forma (o layout de /formacao/admin verifica
              isAdmin, e cada rota da API volta a verificar). */}
          <Link
            href="/formacao"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            className="flex w-full items-center gap-2 border-b border-white/8 px-4 py-2.5 text-left text-[12px] font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
          >
            <GraduationCap className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
            Formação
          </Link>
          {isAdmin && (
            <Link
              href="/formacao/admin"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              className="flex w-full items-center gap-2 border-b border-white/8 px-4 py-2.5 text-left text-[12px] font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
              Formação — Superadmin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[12px] font-medium text-rose-200 transition hover:bg-rose-500/10 hover:text-rose-100 disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
