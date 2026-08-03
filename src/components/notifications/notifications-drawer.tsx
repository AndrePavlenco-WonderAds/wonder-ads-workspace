"use client";

// O sino do header e o painel que ele abre.
//
// DESENHO — um painel de notificações falha sempre da mesma maneira: mostra
// uma lista de avisos que não se consegue resolver ali, e a pessoa fecha-o e
// esquece. Aqui cada linha tem as DUAS saídas possíveis à distância de um
// clique — ir fazer o trabalho, ou dizer que já está feito. Não há terceira
// coisa a fazer com uma notificação.
//
// Por isso:
//  • O badge conta o que está POR RESOLVER, não o que é "novo". Um contador de
//    não-lidos ensina a ignorá-lo; um contador de trabalho em aberto não.
//  • As linhas agrupam-se por lembrete + período ("Enviar Monthly Report ·
//    julho de 2026"), porque é assim que o trabalho é feito: em bloco.
//  • O que já foi resolvido não desaparece — desce para "Concluídas" e pode
//    ser reaberto. Um clique errado não pode apagar o lembrete do mês.
//  • Marcar concluído é otimista: a linha desce imediatamente e só depois se
//    confirma com o servidor. Se falhar, volta e diz porquê.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/dates";

export type DrawerNotification = {
  id: string;
  ruleId: string;
  title: string;
  body: string;
  periodLabel: string;
  dueAt: number;
  client: { slug: string; title: string; icon: string | null } | null;
  actionLabel: string;
  actionHref: string;
  resolved: boolean;
  resolvedAt: number | null;
};

type Group = {
  key: string;
  title: string;
  body: string;
  periodLabel: string;
  dueAt: number;
  items: DrawerNotification[];
};

function groupOf(items: DrawerNotification[]): Group[] {
  const map = new Map<string, Group>();
  for (const n of items) {
    const key = `${n.ruleId}|${n.periodLabel}`;
    const existing = map.get(key);
    if (existing) existing.items.push(n);
    else
      map.set(key, {
        key,
        title: n.title,
        body: n.body,
        periodLabel: n.periodLabel,
        dueAt: n.dueAt,
        items: [n],
      });
  }
  return Array.from(map.values()).sort((a, b) => a.dueAt - b.dueAt);
}

