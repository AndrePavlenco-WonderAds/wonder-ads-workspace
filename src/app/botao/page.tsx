// /botao — «Acionar o Botão» (v80.34).
//
// O consultor escreve o pedido de apoio à direção em 3 passos (cliente ou
// problema interno → o problema em 2 linhas → 1–2 sugestões) e envia para
// análise ou marca reunião. A direção (SuperAdmins) vê aqui a caixa com
// todos os pedidos e fecha-os com uma resposta. Com «Ver como», a página
// mostra o lado da pessoa vista, só para ler (o middleware recusa escritas).

import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { BotaoForm } from "@/components/botao/botao-form";
import { BotaoInbox } from "@/components/botao/botao-inbox";
import { getCurrentEmployee } from "@/lib/auth/server";
import { formatDateTime } from "@/lib/dates";
import { botaoClientLabel, type BotaoRequest } from "@/lib/botao/shared";
import { botaoClientsOf, listBotaoRequests, listBotaoRequestsFor } from "@/lib/botao/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Acionar o Botão — Wonder Ads Workspace",
};

function Header({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: ReactNode }) {
  return (
    <header className="animate-fade-up mt-2 max-w-2xl">
      <p className="readout text-white/35">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        <span className="brand-gradient-text">{title}</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/60">{lead}</p>
    </header>
  );
}

function History({ requests }: { requests: BotaoRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-[18px] font-semibold text-white">Os teus pedidos</h2>
      <ul className="mt-4 space-y-2.5">
        {requests.map((r) => (
          <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-white/45">
              <span>{formatDateTime(r.createdAt)}</span>
              <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-white/75">{botaoClientLabel(r)}</span>
              {r.meeting && (
                <span className="inline-flex items-center gap-1 text-[#c4a6ff]">
                  <CalendarClock className="h-3.5 w-3.5" /> Com reunião
                </span>
              )}
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                  r.status === "resolvido" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
                }`}
              >
                {r.status === "resolvido" ? "Resolvido" : "Em análise"}
              </span>
            </div>
            <p className="mt-2 text-[15px] font-medium leading-snug text-white">{r.problem}</p>
            <ol className="mt-1.5 space-y-1">
              {r.solutions.map((s, i) => (
                <li key={i} className="text-[13.5px] leading-relaxed text-white/60">
                  <span className="text-white/40">Sugestão {i + 1}:</span> {s}
                </li>
              ))}
            </ol>
            {r.status === "resolvido" && r.reply && (
              <p className="mt-3 rounded-xl bg-emerald-400/[0.07] px-4 py-2.5 text-[13.5px] leading-relaxed text-white/75">
                <span className="font-semibold text-emerald-200">{r.resolvedByName ?? "Direção"}:</span> {r.reply}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BotaoPage() {
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  if (employee.viewerOf || employee.docsOnly) {
    return (
      <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
        <Header eyebrow="Apoio" title="Acionar o Botão" lead="Este perfil não pode acionar o botão." />
      </PageShell>
    );
  }

  if (employee.isAdmin) {
    const all = await listBotaoRequests();
    return (
      <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
        <Header
          eyebrow="Apoio · direção"
          title="Botões acionados"
          lead="Cada pedido traz o cliente, o problema em 2 linhas e as sugestões de solução do consultor. Responde e fecha: a resposta chega-lhe aqui e no sino."
        />
        <div className="mt-8 pb-12">
          <BotaoInbox requests={all} />
        </div>
      </PageShell>
    );
  }

  const [clients, mine] = await Promise.all([botaoClientsOf(employee.name), listBotaoRequestsFor(employee.username)]);
  const firstName = employee.name.split(" ")[0] ?? employee.name;

  return (
    <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
      <Header
        eyebrow="Apoio"
        title="Acionar o Botão"
        lead="Antes de pedir ajuda, põe o problema por escrito: de quem é, o que se passa em 2 linhas e o que farias para o resolver. Depois envias para análise ou marcas reunião."
      />
      <div className="mt-8 max-w-3xl pb-12">
        <BotaoForm clients={clients} firstName={firstName} />
        <History requests={mine} />
      </div>
    </PageShell>
  );
}
