"use client";

// Single-ticket view: editable status / priority / assignee, the full
// description + attachments, an internal comments thread, and a history
// timeline. Status changes notify Slack server-side.

import { useCallback, useState } from "react";
import {
  Loader2,
  Paperclip,
  Send,
} from "lucide-react";
import {
  REQUESTING_DEPT_LABEL,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_META,
  TICKET_STATUSES,
  TICKET_STATUS_META,
  ticketRef,
  type WebTicket,
} from "@/lib/web-tickets-shared";
import { formatDateTime } from "@/lib/dates";

type Assignee = { username: string; name: string };

export function TicketDetail({
  initialTicket,
  assignees,
}: {
  initialTicket: WebTicket;
  assignees: Assignee[];
}) {
  const [ticket, setTicket] = useState<WebTicket>(initialTicket);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/web/tickets/${ticket.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { ticket?: WebTicket };
        if (res.ok && data.ticket) setTicket(data.ticket);
      } finally {
        setSaving(false);
      }
    },
    [ticket.id],
  );

  const postComment = useCallback(async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/web/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      const data = (await res.json()) as { ticket?: WebTicket };
      if (res.ok && data.ticket) {
        setTicket(data.ticket);
        setComment("");
      }
    } finally {
      setPosting(false);
    }
  }, [comment, ticket.id]);

  const prio = TICKET_PRIORITY_META[ticket.priority];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      {/* Main column */}
      <div className="space-y-5">
        <div className="brand-gradient-border rounded-2xl bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-[11px] text-white/45">
            <span className="tabular-nums">{ticketRef(ticket)}</span>
            <span>·</span>
            <span>{TICKET_CATEGORY_LABEL[ticket.category]}</span>
            <span>·</span>
            <span>{REQUESTING_DEPT_LABEL[ticket.requestingDept]}</span>
            {saving && (
              <span className="ml-auto inline-flex items-center gap-1 text-white/45">
                <Loader2 className="h-3 w-3 animate-spin" /> a guardar…
              </span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            {ticket.title}
          </h1>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/75">
            {ticket.description || (
              <span className="text-white/40">Sem descrição.</span>
            )}
          </p>

          {ticket.attachments.length > 0 && (
            <div className="mt-4 border-t border-white/8 pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.13em] text-white/50">
                Anexos
              </p>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((a) =>
                  a.kind === "image" ? (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-20 w-20 overflow-hidden rounded-lg border border-white/10"
                      title={a.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                    </a>
                  ) : (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[180px] items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-[11px] text-white/75 transition hover:border-white/30 hover:text-white"
                      title={a.name}
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </a>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
            Comentários internos
          </h2>
          <ul className="mt-3 space-y-3">
            {ticket.comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-white/80">{c.authorName}</span>
                  <span className="text-white/40">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-[13px] text-white/75">
                  {c.body}
                </p>
              </li>
            ))}
            {ticket.comments.length === 0 && (
              <li className="text-[12px] text-white/40">Ainda sem comentários.</li>
            )}
          </ul>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Escreve um comentário interno…"
              className="flex-1 resize-y rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-white/30"
            />
            <button
              type="button"
              onClick={postComment}
              disabled={posting || !comment.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
              }}
            >
              {posting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar: controls + meta + history */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <SideSelect
            label="Estado"
            value={ticket.status}
            onChange={(v) => patch({ status: v })}
            tagClass={TICKET_STATUS_META[ticket.status].tag}
            options={TICKET_STATUSES.map((s) => ({
              value: s,
              label: TICKET_STATUS_META[s].label,
            }))}
          />
          <SideSelect
            label="Prioridade"
            value={ticket.priority}
            onChange={(v) => patch({ priority: v })}
            tagClass={prio.tag}
            options={TICKET_PRIORITIES.map((p) => ({
              value: p,
              label: `${TICKET_PRIORITY_META[p].emoji} ${TICKET_PRIORITY_META[p].label}`,
            }))}
          />
          <SideSelect
            label="Responsável"
            value={ticket.assigneeUsername ?? ""}
            onChange={(v) => patch({ assigneeUsername: v || null })}
            tagClass="border-white/15 bg-white/[0.05] text-white/75"
            options={[
              { value: "", label: "— por atribuir —" },
              ...assignees.map((a) => ({ value: a.username, label: a.name })),
            ]}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-[12px] text-white/60">
          <Meta label="Autor" value={ticket.authorName} />
          <Meta label="Criado" value={formatDateTime(ticket.createdAt)} />
          <Meta label="Atualizado" value={formatDateTime(ticket.updatedAt)} />
          {ticket.resolvedAt && (
            <Meta label="Resolvido" value={formatDateTime(ticket.resolvedAt)} />
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
            Histórico
          </h3>
          <ul className="mt-2.5 space-y-2">
            {[...ticket.history].reverse().map((e) => (
              <li key={e.id} className="flex gap-2 text-[11.5px]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                <div>
                  <span className="text-white/75">{e.message}</span>
                  <div className="text-white/35">{formatDateTime(e.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function SideSelect({
  label,
  value,
  onChange,
  options,
  tagClass,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  tagClass: string;
}) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-white/50">
        {label}
      </span>
      <div className="relative mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full cursor-pointer appearance-none rounded-lg border px-3 py-2 pr-8 text-[12px] font-medium outline-none ${tagClass}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#14141b] text-white">
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-70">
          ▾
        </span>
      </div>
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-white/45">{label}</span>
      <span className="text-white/75">{value}</span>
    </div>
  );
}
