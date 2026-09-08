// O consultor de uma proposta, com tudo o que o cartão do Comercial mostra:
// nome, cargo, e-mail, retrato. Só servidor (puxa as credenciais).
//
// A ORDEM DE RESOLUÇÃO é a do resto da app: quem tem ficha de cliente manda
// (`getConsultantForSlug`), o nome escrito na proposta é a rede para
// prospects sem slug. O username vem do nome de exibição das credenciais —
// é o que liga o nome ao retrato em public/team/avatar.

import { EMPLOYEE_CREDENTIALS } from "@/lib/auth/credentials";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { getTeamAvatar } from "@/lib/team-avatars";

export type ProposalConsultant = {
  name: string;
  username: string | null;
  role: string | null;
  email: string;
  avatar: string | null;
};

/** E-mail de trabalho por username — para quem assina propostas sem
 *  ficha de cliente (prospects). Os restantes caem no info@. */
const EMAIL_BY_USERNAME: Record<string, string> = {
  andre: "andre@wonder-ads.com",
  "fran-r": "fran@wonder-ads.com",
  "manuel-s": "manuel@wonder-ads.com",
  "andre-pereira": "andre.pereira@wonder-ads.com",
  "joao-b": "joao.batista@wonder-ads.com",
};

function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.\s]+/g, " ")
    .trim()
    .toLowerCase();
}

/** A credencial cujo nome de exibição (ou nome completo, ou username) bate
 *  com o nome dado. Aceita «Fran. Rosa», «Fran Rosa» e «fran-r». */
export function findEmployeeByName(name: string | null | undefined) {
  if (!name) return null;
  const q = normalise(name);
  if (!q) return null;
  return (
    EMPLOYEE_CREDENTIALS.find((c) => c.username.toLowerCase() === q) ??
    EMPLOYEE_CREDENTIALS.find((c) => normalise(c.name) === q) ??
    EMPLOYEE_CREDENTIALS.find((c) => c.fullName && normalise(c.fullName) === q) ??
    null
  );
}

/** O username de quem assina com este e-mail (fran@ → fran-r), ou null. */
export function findUsernameByEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const q = email.trim().toLowerCase();
  const hit = Object.entries(EMAIL_BY_USERNAME).find(([, e]) => e === q);
  return hit ? hit[0] : null;
}

export function resolveProposalConsultant(input: {
  clientSlug: string | null;
  consultant: string;
  consultantUsername?: string | null;
}): ProposalConsultant {
  const fromSlug = input.clientSlug ? getConsultantForSlug(input.clientSlug) : "Unassigned";
  const byUsername = input.consultantUsername
    ? EMPLOYEE_CREDENTIALS.find((c) => c.username === input.consultantUsername) ?? null
    : null;
  const name =
    fromSlug !== "Unassigned"
      ? fromSlug
      : byUsername?.name ?? (input.consultant.trim() || "Unassigned");
  const row = fromSlug !== "Unassigned" ? findEmployeeByName(fromSlug) : byUsername ?? findEmployeeByName(name);
  const username = row?.username ?? null;
  const email =
    input.clientSlug && fromSlug !== "Unassigned"
      ? getConsultantEmailForSlug(input.clientSlug)
      : (username && EMAIL_BY_USERNAME[username]) || "info@wonder-ads.com";
  return {
    name,
    username,
    role: row?.role ?? null,
    email,
    avatar: getTeamAvatar(username),
  };
}

/** Quem pode assinar uma proposta — a lista do seletor no upload. */
export function listProposalSigners(): { username: string; name: string; role: string }[] {
  return EMPLOYEE_CREDENTIALS.filter((c) => c.assignable !== false).map((c) => ({
    username: c.username,
    name: c.name,
    role: c.role,
  }));
}
