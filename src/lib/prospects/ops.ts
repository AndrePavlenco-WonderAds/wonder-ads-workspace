// As operações sobre uma Ficha do prospect (v80.0) — partilhadas: o browser
// constrói-as, o servidor aplica-as SEMPRE sobre a versão acabada de ler do
// KV. Cada pedido muda uma coisa só (um campo, uma nota, uma oportunidade),
// por isso duas pessoas a escrever na mesma ficha não se apagam uma à outra
// como aconteceria se o browser mandasse a ficha inteira.
//
// `applyProspectOp` é pura: recebe a ficha, devolve a ficha nova e a linha
// de atividade, ou um erro em português para mostrar a quem tentou.

import {
  LIMITS,
  NOTE_TYPE_LABEL,
  OPPORTUNITY_KIND_LABEL,
  PROFILE_FIELDS,
  PROSPECT_TEXT_FIELDS,
  PROSPECT_TEXT_LABEL,
  STATUS_LABEL,
  callProvider,
  cleanUrl,
  hydrateAttachment,
  hydrateNote,
  hydrateOpportunity,
  hydratePriority,
  newId,
  type ProspectAttachment,
  type ProspectFile,
  type ProspectNote,
  type ProspectOpportunity,
  type ProspectPriority,
  type ProspectProfile,
  type ProspectTextField,
} from "./shared";

export type ProspectOp =
  | { op: "text"; field: ProspectTextField; value: string }
  | { op: "profile"; patch: Partial<ProspectProfile> }
  | { op: "tags"; tags: string[] }
  | { op: "priorities"; priorities: ProspectPriority[] }
  | { op: "owner"; owner: string | null }
  | { op: "opportunity.save"; opportunity: Partial<ProspectOpportunity> }
  | { op: "opportunity.delete"; id: string }
  | { op: "note.save"; note: Partial<ProspectNote> }
  | { op: "note.delete"; id: string }
  | { op: "link.add"; label: string; url: string }
  | { op: "link.delete"; id: string }
  | { op: "files.add"; files: Array<Partial<ProspectAttachment>> }
  | { op: "file.delete"; id: string };

export type ProspectActor = { username: string; isAdmin: boolean };

export type ApplyResult =
  | { ok: true; file: ProspectFile; activity: string | null }
  | { ok: false; error: string; status: number };

/** Edições seguidas da mesma pessoa à mesma coisa contam como uma linha de
 *  atividade (10 min) — senão o histórico enchia-se de «editou o resumo». */
const COALESCE_MS = 10 * 60 * 1000;

function fail(error: string, status = 400): ApplyResult {
  return { ok: false, error, status };
}

function mayTouch(actor: ProspectActor, author: string): boolean {
  return actor.isAdmin || actor.username === author;
}

