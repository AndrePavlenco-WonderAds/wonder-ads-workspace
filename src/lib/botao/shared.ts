// «Acionar o Botão» (v80.34) — o pedido de apoio à direção, por escrito.
//
// Antes (v77.89) o item do menu abria só a marcação no Google Calendar. Agora
// tem página própria (/botao) e o consultor escreve primeiro:
//   1. de que cliente é o problema (só os dele) ou «Problema interno»;
//   2. o problema em 2 linhas, no máximo — quanto mais curto e desconstruído,
//      mais fácil é ver que o consegue resolver;
//   3. 1 ou 2 sugestões de solução.
// Depois envia só isto para análise, ou envia e marca reunião (a marcação do
// Google Calendar abre embutida na página).
//
// Partilhado entre o browser e o servidor: a validação é a mesma dos dois
// lados; o servidor é a fonte de verdade.

/** «2 linhas» numa caixa de texto da largura da página. Sem quebras de
 *  linha: o problema é uma frase, não um texto. */
export const BOTAO_PROBLEM_MAX = 180;
export const BOTAO_SOLUTION_MAX = 180;
export const BOTAO_REPLY_MAX = 600;
export const BOTAO_MAX_SOLUTIONS = 2;

/** O valor do passo 1 quando o problema não é de um cliente. */
export const BOTAO_INTERNAL = "interno";

/** A página de marcações do André (a mesma do item antigo do menu). */
export const BOTAO_BOOKING_URL = "https://calendar.app.google/v7aHJquTD3KkWeKBA";
/** A mesma página em modo embutido — o link curto acima redireciona para
 *  este agendamento; com `gv=true` o Google deixa-a viver num iframe. */
export const BOTAO_BOOKING_EMBED_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ042tQmzKxgm90tJ4nPMY8yxLiC4B_jvcr3lyNLKNwdmbcr4-B1dMerOvTKeSnnpJvulaQ2xNZF?gv=true";

export type BotaoStatus = "novo" | "resolvido";

export type BotaoClientOption = { slug: string; title: string; icon: string | null };

export type BotaoRequest = {
  id: string;
  username: string;
  name: string;
  dept: string;
  /** null = «Problema interno». */
  client: { slug: string; title: string } | null;
  problem: string;
  solutions: string[];
  /** O consultor escolheu «Marcar reunião» em vez de só enviar. */
  meeting: boolean;
  createdAt: number;
  status: BotaoStatus;
  reply: string | null;
  resolvedAt: number | null;
  resolvedByName: string | null;
};

/** Uma frase: sem quebras de linha nem espaços repetidos. */
export function oneLine(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export type BotaoDraft = {
  client: string;
  problem: string;
  solutions: string[];
};

/** null quando o rascunho está pronto a enviar; senão, o que falta. */
export function validateBotaoDraft(d: BotaoDraft): string | null {
  if (!d.client) return "Escolhe o cliente ou «Problema interno».";
  if (oneLine(d.problem, BOTAO_PROBLEM_MAX).length < 10) return "Descreve o problema (pelo menos 10 caracteres).";
  const sols = d.solutions.map((s) => oneLine(s, BOTAO_SOLUTION_MAX)).filter(Boolean);
  if (sols.length === 0) return "Escreve pelo menos uma sugestão de solução.";
  if (sols.length > BOTAO_MAX_SOLUTIONS) return "No máximo duas sugestões.";
  return null;
}

export function botaoClientLabel(r: Pick<BotaoRequest, "client">): string {
  return r.client ? r.client.title : "Problema interno";
}
