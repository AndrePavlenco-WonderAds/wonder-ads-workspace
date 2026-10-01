// «Uma verdade, duas mentiras» — o estado de uma sala em KV (v77.71).
//
// UMA SALA = UM HASH (`minigames:game:<id>`), com um campo por coisa que
// alguém escreve:
//   meta          → a sala (fase, ordem das rondas, prazo…) — só o anfitrião
//   p:<username>  → o jogador e as 3 frases dele — só o próprio
//   v:<r>:<user>  → o palpite de <user> na ronda <r> — só o próprio
// Cada pessoa só escreve os seus campos, por isso dez telemóveis a votar ao
// mesmo tempo nunca se pisam (um blob único perdia votos em corrida). E o
// polling é UM comando por pedido: HGETALL.
//
// NADA DE TRANSIÇÕES PREGUIÇOSAS GRAVADAS. A revelação automática (todos
// votaram, ou o tempo acabou) é calculada em cada leitura e nunca escrita:
// um leitor atrasado a gravar «revelado» por cima do «próxima ronda» do
// anfitrião fazia o jogo andar para trás. Só o anfitrião escreve `meta`.
//
// A verdade de cada pessoa só sai do servidor na revelação da ronda dela —
// `buildView` é o único caminho para o browser.

import { kv } from "@vercel/kv";
import { getEmployeeDisplay } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import {
  POINTS_CORRECT,
  POINTS_FOOLED,
  ROUND_SECONDS_CHOICES,
  STATEMENT_MAX,
  STATEMENT_MIN,
  type Award,
  type FinalRow,
  type GamePhase,
  type GameSummary,
  type GameView,
  type PlayerView,
} from "./types";

const GAME_KEY = (id: string) => `minigames:game:${id}`;
const ACTIVE_KEY = "minigames:active";
const HISTORY_KEY = "minigames:history";
const GAME_TTL_SECONDS = 60 * 24 * 60 * 60; // 60 dias
const ACTIVE_TTL_SECONDS = 2 * 24 * 60 * 60; // uma sala esquecida deixa de aparecer no hub ao fim de 2 dias
const HISTORY_MAX = 30;
/** Folga antes de o relógio da ronda arrancar — o tempo do ecrã «Ronda N». */
const ROUND_INTRO_MS = 2500;

export class GameError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type Meta = {
  id: string;
  kind: "one-truth";
  createdAt: string;
  createdBy: string;
  hostName: string;
  roundSeconds: number | null;
  phase: "lobby" | "playing" | "final" | "cancelled";
  /** Autores, pela ordem das rondas (fixada no início). */
  order: string[];
  /** Por autor: a ordem em que as 3 frases aparecem (índices originais). */
  perm: Record<string, number[]>;
  round: number;
  /** true quando o anfitrião carregou em «Revelar já». */
  forcedReveal: boolean;
  deadline: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** Rondas que contam para a pontuação — fixado ao terminar. */
  countedRounds: number | null;
};

type PlayerRec = {
  username: string;
  name: string;
  joinedAt: number;
  statements: string[] | null;
  truth: number | null;
  /** Carregou em «Tudo pronto». «Editar» volta a false sem perder nada. */
  ready?: boolean;
};

type VoteRec = { c: number; at: number };

type Raw = {
  meta: Meta;
  players: Map<string, PlayerRec>;
  /** ronda → (votante → escolha) */
  votes: Map<number, Map<string, number>>;
};

