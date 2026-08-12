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
//    não-lidos ensina a ignorá-lo; um contador de trabalho em aberto não. Pulsa
//    e não é da cor da marca: um badge roxo lê-se como decoração, e a marca já
//    está no botão todo à volta dele.
//  • A COR diz DE QUEM é o trabalho. Vermelho quando há coisas minhas por
//    resolver; AZUL quando o contador só traz trabalho de outra pessoa. Quem
//    tem o painel de equipa (C-Level) passava o dia com um sino vermelho por
//    causa da dívida dos outros — e um alarme que está sempre ligado deixa de
//    ser um alarme. Basta uma notificação própria para o vermelho voltar.
//    A mesma regra vale para os separadores e para todo o painel de equipa.
//  • As linhas agrupam-se por lembrete + período ("Enviar Monthly Report ·
//    julho de 2026"), porque é assim que o trabalho é feito: em bloco.
//  • O que já foi resolvido não desaparece — desce para "Concluídas" e pode
//    ser reaberto. Um clique errado não pode apagar o lembrete do mês.
//  • Marcar concluído é otimista: a linha desce imediatamente e só depois se
//    confirma com o servidor. Se falhar, volta e diz porquê.
//
// SUPERADMIN — o painel ganha um separador "Equipa" com o que está em aberto
// em cada consultor. É deliberadamente SÓ DE LEITURA: o C-Level precisa de
// saber quem está em dívida e há quanto tempo, não de despachar em nome de
// outra pessoa (marcar por ela destruiria o único sinal fiável que o painel
// dá). Daí o link para o drill-down em vez de um botão de "concluído".

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
  ShieldCheck,
  TriangleAlert,
  Users,
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

export type TeamRow = {
  username: string;
  name: string;
  role: string;
  dept: string;
  pending: number;
  resolved: number;
  oldestDueAt: number | null;
  groups: { key: string; title: string; periodLabel: string; count: number }[];
  items: { id: string; label: string; periodLabel: string; icon: string | null }[];
  truncated: number;
};