export function NotificationsDrawer({
  initial,
}: {
  initial: DrawerNotification[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // O painel sai para o <body> por portal. NÃO É COSMÉTICO: o header do
  // workspace tem `backdrop-blur`, e um elemento com backdrop-filter passa a
  // ser o bloco de contenção dos descendentes `position: fixed`. Renderizado
  // no sítio, o painel ficava preso à caixa do header — 68px de altura, sem
  // fundo visível e com o conteúdo esmagado.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // O servidor volta a calcular a lista em cada navegação; sem isto o painel
  // ficaria preso ao estado do primeiro render da sessão.
  useEffect(() => setItems(initial), [initial]);

  const pending = useMemo(() => items.filter((n) => !n.resolved), [items]);
  const done = useMemo(
    () =>
      items
        .filter((n) => n.resolved)
        .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)),
    [items],
  );
  const pendingGroups = useMemo(() => groupOf(pending), [pending]);

  // Escape fecha, e o body deixa de rolar por trás do painel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const setResolved = useCallback(
    async (id: string, resolved: boolean) => {
      setBusy(id);
      setError(null);
      const before = items;
      setItems((list) =>
        list.map((n) =>
          n.id === id
            ? { ...n, resolved, resolvedAt: resolved ? Date.now() : null }
            : n,
        ),
      );
      try {
        const res = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, resolved }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setItems(before);
          setError(data.error ?? "Não foi possível gravar.");
          return;
        }
        router.refresh();
      } catch {
        setItems(before);
        setError("Falha de rede — tenta outra vez.");
      } finally {
        setBusy(null);
      }
    },
    [items, router],
  );

  const count = pending.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          count > 0
            ? `Notificações — ${count} por resolver`
            : "Notificações — nada pendente"
        }
        aria-haspopup="dialog"
        className="group relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.08] hover:text-white"
      >
        <Bell className="h-[15px] w-[15px]" />
        {count > 0 && (
          <>
            <span
              aria-hidden
              className="brand-gradient-bg absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold leading-none text-white shadow-[0_4px_14px_-4px_rgba(120,61,245,0.9)]"
            >
              {count > 99 ? "99+" : count}
            </span>
            <span
              aria-hidden
              className="absolute -right-1 -top-1 h-[17px] min-w-[17px] animate-ping rounded-full bg-[color:var(--brand-purple)]/40"
            />
          </>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/55 backdrop-blur-[2px]"
          />

          <aside className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-white/10 bg-[color:var(--background)]/97 shadow-[-30px_0_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            {/* Fio de luz na aresta — assina o painel sem lhe pôr moldura. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-px"
              style={{
                background:
                  "linear-gradient(180deg, transparent, rgba(120,61,245,0.7), rgba(197,53,201,0.4), transparent)",
              }}
            />

            <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div className="min-w-0">
                <p className="readout text-white/35">Wonder Ads</p>
                <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight text-white">
                  Notificações
                </h2>
                <p className="mt-0.5 text-[11.5px] text-white/45">
                  {count === 0
                    ? "Nada por resolver."
                    : `${count} ${count === 1 ? "coisa" : "coisas"} por resolver`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:border-white/25 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {error && (
              <p className="border-b border-rose-400/20 bg-rose-500/[0.08] px-5 py-2.5 text-[12px] text-rose-200">
                {error}
              </p>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {count === 0 && done.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  {pendingGroups.map((g) => (
                    <section key={g.key} className="mb-7 last:mb-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h3 className="text-[13.5px] font-semibold text-white">
                          {g.title}
                        </h3>
                        <span className="readout text-[#d8b98a]">
                          {g.periodLabel}
                        </span>
                      </div>
                      {g.body && (
                        <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">
                          {g.body}
                        </p>
                      )}
                      <p className="tabular mt-1 text-[10.5px] text-white/28">
                        Em aberto desde {formatDate(g.dueAt)}
                      </p>

                      <ul className="mt-3 space-y-2">
                        {g.items.map((n) => (
                          <li key={n.id}>
                            <NotificationRow
                              n={n}
                              busy={busy === n.id}
                              onResolve={() => setResolved(n.id, true)}
                              onNavigate={() => setOpen(false)}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  {done.length > 0 && (
                    <section className="mt-8 border-t border-white/[0.07] pt-5">
                      <h3 className="readout text-white/30">
                        Concluídas · {done.length}
                      </h3>
                      <ul className="mt-3 space-y-1.5">
                        {done.map((n) => (
                          <li
                            key={n.id}
                            className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.012] px-3 py-2"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] text-white/55">
                                {n.client ? n.client.title : n.title}
                              </span>
                              <span className="tabular block text-[10.5px] text-white/28">
                                {n.periodLabel}
                                {n.resolvedAt
                                  ? ` · feito ${formatDate(n.resolvedAt)}`
                                  : ""}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setResolved(n.id, false)}
                              disabled={busy === n.id}
                              title="Reabrir"
                              className="rounded-md p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white/70 disabled:opacity-40"
                            >
                              {busy === n.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>

            <footer className="border-t border-white/[0.07] px-5 py-3">
              <p className="text-[10.5px] leading-relaxed text-white/30">
                Os lembretes são gerados pelo calendário — não há nada a
                despachar, só a resolver. Quem os configura é o Superadmin.
              </p>
            </footer>
          </aside>
        </div>,
          document.body,
        )}
    </>
  );
}

function NotificationRow({
  n,
  busy,
  onResolve,
  onNavigate,
}: {
  n: DrawerNotification;
  busy: boolean;
  onResolve: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition hover:border-[#783DF5]/35 hover:bg-white/[0.045]">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[15px]"
        >
          {n.client?.icon ?? "•"}
        </span>
        {/* O título do lembrete e o período vivem no cabeçalho do grupo — a
            linha só precisa de dizer SOBRE QUEM é. Repeti-los aqui era ruído
            cinco vezes seguidas. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-white/90">
            {n.client ? n.client.title : n.title}
          </span>
          {!n.client && (
            <span className="block truncate text-[11px] text-white/35">
              {n.periodLabel}
            </span>
          )}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        {n.actionHref ? (
          <Link
            href={n.actionHref}
            onClick={onNavigate}
            className="brand-gradient-bg inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110"
          >
            {n.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={onResolve}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/60 transition hover:border-emerald-400/45 hover:bg-emerald-500/[0.08] hover:text-emerald-200 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Concluído
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <span
        aria-hidden
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-4 rounded-full opacity-25 blur-2xl"
          style={{ background: "var(--brand-gradient)" }}
        />
        <CheckCircle2 className="relative h-6 w-6 text-emerald-300/80" />
      </span>
      <p className="mt-4 text-[14px] font-semibold text-white/85">
        Está tudo em dia
      </p>
      <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-white/40">
        Não tens nada por resolver. Quando houver, aparece aqui com o botão para
        ir tratar disso.
      </p>
    </div>
  );
}
