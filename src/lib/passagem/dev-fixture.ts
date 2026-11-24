// Passagem de exemplo para desenvolvimento local (DEV_PASSAGEM_FIXTURE=1,
// ver db.ts). Usa clientes e pessoas reais da carteira só para os nomes
// baterem com o SEO DPT; o texto é de exemplo e nunca sai da memória local.

import type { Ficha, Passagem, PassagemIndexEntry, Question, Sign } from "./shared";
import { addDaysISO, indexEntryOf } from "./shared";

const ID = "dev-maria";

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(Date.now());
}

const LONG =
  "Exemplo de texto da ficha para ver o desenho com conteúdo real: o projeto está na semana 6 do roadmap, com as páginas de serviço reescritas e a ficha do Google Business Profile otimizada. Falta fechar os artigos de novembro.";

export function devPassagemSeed(): Record<string, unknown> {
  const now = Date.now();
  const start = addDaysISO(todayISO(), -9);
  const fran = { username: "fran-r", name: "Fran. Rosa" };
  const andreP = { username: "andre-pereira", name: "André Pereira" };
  const joao = { username: "joao-b", name: "João B." };
  const passagem: Passagem = {
    id: ID,
    outgoing: { username: "maria-a", name: "Maria Assena" },
    reason: "saida",
    startDate: start,
    endDate: addDaysISO(start, 29),
    note: "Prioridade aos Real Hotels: o cliente é sensível a mudanças. Apresenta o novo consultor antes do fim do mês.",
    status: "ativa",
    projects: [
      { slug: "atn-medical", title: "ATN Medical", incoming: fran },
      { slug: "clinica-medica-dentaria-colegio-militar", title: "Clínica Medica Dentária Colégio Militar", incoming: andreP },
      { slug: "real-hotels-group", title: "Real Hotels Group", incoming: fran },
      { slug: "real-hotels-group-santa-eulalia", title: "Real Hotels Group Santa Eulália", incoming: joao },
      { slug: "verychaga", title: "VeryChaga", incoming: null },
    ],
    exit: { equipa: { at: now - 7 * 86_400_000, by: "André Pavlenco" } },
    createdAt: now - 9 * 86_400_000,
    createdBy: { username: "andre", name: "André Pavlenco" },
    closedAt: null,
    closedBy: null,
    updatedAt: now,
  };
  const full: Ficha = {
    sections: { estado: LONG, objetivos: LONG, pessoas: LONG, proximos: LONG, historico: LONG, riscos: LONG, onde: LONG },
    accesses: { gsc: "ok", ga4: "ok", gbp: "ok", cms: "ok", hosting: "na", rank: "ok", ads: "na", whatsapp: "ok", slack: "ok", drive: "ok" },
    accessNotes: "O 2FA do WordPress chega ao telemóvel da receção.",
    health: "verde",
    healthWhy: "",
    meetingDate: addDaysISO(start, 6),
    meetingDone: true,
    clientInformed: true,
    readyAt: now - 3 * 86_400_000,
    updatedAt: now - 3 * 86_400_000,
  };
  const half: Ficha = {
    sections: { estado: LONG, objetivos: LONG, pessoas: LONG, proximos: "Faltam os artigos." },
    accesses: { gsc: "ok", ga4: "ok", gbp: "falta", cms: "ok", whatsapp: "ok" },
    accessNotes: "",
    health: "amarelo",
    healthWhy: "Pediu para rever o orçamento em janeiro.",
    meetingDate: addDaysISO(todayISO(), 4),
    meetingDone: false,
    clientInformed: false,
    readyAt: null,
    updatedAt: now - 86_400_000,
  };
  const risky: Ficha = {
    ...full,
    health: "vermelho",
    healthWhy: "Insatisfeito com a velocidade dos resultados; renovação em fevereiro.",
    meetingDone: false,
    accesses: { ...full.accesses, hosting: "falta" },
    readyAt: now - 86_400_000,
  };
  const small: Ficha = {
    sections: { estado: LONG },
    accesses: {},
    accessNotes: "",
    health: null,
    healthWhy: "",
    meetingDate: null,
    meetingDone: false,
    clientInformed: false,
    readyAt: null,
    updatedAt: now - 2 * 86_400_000,
  };
  const sign: Sign = { at: now - 2 * 86_400_000, by: fran };
  const q1: Question = {
    id: "dev-q1",
    slug: "real-hotels-group",
    q: "Quem aprova os artigos do blog do hotel: o diretor ou a equipa de marketing?",
    by: fran,
    at: now - 2 * 86_400_000,
    a: "A equipa de marketing (Sofia). O diretor só vê o relatório mensal.",
    aBy: { username: "maria-a", name: "Maria Assena" },
    aAt: now - 86_400_000,
  };
  const q2: Question = {
    id: "dev-q2",
    slug: "real-hotels-group",
    q: "Há alguma página que o cliente não quer que se mexa?",
    by: fran,
    at: now - 3 * 3_600_000,
    a: null,
    aBy: null,
    aAt: null,
  };
  const index: PassagemIndexEntry[] = [indexEntryOf(passagem)];
  return {
    "passagem:index": index,
    [`passagem:${ID}`]: passagem,
    [`passagem:${ID}:ficha:atn-medical`]: full,
    [`passagem:${ID}:ficha:clinica-medica-dentaria-colegio-militar`]: half,
    [`passagem:${ID}:ficha:real-hotels-group`]: risky,
    [`passagem:${ID}:ficha:verychaga`]: small,
    [`passagem:${ID}:sign:atn-medical`]: sign,
    [`passagem:${ID}:qids`]: ["dev-q2", "dev-q1"],
    [`passagem:${ID}:q:dev-q1`]: q1,
    [`passagem:${ID}:q:dev-q2`]: q2,
  };
}