export function applyProspectOp(
  file: ProspectFile,
  raw: unknown,
  actor: ProspectActor,
  opts: { validOwners: Set<string>; now?: number },
): ApplyResult {
  const now = opts.now ?? Date.now();
  if (!raw || typeof raw !== "object") return fail("Pedido inválido.");
  const op = raw as { op?: unknown } & Record<string, unknown>;
  const next: ProspectFile = { ...file };
  let activity: string | null = null;

  switch (op.op) {
    case "text": {
      const field = op.field as ProspectTextField;
      if (!(PROSPECT_TEXT_FIELDS as readonly string[]).includes(field as string)) {
        return fail("Campo desconhecido.");
      }
      const value = typeof op.value === "string" ? op.value.replace(/\r\n/g, "\n") : "";
      if (value.length > LIMITS.text) return fail("Texto demasiado longo.");
      if (value === file[field]) return { ok: true, file, activity: null };
      next[field] = value;
      activity = value.trim()
        ? `editou «${PROSPECT_TEXT_LABEL[field]}»`
        : `limpou «${PROSPECT_TEXT_LABEL[field]}»`;
      break;
    }
    case "profile": {
      const patch = (op.patch && typeof op.patch === "object" ? op.patch : {}) as Record<string, unknown>;
      const profile = { ...file.profile };
      let changed = false;
      for (const f of PROFILE_FIELDS) {
        if (!(f in patch)) continue;
        const v = typeof patch[f] === "string" ? (patch[f] as string).trim().slice(0, LIMITS.short) : "";
        if (v !== profile[f]) {
          profile[f] = v;
          changed = true;
        }
      }
      if (!changed) return { ok: true, file, activity: null };
      next.profile = profile;
      activity = "atualizou o perfil do prospect";
      break;
    }
    case "tags": {
      const tags = Array.isArray(op.tags) ? op.tags : [];
      const seen = new Set<string>();
      const clean: string[] = [];
      for (const t of tags) {
        if (typeof t !== "string") continue;
        const v = t.trim().slice(0, LIMITS.tag);
        const k = v.toLowerCase();
        if (!v || seen.has(k)) continue;
        seen.add(k);
        clean.push(v);
      }
      if (clean.length > LIMITS.tags) return fail(`No máximo ${LIMITS.tags} etiquetas.`);
      next.interestTags = clean;
      activity = "atualizou as etiquetas de interesse";
      break;
    }
    case "priorities": {
      const list = Array.isArray(op.priorities) ? op.priorities : [];
      const clean = list
        .map((p) => hydratePriority(p))
        .filter((p): p is ProspectPriority => Boolean(p));
      if (clean.length > LIMITS.priorities) return fail(`No máximo ${LIMITS.priorities} prioridades.`);
      next.priorities = clean;
      activity = "atualizou as prioridades";
      break;
    }
    case "owner": {
      const owner = typeof op.owner === "string" && op.owner ? op.owner : null;
      if (owner && !opts.validOwners.has(owner)) return fail("Essa pessoa não pode ser comercial responsável.");
      if (owner === file.owner) return { ok: true, file, activity: null };
      next.owner = owner;
      activity = owner ? "mudou o comercial responsável" : "tirou o comercial responsável";
      break;
    }
    case "opportunity.save": {
      const input = (op.opportunity ?? {}) as Partial<ProspectOpportunity>;
      const existing = input.id ? file.opportunities.find((o) => o.id === input.id) : undefined;
      const merged = hydrateOpportunity({
        ...(existing ?? {}),
        ...input,
        id: existing?.id ?? newId("op"),
        createdBy: existing?.createdBy ?? actor.username,
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing ? now : null,
      });
      if (!merged) return fail("Indica o serviço da oportunidade.");
      if (!existing && file.opportunities.length >= LIMITS.opportunities) {
        return fail(`No máximo ${LIMITS.opportunities} oportunidades.`);
      }
      next.opportunities = existing
        ? file.opportunities.map((o) => (o.id === existing.id ? merged : o))
        : [...file.opportunities, merged];
      const kind = OPPORTUNITY_KIND_LABEL[merged.kind].toLowerCase();
      activity = !existing
        ? `acrescentou um ${kind}: ${merged.service}`
        : existing.status !== merged.status
          ? `marcou «${merged.service}» como ${STATUS_LABEL[merged.status].toLowerCase()}`
          : `atualizou o ${kind} «${merged.service}»`;
      break;
    }
    case "opportunity.delete": {
      const found = file.opportunities.find((o) => o.id === op.id);
      if (!found) return { ok: true, file, activity: null };
      next.opportunities = file.opportunities.filter((o) => o.id !== found.id);
      activity = `apagou o ${OPPORTUNITY_KIND_LABEL[found.kind].toLowerCase()} «${found.service}»`;
      break;
    }
    case "note.save": {
      const input = (op.note ?? {}) as Partial<ProspectNote>;
      const existing = input.id ? file.notes.find((n) => n.id === input.id) : undefined;
      if (existing && !mayTouch(actor, existing.author)) {
        return fail("Só quem escreveu esta nota (ou a direção) a pode editar.", 403);
      }
      const merged = hydrateNote({
        ...(existing ?? {}),
        ...input,
        attachments: (input.attachments ?? existing?.attachments ?? []).map((a) => ({
          ...a,
          addedBy: a.addedBy || actor.username,
          addedAt: a.addedAt || now,
        })),
        id: existing?.id ?? newId("nt"),
        author: existing?.author ?? actor.username,
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing ? now : null,
      });
      if (!merged) return fail("A nota está vazia.");
      if (!existing && file.notes.length >= LIMITS.notes) return fail(`No máximo ${LIMITS.notes} notas.`);
      if (merged.body.length > LIMITS.noteBody) return fail("Nota demasiado longa.");
      next.notes = existing
        ? file.notes.map((n) => (n.id === existing.id ? merged : n))
        : [merged, ...file.notes];
      const label = NOTE_TYPE_LABEL[merged.type];
      activity = existing
        ? `editou a nota «${merged.title || label}»`
        : `registou «${label}»${merged.title ? `: ${merged.title}` : ""}`;
      break;
    }
    case "note.delete": {
      const found = file.notes.find((n) => n.id === op.id);
      if (!found) return { ok: true, file, activity: null };
      if (!mayTouch(actor, found.author)) {
        return fail("Só quem escreveu esta nota (ou a direção) a pode apagar.", 403);
      }
      next.notes = file.notes.filter((n) => n.id !== found.id);
      activity = `apagou a nota «${found.title || NOTE_TYPE_LABEL[found.type]}»`;
      break;
    }
    case "link.add": {
      const url = cleanUrl(op.url);
      if (!url) return fail("Link inválido — tem de começar por https://.");
      if (file.links.length >= LIMITS.links) return fail(`No máximo ${LIMITS.links} links.`);
      const label = typeof op.label === "string" ? op.label.trim().slice(0, 120) : "";
      next.links = [
        ...file.links,
        { id: newId("lk"), label, url, addedBy: actor.username, addedAt: now },
      ];
      activity = `acrescentou o link «${label || callProvider(url)}»`;
      break;
    }
    case "link.delete": {
      const found = file.links.find((l) => l.id === op.id);
      if (!found) return { ok: true, file, activity: null };
      if (!mayTouch(actor, found.addedBy)) return fail("Só quem acrescentou o link o pode apagar.", 403);
      next.links = file.links.filter((l) => l.id !== found.id);
      activity = `apagou o link «${found.label || callProvider(found.url)}»`;
      break;
    }
    case "files.add": {
      const list = Array.isArray(op.files) ? op.files : [];
      const clean = list
        .map((f) => hydrateAttachment({ ...(f as object), addedBy: actor.username, addedAt: now }))
        .filter((f): f is ProspectAttachment => Boolean(f));
      if (clean.length === 0) return fail("Nenhum ficheiro válido.");
      if (file.files.length + clean.length > LIMITS.files) return fail(`No máximo ${LIMITS.files} anexos.`);
      next.files = [...clean, ...file.files];
      activity =
        clean.length === 1 ? `anexou «${clean[0].name}»` : `anexou ${clean.length} ficheiros`;
      break;
    }
    case "file.delete": {
      const found = file.files.find((f) => f.id === op.id);
      if (!found) return { ok: true, file, activity: null };
      if (!mayTouch(actor, found.addedBy)) return fail("Só quem anexou o ficheiro o pode apagar.", 403);
      next.files = file.files.filter((f) => f.id !== found.id);
      activity = `apagou o anexo «${found.name}»`;
      break;
    }
    default:
      return fail("Operação desconhecida.");
  }

  next.updatedAt = now;
  next.updatedBy = actor.username;
  if (activity) {
    const [last, ...rest] = file.activity;
    const same = last && last.by === actor.username && last.text === activity && now - last.at < COALESCE_MS;
    next.activity = [
      { at: now, by: actor.username, text: activity },
      ...(same ? rest : file.activity),
    ].slice(0, LIMITS.activity);
  }
  return { ok: true, file: next, activity };
}