type ActivePointer = {
  id: string;
  kind: "one-truth";
  hostName: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

async function loadRaw(id: string): Promise<Raw | null> {
  if (!/^[a-z0-9]{6,20}$/.test(id)) return null;
  const hash = await kv.hgetall<Record<string, unknown>>(GAME_KEY(id));
  if (!hash || !hash.meta) return null;
  const meta = hash.meta as Meta;
  const players = new Map<string, PlayerRec>();
  const votes = new Map<number, Map<string, number>>();
  for (const [field, value] of Object.entries(hash)) {
    if (field.startsWith("p:")) {
      const p = value as PlayerRec;
      players.set(p.username, p);
    } else if (field.startsWith("v:")) {
      const [, r, user] = field.split(":");
      const round = Number(r);
      const vote = value as VoteRec;
      if (!Number.isInteger(round) || !user) continue;
      if (!votes.has(round)) votes.set(round, new Map());
      votes.get(round)!.set(user, vote.c);
    }
  }
  return { meta, players, votes };
}

function isReady(p: PlayerRec | undefined): boolean {
  return Boolean(
    p?.ready === true &&
      p.statements?.length === 3 &&
      p.truth !== null &&
      p.truth >= 0 &&
      p.truth <= 2,
  );
}

/** Quem pode votar na ronda `r`: toda a gente na sala menos o autor. */
function votersFor(raw: Raw, round: number): string[] {
  const author = raw.meta.order[round];
  return [...raw.players.keys()].filter((u) => u !== author);
}

function votedIn(raw: Raw, round: number): string[] {
  const inRoom = new Set(raw.players.keys());
  const author = raw.meta.order[round];
  return [...(raw.votes.get(round)?.keys() ?? [])].filter(
    (u) => inRoom.has(u) && u !== author,
  );
}

/** A ronda atual já está revelada? Calculado, nunca gravado (ver topo). */
function roundRevealed(raw: Raw, now: number): boolean {
  const { meta } = raw;
  if (meta.phase !== "playing") return false;
  if (meta.forcedReveal) return true;
  if (meta.deadline !== null && now >= meta.deadline) return true;
  const expected = votersFor(raw, meta.round).length;
  return expected > 0 && votedIn(raw, meta.round).length >= expected;
}

function effectivePhase(raw: Raw, now: number): GamePhase {
  const { phase } = raw.meta;
  if (phase === "playing") return roundRevealed(raw, now) ? "reveal" : "guessing";
  return phase;
}

/** Índice (na ordem mostrada) da frase verdadeira do autor da ronda. */
function displayTruth(raw: Raw, round: number): number | null {
  const author = raw.meta.order[round];
  const entry = raw.players.get(author);
  const perm = raw.meta.perm[author];
  if (!entry || entry.truth === null || !perm) return null;
  return perm.indexOf(entry.truth);
}

function countedRounds(raw: Raw, now: number): number {
  const { meta } = raw;
  if (meta.phase === "final") return meta.countedRounds ?? 0;
  if (meta.phase !== "playing") return 0;
  return meta.round + (roundRevealed(raw, now) ? 1 : 0);
}

type Tally = { score: number; correct: number; fooled: number };

function tallyScores(raw: Raw, rounds: number) {
  const totals = new Map<string, Tally>();
  const get = (u: string) => {
    if (!totals.has(u)) totals.set(u, { score: 0, correct: 0, fooled: 0 });
    return totals.get(u)!;
  };
  for (const u of raw.players.keys()) get(u);
  const deltasByRound: Record<string, number>[] = [];
  for (let r = 0; r < rounds; r++) {
    const author = raw.meta.order[r];
    const truth = displayTruth(raw, r);
    const deltas: Record<string, number> = {};
    if (author && truth !== null) {
      for (const voter of votedIn(raw, r)) {
        const choice = raw.votes.get(r)!.get(voter)!;
        if (choice === truth) {
          get(voter).score += POINTS_CORRECT;
          get(voter).correct += 1;
          deltas[voter] = (deltas[voter] ?? 0) + POINTS_CORRECT;
        } else {
          get(author).score += POINTS_FOOLED;
          get(author).fooled += 1;
          deltas[author] = (deltas[author] ?? 0) + POINTS_FOOLED;
        }
      }
    }
    deltasByRound.push(deltas);
  }
  return { totals, deltasByRound };
}

function displayOf(username: string, fallback?: string) {
  return {
    username,
    name: fallback ?? getEmployeeDisplay(username)?.name ?? username,
    avatar: getTeamAvatar(username),
  };
}

function buildAwards(raw: Raw, rows: FinalRow[], rounds: number): Award[] {
  const awards: Award[] = [];
  const pick = (list: FinalRow[], value: (r: FinalRow) => number, min: number) => {
    const best = Math.max(...list.map(value), -1);
    if (best < min) return null;
    return list.filter((r) => value(r) === best).map((r) => ({ username: r.username, name: r.name, avatar: r.avatar }));
  };
  const detectives = pick(rows, (r) => r.correct, 1);
  if (detectives) {
    const n = Math.max(...rows.map((r) => r.correct));
    awards.push({
      key: "detective",
      title: "Detetive",
      emoji: "🕵️",
      blurb: `Mais verdades descobertas — ${n} ${n === 1 ? "acerto" : "acertos"}.`,
      winners: detectives,
    });
  }
  const authors = new Set(raw.meta.order.slice(0, rounds));
  const authorRows = rows.filter((r) => authors.has(r.username));
  const liars = pick(authorRows, (r) => r.fooled, 1);
  if (liars) {
    const n = Math.max(...authorRows.map((r) => r.fooled));
    awards.push({
      key: "liar",
      title: "Mestre da mentira",
      emoji: "🎭",
      blurb: `Enganou ${n} ${n === 1 ? "pessoa" : "pessoas"} na sua ronda.`,
      winners: liars,
    });
  }
  // Só conta quem teve votos — uma ronda sem palpites não «se deixou topar».
  const votesOn = new Map(
    raw.meta.order.slice(0, rounds).map((u, r) => [u, votedIn(raw, r).length]),
  );
  const openBooks = authorRows.filter((r) => r.fooled === 0 && (votesOn.get(r.username) ?? 0) > 0);
  if (openBooks.length && openBooks.length < authorRows.length) {
    awards.push({
      key: "open-book",
      title: "Livro aberto",
      emoji: "📖",
      blurb: "Toda a gente adivinhou a verdade — não há segredos aqui.",
      winners: openBooks.map((r) => ({ username: r.username, name: r.name, avatar: r.avatar })),
    });
  }
  return awards;
}

/** A vista da sala para uma pessoa — o único caminho do estado para o browser. */
export function buildView(
  raw: Raw,
  viewer: { username: string; name: string; isAdmin: boolean },
  now = Date.now(),
): GameView {
  const { meta } = raw;
  const phase = effectivePhase(raw, now);
  const rounds = countedRounds(raw, now);
  const { totals, deltasByRound } = tallyScores(raw, rounds);
  const started = meta.phase !== "lobby";
  const order = new Set(meta.order);

  const players: PlayerView[] = [...raw.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      ...displayOf(p.username, p.name),
      ready: isReady(p),
      hasRound: started ? order.has(p.username) : isReady(p),
      score: totals.get(p.username)?.score ?? 0,
    }));

  const mine = raw.players.get(viewer.username);
  let current: GameView["current"] = null;
  if (phase === "guessing" || phase === "reveal") {
    const r = meta.round;
    const author = meta.order[r];
    const entry = raw.players.get(author);
    const perm = meta.perm[author] ?? [0, 1, 2];
    const revealed = phase === "reveal";
    const voted = votedIn(raw, r);
    current = {
      index: r,
      author: displayOf(author, entry?.name),
      statements: perm.map((i) => entry?.statements?.[i] ?? "—"),
      voted,
      expectedVoters: votersFor(raw, r).length,
      myVote: raw.votes.get(r)?.get(viewer.username) ?? null,
      truth: revealed ? displayTruth(raw, r) : null,
      votes: revealed
        ? voted.map((u) => ({ username: u, choice: raw.votes.get(r)!.get(u)! }))
        : null,
      deltas: revealed ? deltasByRound[r] ?? {} : null,
      myTruth: viewer.username === author ? displayTruth(raw, r) : null,
    };
  }

  let final: GameView["final"] = null;
  if (phase === "final") {
    const ranking: FinalRow[] = [...raw.players.values()]
      .map((p) => {
        const t = totals.get(p.username) ?? { score: 0, correct: 0, fooled: 0 };
        return { ...displayOf(p.username, p.name), ...t };
      })
      .sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name, "pt"));
    final = { ranking, awards: buildAwards(raw, ranking, rounds) };
  }

  return {
    id: meta.id,
    kind: meta.kind,
    phase,
    hostName: meta.hostName,
    createdAt: meta.createdAt,
    roundSeconds: meta.roundSeconds,
    deadline: phase === "guessing" ? meta.deadline : null,
    serverNow: now,
    totalRounds: started ? meta.order.length : players.filter((p) => p.ready).length,
    me: {
      username: viewer.username,
      name: viewer.name,
      joined: Boolean(mine),
      canHost: viewer.isAdmin,
    },
    players,
    myEntry: mine ? { statements: mine.statements ?? ["", "", ""], truth: mine.truth } : null,
    current,
    final,
  };
}