export type TeamSummary = {
  rows: TeamRow[];
  totalPending: number;
  peopleWithPending: number;
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
  team = null,
  viewerUsername,
}: {
  initial: DrawerNotification[];
  /** Só chega preenchido a quem tem `isAdmin`. */
  team?: TeamSummary | null;
  viewerUsername?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"mine" | "team">("mine");
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
  // O que o C-Level tem em aberto na equipa (fora o dele próprio) — entra no
  // sino, porque o trabalho parado de um consultor é trabalho parado da casa.
  const teamOther = useMemo(
    () =>
      team
        ? team.rows
            .filter((r) => r.username !== viewerUsername)
            .reduce((s, r) => s + r.pending, 0)
        : 0,
    [team, viewerUsername],
  );
  const badgeCount = count + teamOther;
  // VERMELHO = MEU. Quando o contador só traz trabalho de outra pessoa, o
  // sino fica AZUL: continua a pedir atenção, mas diz logo de fora que não é
  // dívida de quem está a ver. Basta uma notificação própria para o vermelho
  // voltar — nunca se pode esconder o que é meu por trás do que é da equipa.
  const teamOnly = count === 0 && teamOther > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTab(teamOnly ? "team" : "mine");
          setOpen(true);
        }}
        aria-label={
          badgeCount > 0
            ? `Notificações — ${badgeCount} por resolver${
                teamOnly ? " na equipa" : ""
              }`
            : "Notificações — nada pendente"
        }
        aria-haspopup="dialog"
        className={`group relative inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white/[0.04] transition ${
          badgeCount === 0
            ? "border-white/12 text-white/70 hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.08] hover:text-white"
            : teamOnly
              ? "border-sky-400/40 text-white hover:border-sky-400/70 hover:bg-sky-500/[0.12]"
              : "border-rose-400/40 text-white hover:border-rose-400/70 hover:bg-rose-500/[0.12]"
        }`}
      >
        <Bell className="h-[15px] w-[15px]" />
        {badgeCount > 0 && (
          <>
            {/* A bater. O anel que expande é um segundo elemento por baixo do
                número, para o próprio número não escalar e continuar legível
                enquanto pulsa. */}
            <span
              aria-hidden
              className={`badge-alert absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold leading-none text-white ${
                teamOnly ? "badge-alert-info bg-[#0ea5e9]" : "bg-[#e11d48]"
              }`}
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
            <span
              aria-hidden
              className={`absolute -right-1 -top-1 h-[17px] min-w-[17px] animate-ping rounded-full ${
                teamOnly ? "bg-sky-500/45" : "bg-rose-500/45"
              }`}
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

            {team && (
              <div
                role="tablist"
                aria-label="Âmbito das notificações"
                className="flex gap-1 border-b border-white/[0.07] px-5 py-2.5"
              >
                <TabButton
                  active={tab === "mine"}
                  onClick={() => setTab("mine")}
                  label="As minhas"
                  count={count}
                  tone="mine"
                />
                <TabButton
                  active={tab === "team"}
                  onClick={() => setTab("team")}
                  label="Equipa"
                  count={teamOther}
                  tone="team"
                  icon={<Users className="h-3 w-3" />}
                />
              </div>
            )}

            {error && (
              <p className="border-b border-rose-400/20 bg-rose-500/[0.08] px-5 py-2.5 text-[12px] text-rose-200">
                {error}
              </p>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {team && tab === "team" ? (
                <TeamPanel
                  team={team}
                  viewerUsername={viewerUsername}
                  onNavigate={() => setOpen(false)}
                />
              ) : count === 0 && done.length === 0 ? (
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
                {team && tab === "team"
                  ? "Vista de leitura: o que cada consultor tem em aberto. Marcar como concluído é sempre da pessoa a quem o trabalho pertence."
                  : "Os lembretes são gerados pelo calendário — não há nada a despachar, só a resolver. Quem os configura é o Superadmin."}
              </p>
            </footer>
          </aside>
        </div>,
          document.body,
        )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  tone,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  /** A mesma regra do sino: vermelho para o que é meu, azul para o da equipa. */
  tone: "mine" | "team";
  icon?: React.ReactNode;
}) {
  const pill =
    tone === "team"
      ? active
        ? "bg-sky-500/25 text-sky-200"
        : "bg-sky-500/15 text-sky-300/80"
      : active
        ? "bg-rose-500/25 text-rose-200"
        : "bg-rose-500/15 text-rose-300/80";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "bg-white/[0.08] text-white"
          : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={`tabular rounded-full px-1.5 py-0.5 text-[9.5px] font-bold leading-none ${pill}`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/** Painel de equipa do Superadmin — uma linha por pessoa com trabalho em
 *  aberto, expansível para ver sobre que clientes é. Quem está em dia aparece
 *  no fim, em bloco: o C-Level tem de conseguir ler "quem está em dívida" sem
 *  scroll, mas "quem está em dia" também é informação. */
function TeamPanel({
  team,
  viewerUsername,
  onNavigate,
}: {
  team: TeamSummary;
  viewerUsername?: string;
  onNavigate: () => void;
}) {
  const others = team.rows.filter((r) => r.username !== viewerUsername);
  const late = others.filter((r) => r.pending > 0);
  const clear = others.filter((r) => r.pending === 0);

  if (others.length === 0) {
    return (
      <div className="px-4 py-14 text-center">
        <Users className="mx-auto h-6 w-6 text-white/25" />
        <p className="mt-3 text-[13px] font-semibold text-white/70">
          Sem regras aplicáveis à equipa
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/40">
          Nenhuma regra ativa abrange outra pessoa. Configura-as em{" "}
          <Link
            href="/admin/notificacoes"
            onClick={onNavigate}
            className="text-[#c3aaff] underline-offset-2 hover:underline"
          >
            /admin → Notificações
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] ${
            late.length > 0
              ? "border-sky-400/35 bg-sky-500/[0.1] text-sky-200"
              : "border-emerald-400/30 bg-emerald-500/[0.1] text-emerald-200"
          }`}
        >
          {late.length > 0 ? (
            <TriangleAlert className="h-3 w-3" />
          ) : (
            <ShieldCheck className="h-3 w-3" />
          )}
          {late.length > 0
            ? `${late.length} ${late.length === 1 ? "pessoa" : "pessoas"} com trabalho em aberto`
            : "Equipa toda em dia"}
        </span>
        {late.length > 0 && (
          <span className="tabular text-[11px] text-white/40">
            {late.reduce((s, r) => s + r.pending, 0)} no total
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {late.map((r) => (
          <li key={r.username}>
            <TeamPersonRow row={r} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>

      {clear.length > 0 && (
        <section className="mt-7 border-t border-white/[0.07] pt-5">
          <h3 className="readout text-white/30">Em dia · {clear.length}</h3>
          <ul className="mt-3 space-y-1.5">
            {clear.map((r) => (
              <li
                key={r.username}
                className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.012] px-3 py-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/55">
                  {r.name}
                </span>
                <span className="tabular shrink-0 text-[10.5px] text-white/28">
                  {r.resolved > 0 ? `${r.resolved} feitas` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function TeamPersonRow({
  row,
  onNavigate,
}: {
  row: TeamRow;
  onNavigate: () => void;
}) {
  return (
    <details className="group rounded-xl border border-sky-400/20 bg-sky-500/[0.04] p-3 transition open:border-sky-400/35">
      <summary className="flex cursor-pointer items-center gap-2.5 marker:content-['']">
        <span
          aria-hidden
          className="brand-gradient-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        >
          {row.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-white/90">
            {row.name}
          </span>
          <span className="tabular block truncate text-[10.5px] text-white/40">
            {row.role}
            {row.oldestDueAt ? ` · desde ${formatDate(row.oldestDueAt)}` : ""}
          </span>
        </span>
        <span className="tabular shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-200">
          {row.pending}
        </span>
      </summary>

      <div className="mt-3 border-t border-white/[0.07] pt-3">
        {row.groups.map((g) => (
          <p
            key={g.key}
            className="mb-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[11.5px] last:mb-0"
          >
            <span className="font-medium text-white/75">{g.title}</span>
            <span className="readout text-[#d8b98a]">{g.periodLabel}</span>
            <span className="tabular ml-auto text-white/40">×{g.count}</span>
          </p>
        ))}

        <ul className="mt-2.5 space-y-1">
          {row.items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2 py-1.5"
            >
              <span aria-hidden className="shrink-0 text-[13px]">
                {it.icon ?? "•"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-white/70">
                {it.label}
              </span>
              <span className="tabular shrink-0 text-[10px] text-white/30">
                {it.periodLabel}
              </span>
            </li>
          ))}
          {row.truncated > 0 && (
            <li className="px-2 pt-1 text-[10.5px] text-white/30">
              + {row.truncated} sem caber aqui
            </li>
          )}
        </ul>

        <Link
          href={`/formacao/admin/${row.username}`}
          onClick={onNavigate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11.5px] font-medium text-white/65 transition hover:border-[#783DF5]/45 hover:text-white"
        >
          Ver ficha
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </details>
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
  // Numa resposta a um pedido de ausência não há trabalho a "concluir" —
  // há uma decisão a acusar como recebida. O botão diz isso.
  const resolveLabel =
    n.ruleId === "absence-decision" ? "Entendido" : "Concluído";
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
          {resolveLabel}
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
