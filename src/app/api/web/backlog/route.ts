// Generate a Slack-ready weekly backlog for the Web department.
//
// Gathers every project + its most recent comments/notes and asks Claude
// to compose a Portuguese, Slack-formatted backlog grouped by client,
// with @mentions and status emojis — the same shape the team already
// posts by hand each week. The route prepends a "Backlog web DD.MM"
// title and appends the fixed bilingual footer so structure is
// deterministic; only the per-project body is model-generated. The
// consultant can edit the result before copying.

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  accessibleDepts,
  getMentionName,
  linkifySlackMentions,
} from "@/lib/auth/credentials";
import {
  getAllProjects,
  webStorageConfigured,
  WEB_STATUS_LABEL,
  type WebProject,
} from "@/lib/web-projects-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

// Pinned bilingual footer the team appends to every backlog thread.
const FOOTER = `:warning: Attention all colleagues — please react with :eyes: once you have reviewed your items (mandatory).
 Any conversations or requests should be sent as a reply to this thread and not in the channel. Thank you @channel.

:warning: :flag-pt: Atenção a todos os colegas — por favor, reajam com :eyes: após verificarem os vossos pontos (obrigatório).
 Quaisquer conversas ou pedidos devem ser enviados como resposta a esta thread e não no canal. Obrigado @channel`;

const SYSTEM = `És o assistente do Departamento Web da Wonder Ads (agência de Health & Wellness em Lisboa). Escreves o "backlog web" semanal que é publicado no Slack.

O backlog é SEMPRE em português de Portugal e está pronto a colar no Slack (usa códigos de emoji do Slack como :white_check_mark:, não emojis unicode).

REGRAS DE FORMATO (segue exatamente):
- Agrupa por cliente. O nome do cliente é uma linha isolada (sem bullet) e SEMPRE a *negrito* (envolve-o em asteriscos, ex.: *Clínica Fernando Almeida*), seguida das linhas dos projetos/páginas desse cliente.
- Cada projeto/página é UMA linha: descreve a página/tarefa, uma seta "->" ou "-", a(s) menção(ões) @Nome Completo de quem é responsável, uma frase curta sobre o estado mais recente (baseada nos comentários/notas mais recentes), e termina com UM emoji de estado.
- Usa as menções com o NOME COMPLETO fornecido (ex.: @Mike Nobre, @Gustavo Rotini, @Renan Alves, @André Pavlenco). Nunca inventes nomes.
- Deixa uma linha em branco entre clientes.

LEGENDA DE EMOJIS (escolhe com base no estado + comentários):
- :white_check_mark: — concluído / já está live / feito
- :large_green_circle: — a decorrer bem / a aguardar feedback do cliente / no bom caminho
- :large_yellow_circle: — em desenvolvimento / em progresso / com data para ir live
- :red_circle: — precisa de ação urgente / bloqueado / colocar live hoje
- :double_vertical_bar: — em pausa / em espera de outro projeto
- :rotating_light: — crítico / projeto suspenso (ex.: a aguardar pagamento)

NÃO incluas título nem rodapé — apenas o corpo agrupado por cliente. Sê conciso e fiel aos comentários reais; não inventes progresso que não está nas notas.`;

function buildProjectContext(projects: WebProject[]): string {
  const blocks: string[] = [];
  for (const p of projects) {
    const recent = [...p.comments]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map(
        (c) =>
          `    - (${new Date(c.createdAt).toLocaleDateString("pt-PT")}) ${c.authorName}: ${c.body}`,
      )
      .join("\n");
    const lines = [
      `PROJETO: ${p.name}`,
      `  Cliente: ${p.clientName || "—"}`,
      `  Estado/coluna: ${WEB_STATUS_LABEL[p.status]}`,
      `  Responsável (menção Slack a usar): @${getMentionName(p.assigneeUsername)}`,
      `  Prioridade: ${p.priority}`,
    ];
    if (p.assets.notes?.trim())
      lines.push(`  Notas: ${p.assets.notes.trim().slice(0, 400)}`);
    if (recent) lines.push(`  Comentários recentes:\n${recent}`);
    else lines.push(`  Comentários recentes: (nenhum)`);
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

export async function POST() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json(
      { error: "KV storage is not configured." },
      { status: 503 },
    );
  }

  const projects = await getAllProjects();
  // Title date — DD.MM (Lisbon-style as in the example "Backlog web 09.06").
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  // Bold title. (Slack mrkdwn has no underline token — true underline
  // can't survive a copy/paste; bold is the strongest emphasis Slack
  // renders from pasted text.)
  const title = `*Backlog web ${dd}.${mm}*`;

  if (projects.length === 0) {
    return NextResponse.json({
      backlog: `${title}\n\n(Sem projetos no quadro ainda.)\n\n${FOOTER}`,
    });
  }

  // Sort: active work first (in_progress, client_feedback, migration),
  // then negotiation, then done — so the most relevant lines lead.
  const order: Record<string, number> = {
    in_progress: 0,
    client_feedback: 1,
    migration: 2,
    negotiation: 3,
    done: 4,
  };
  const sorted = [...projects].sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9),
  );

  let body: string;
  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      system: SYSTEM,
      prompt: `Compõe o corpo do backlog web a partir dos projetos abaixo. Agrupa por cliente, uma linha por projeto/página, com a menção do responsável e o emoji de estado adequado segundo os comentários mais recentes.\n\n${buildProjectContext(sorted)}`,
    });
    body = text.trim();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Falha ao gerar o backlog: ${err.message}`
            : "Falha ao gerar o backlog.",
      },
      { status: 500 },
    );
  }

  // Turn "@Full Name" into real Slack mentions (<@MEMBERID>) for anyone
  // whose member id is configured — so pasting auto-links them.
  const backlog = linkifySlackMentions(`${title}\n\n${body}\n\n${FOOTER}`);
  return NextResponse.json({ backlog });
}
