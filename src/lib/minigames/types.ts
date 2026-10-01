// Mini-games — tipos partilhados entre o servidor e o browser.
//
// Só entra aqui o que pode viajar para o cliente: a vista de uma sala já vem
// recortada pelo servidor (ver `buildView` em two-truths-store.ts). A frase
// verdadeira de cada pessoa NUNCA está nesta vista antes da revelação da
// ronda dela — nem escondida, nem num campo que a UI ignore.

export type MinigameKind = "one-truth";

export const MINIGAME_LABEL: Record<MinigameKind, string> = {
  "one-truth": "Uma verdade, duas mentiras",
};

/** Fases como o cliente as vê. `reveal` é também o que acontece sozinho
 *  quando toda a gente votou ou o tempo da ronda acabou. */
export type GamePhase = "lobby" | "guessing" | "reveal" | "final" | "cancelled";

/** Segundos por ronda que o anfitrião pode escolher; null = sem limite. */
export const ROUND_SECONDS_CHOICES = [30, 60, 90, null] as const;
export type RoundSeconds = (typeof ROUND_SECONDS_CHOICES)[number];

export const STATEMENT_MIN = 6;
export const STATEMENT_MAX = 160;

/** Pontos: quem acerta na verdade ganha POINTS_CORRECT; o autor da ronda
 *  ganha POINTS_FOOLED por cada pessoa que enganou. */
export const POINTS_CORRECT = 100;
export const POINTS_FOOLED = 50;

export type PlayerView = {
  username: string;
  name: string;
  avatar: string | null;
  /** Escreveu as 3 frases e marcou a verdade. */
  ready: boolean;
  /** Tem ronda própria (entrou no jogo pronto). Só faz sentido após o início. */
  hasRound: boolean;
  score: number;
};

export type RoundVote = { username: string; choice: number };

export type CurrentRoundView = {
  index: number;
  author: { username: string; name: string; avatar: string | null };
  /** As 3 frases já baralhadas — a ordem é a mesma para toda a gente. */
  statements: string[];
  /** Quem já votou (sem dizer em quê, até à revelação). */
  voted: string[];
  /** Quantas pessoas podem votar nesta ronda (todos menos o autor). */
  expectedVoters: number;
  myVote: number | null;
  /** Só na revelação. */
  truth: number | null;
  votes: RoundVote[] | null;
  /** Pontos ganhos nesta ronda, por username — só na revelação. */
  deltas: Record<string, number> | null;
  /** Para o autor: qual é a verdade dele (ele já sabe). */
  myTruth: number | null;
};

export type FinalRow = {
  username: string;
  name: string;
  avatar: string | null;
  score: number;
  /** Palpites certos. */
  correct: number;
  /** Pessoas enganadas na ronda própria. */
  fooled: number;
};

export type Award = {
  key: "detective" | "liar" | "open-book";
  title: string;
  emoji: string;
  blurb: string;
  winners: { username: string; name: string; avatar: string | null }[];
};

export type GameView = {
  id: string;
  kind: MinigameKind;
  phase: GamePhase;
  hostName: string;
  createdAt: string;
  roundSeconds: number | null;
  /** Prazo da ronda atual em ms (epoch), ou null sem limite. */
  deadline: number | null;
  /** Relógio do servidor — o cliente corrige o desvio do seu. */
  serverNow: number;
  totalRounds: number;
  me: { username: string; name: string; joined: boolean; canHost: boolean };
  players: PlayerView[];
  /** As frases de quem está a ver (para editar no lobby). */
  myEntry: { statements: string[]; truth: number | null } | null;
  current: CurrentRoundView | null;
  final: { ranking: FinalRow[]; awards: Award[] } | null;
};

/** Cartão de uma sala no hub / no aviso do header. */
export type GameSummary = {
  id: string;
  kind: MinigameKind;
  phase: GamePhase;
  hostName: string;
  createdAt: string;
  finishedAt: string | null;
  players: number;
  winner: { name: string; avatar: string | null; score: number } | null;
};
