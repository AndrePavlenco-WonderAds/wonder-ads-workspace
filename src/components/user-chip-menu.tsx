"use client";

// Client-side bit of the header user chip: handles the hover/click
// menu + the logout call. Split out from <UserChip> so the chip's
// cookie read happens server-side without forcing the menu's "use
// client" boundary all the way up the tree.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserCircle2 } from "lucide-react";

export function UserChipMenu({
  name,
  role,
  dept,
  hoursLeft,
}: {
  name: string;
  role: string;
  dept: string;
  hoursLeft: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
        className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-2 py-1 pr-2.5 text-[11.5px] font-medium text-white/85 transition hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.08] hover:text-white"
      >
        <span
          aria-hidden
          className="brand-gradient-bg flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(120,61,245,0.6)]"
        >
          {initial}
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
            <p className="mt-2 text-[10.5px] text-white/45">
              Session expires in ~{hoursLeft}h
            </p>
          </div>
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