export async function getGameView(
  id: string,
  viewer: { username: string; name: string; isAdmin: boolean },
): Promise<GameView | null> {
  const raw = await loadRaw(id);
  return raw ? buildView(raw, viewer) : null;
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

export async function getActiveGame(): Promise<ActivePointer | null> {
  try {
    return (await kv.get<ActivePointer>(ACTIVE_KEY)) ?? null;
  } catch (err) {
    console.error("KV minigames:active read failed:", err);
    return null;
  }
}

export async function getActiveSummary(): Promise<GameSummary | null> {
  const pointer = await getActiveGame();
  if (!pointer) return null;
  const raw = await loadRaw(pointer.id).catch(() => null);
  if (!raw || raw.meta.phase === "final" || raw.meta.phase === "cancelled") return null;
  return {
    id: raw.meta.id,
    kind: raw.meta.kind,
    phase: effectivePhase(raw, Date.now()),
    hostName: raw.meta.hostName,
    createdAt: raw.meta.createdAt,
    finishedAt: null,
    players: raw.players.size,
    winner: null,
  };
}

export async function listHistory(): Promise<GameSummary[]> {
  try {
    return (await kv.lrange<GameSummary>(HISTORY_KEY, 0, HISTORY_MAX - 1)) ?? [];
  } catch (err) {
    console.error("KV minigames:history read failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------------

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newId(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => (b % 36).toString(36))
    .join("");
  return `${Date.now().toString(36)}${rand}`;
}

export async function createGame(
  host: { username: string; name: string },
  roundSeconds: unknown,
): Promise<string> {
  const seconds = ROUND_SECONDS_CHOICES.find((s) => s === roundSeconds);
  if (seconds === undefined) throw new GameError("Tempo por ronda inválido.");
  const active = await getActiveSummary();
  if (active) {
    throw new GameError(
      "Já há uma sala aberta — termina-a ou cancela-a antes de abrir outra.",
      409,
    );
  }
  const id = newId();
  const meta: Meta = {
    id,
    kind: "one-truth",
    createdAt: new Date().toISOString(),
    createdBy: host.username,
    hostName: host.name,
    roundSeconds: seconds,
    phase: "lobby",
    order: [],
    perm: {},
    round: 0,
    forcedReveal: false,
    deadline: null,
    startedAt: null,
    finishedAt: null,
    countedRounds: null,
  };
  const me: PlayerRec = {
    username: host.username,
    name: host.name,
    joinedAt: Date.now(),
    statements: null,
    truth: null,
  };
  await kv.hset(GAME_KEY(id), { meta, [`p:${host.username}`]: me });
  await kv.expire(GAME_KEY(id), GAME_TTL_SECONDS);
  const pointer: ActivePointer = { id, kind: "one-truth", hostName: host.name, createdAt: meta.createdAt };
  await kv.set(ACTIVE_KEY, pointer, { ex: ACTIVE_TTL_SECONDS });
  return id;
}

async function mustLoad(id: string): Promise<Raw> {
  const raw = await loadRaw(id);
  if (!raw) throw new GameError("Esta sala já não existe.", 404);
  return raw;
}

export async function joinGame(id: string, who: { username: string; name: string }) {
  const raw = await mustLoad(id);
  if (raw.meta.phase === "final" || raw.meta.phase === "cancelled") {
    throw new GameError("Este jogo já terminou.", 409);
  }
  const rec: PlayerRec = {
    username: who.username,
    name: who.name,
    joinedAt: Date.now(),
    statements: null,
    truth: null,
  };
  // hsetnx: entrar duas vezes (dois separadores) não apaga as frases.
  await kv.hsetnx(GAME_KEY(id), `p:${who.username}`, rec);
}

export async function leaveGame(id: string, username: string) {
  const raw = await mustLoad(id);
  if (raw.meta.phase !== "lobby") {
    throw new GameError("O jogo já começou — já não dá para sair da sala.", 409);
  }
  await kv.hdel(GAME_KEY(id), `p:${username}`);
}

export async function saveEntry(
  id: string,
  username: string,
  statementsIn: unknown,
  truthIn: unknown,
) {
  const raw = await mustLoad(id);
  if (raw.meta.phase !== "lobby") {
    throw new GameError("O jogo já começou — as frases estão fechadas.", 409);
  }
  const me = raw.players.get(username);
  if (!me) throw new GameError("Entra na sala primeiro.", 409);
  if (!Array.isArray(statementsIn) || statementsIn.length !== 3) {
    throw new GameError("São precisas exatamente 3 frases.");
  }
  const statements = statementsIn.map((s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : ""));
  for (const s of statements) {
    if (s.length < STATEMENT_MIN) throw new GameError(`Cada frase precisa de pelo menos ${STATEMENT_MIN} caracteres.`);
    if (s.length > STATEMENT_MAX) throw new GameError(`Cada frase tem no máximo ${STATEMENT_MAX} caracteres.`);
  }
  if (new Set(statements.map((s) => s.toLowerCase())).size !== 3) {
    throw new GameError("As 3 frases têm de ser diferentes.");
  }
  const truth = typeof truthIn === "number" && [0, 1, 2].includes(truthIn) ? truthIn : null;
  if (truth === null) throw new GameError("Marca qual das 3 é a verdade.");
  await kv.hset(GAME_KEY(id), { [`p:${username}`]: { ...me, statements, truth, ready: true } });
}

/** Volta a pôr as frases em rascunho (deixa de estar «pronto»). */
export async function unreadyEntry(id: string, username: string) {
  const raw = await mustLoad(id);
  if (raw.meta.phase !== "lobby") throw new GameError("O jogo já começou.", 409);
  const me = raw.players.get(username);
  if (!me) return;
  await kv.hset(GAME_KEY(id), { [`p:${username}`]: { ...me, ready: false } });
}

export async function castVote(id: string, username: string, roundIn: unknown, choiceIn: unknown) {
  const raw = await mustLoad(id);
  const now = Date.now();
  if (effectivePhase(raw, now) !== "guessing") {
    throw new GameError("Esta ronda já foi revelada.", 409);
  }
  if (roundIn !== raw.meta.round) throw new GameError("A ronda mudou entretanto.", 409);
  if (!raw.players.has(username)) throw new GameError("Entra na sala primeiro.", 409);
  if (raw.meta.order[raw.meta.round] === username) {
    throw new GameError("Esta ronda é tua — aqui só fazes cara de poker.", 409);
  }
  if (typeof choiceIn !== "number" || ![0, 1, 2].includes(choiceIn)) {
    throw new GameError("Palpite inválido.");
  }
  const vote: VoteRec = { c: choiceIn, at: now };
  await kv.hset(GAME_KEY(id), { [`v:${raw.meta.round}:${username}`]: vote });
}

async function writeMeta(id: string, meta: Meta) {
  await kv.hset(GAME_KEY(id), { meta });
}

export type HostAction = "start" | "reveal" | "next" | "finish" | "cancel" | "kick";

export async function hostAction(id: string, action: unknown, target?: unknown) {
  const raw = await mustLoad(id);
  const meta = { ...raw.meta };
  const now = Date.now();
  const phase = effectivePhase(raw, now);

  switch (action) {
    case "start": {
      if (meta.phase !== "lobby") throw new GameError("O jogo já começou.", 409);
      const authors = [...raw.players.values()].filter(isReady).map((p) => p.username);
      if (authors.length < 2) {
        throw new GameError("São precisos pelo menos 2 jogadores com as frases prontas.");
      }
      meta.phase = "playing";
      meta.order = shuffle(authors);
      meta.perm = Object.fromEntries(authors.map((u) => [u, shuffle([0, 1, 2])]));
      meta.round = 0;
      meta.forcedReveal = false;
      meta.deadline = meta.roundSeconds ? now + ROUND_INTRO_MS + meta.roundSeconds * 1000 : null;
      meta.startedAt = new Date(now).toISOString();
      await writeMeta(id, meta);
      return;
    }
    case "reveal": {
      if (phase !== "guessing") throw new GameError("Não há nada por revelar.", 409);
      meta.forcedReveal = true;
      await writeMeta(id, meta);
      return;
    }
    case "next": {
      if (phase !== "reveal") throw new GameError("Revela a ronda antes de avançar.", 409);
      if (meta.round + 1 >= meta.order.length) {
        throw new GameError("Era a última ronda — segue para o pódio.", 409);
      }
      meta.round += 1;
      meta.forcedReveal = false;
      meta.deadline = meta.roundSeconds ? now + ROUND_INTRO_MS + meta.roundSeconds * 1000 : null;
      await writeMeta(id, meta);
      return;
    }
    case "finish": {
      if (meta.phase !== "playing") throw new GameError("O jogo não está a decorrer.", 409);
      meta.countedRounds = countedRounds(raw, now);
      meta.phase = "final";
      meta.finishedAt = new Date(now).toISOString();
      meta.deadline = null;
      await writeMeta(id, meta);
      const after = buildView({ ...raw, meta }, { username: "", name: "", isAdmin: false }, now);
      const top = after.final?.ranking[0] ?? null;
      const summary: GameSummary = {
        id,
        kind: meta.kind,
        phase: "final",
        hostName: meta.hostName,
        createdAt: meta.createdAt,
        finishedAt: meta.finishedAt,
        players: raw.players.size,
        winner: top && top.score > 0 ? { name: top.name, avatar: top.avatar, score: top.score } : null,
      };
      await kv.lpush(HISTORY_KEY, summary);
      await kv.ltrim(HISTORY_KEY, 0, HISTORY_MAX - 1);
      await clearActive(id);
      return;
    }
    case "cancel": {
      if (meta.phase === "final" || meta.phase === "cancelled") return;
      meta.phase = "cancelled";
      meta.finishedAt = new Date(now).toISOString();
      meta.deadline = null;
      await writeMeta(id, meta);
      await clearActive(id);
      return;
    }
    case "kick": {
      const user = typeof target === "string" ? target : "";
      if (!raw.players.has(user)) return;
      if (meta.phase !== "lobby" && meta.order.includes(user)) {
        throw new GameError("Essa pessoa já tem ronda no jogo — já não dá para a tirar.", 409);
      }
      await kv.hdel(GAME_KEY(id), `p:${user}`);
      return;
    }
    default:
      throw new GameError("Ação desconhecida.");
  }
}

async function clearActive(id: string) {
  const pointer = await getActiveGame();
  if (pointer?.id === id) await kv.del(ACTIVE_KEY);
}
