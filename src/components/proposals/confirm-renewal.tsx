"use client";

// O fecho da proposta: um painel escuro com o resumo, três passos e o botão
// «Confirmar a renovação». O clique faz duas coisas: regista a confirmação
// na app (POST /api/proposals/<slug>/confirm → notificação no sino do
// SuperAdmin) e abre o email para o André já preenchido. Se o registo
// falhar, o email abre na mesma — a confirmação nunca fica presa num erro
// de rede nosso.

import { useState } from "react";
import { CalendarDays, Check, Loader2, Mail, Rocket, Sparkles } from "lucide-react";
import { BRAND_GRADIENT } from "./proposal-primitives";

type Props = {
  proposalSlug: string;
  clientName: string;
  toEmail: string;
  ccEmail: string;
  consultantFirst: string;
  price: string;
  period: string;
};

export function ConfirmRenewal({
  proposalSlug,
  clientName,
  toEmail,
  ccEmail,
  consultantFirst,
  price,
  period,
}: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  const confirmHref = `mailto:${toEmail}?cc=${encodeURIComponent(ccEmail)}&subject=${encodeURIComponent(
    `${clientName} — confirmação da renovação (${period})`,
  )}&body=${encodeURIComponent(
    `Olá André,\n\nConfirmamos a renovação da parceria com a WonderAds por 6 meses (${period}), nas condições da proposta (${price}, CRM incluído).\n\nCumprimentos,\n${clientName}`,
  )}`;
  const callHref = `mailto:${toEmail}?cc=${encodeURIComponent(ccEmail)}&subject=${encodeURIComponent(
    `${clientName} — marcar a primeira call (fim de setembro)`,
  )}&body=${encodeURIComponent(
    `Olá André,\n\nGostávamos de marcar a primeira call de acompanhamento para o fim de setembro. Disponibilidade:\n\n- \n- \n\nCumprimentos,\n${clientName}`,
  )}`;

  async function confirm() {
    if (state !== "idle") return;
    setState("sending");
    try {
      await fetch(`/api/proposals/${proposalSlug}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "proposal-page" }),
      });
    } catch {
      /* o email abre na mesma */
    }
    setState("done");
    window.location.href = confirmHref;
  }

  const steps = [
    { Icon: Check, title: "Confirmar hoje", text: "Um clique. O André recebe o email e a notificação na hora." },
    { Icon: Rocket, title: "Arranque em setembro", text: "Medição e CRM ligados, baselines fixadas, Pilates Clínico e RPG publicadas." },
    { Icon: CalendarDays, title: "1.ª call no fim de setembro", text: "Balanço do Mês 1 e calendário até ao checkpoint de novembro." },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0B0C12] px-6 py-8 text-white sm:px-10 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: BRAND_GRADIENT }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ background: BRAND_GRADIENT }} />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
            <Sparkles className="h-3 w-3" /> Renovação · {period}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">{price}</span>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">CRM incluído · 0 €</span>
        </div>
        <h3 className="mt-5 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          Pronto para levar a Fisio Restelo ao topo?
        </h3>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/65">
          Seis meses, quatro focos, um só clique para arrancar. O primeiro pico de procura do ano é em setembro — quanto mais cedo confirmar, mais dele apanhamos.
        </p>

        <ol className="mt-7 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: BRAND_GRADIENT }}>
                  <s.Icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Passo {i + 1}</span>
              </div>
              <p className="mt-2.5 text-[15px] font-semibold">{s.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/60">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="no-print mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={confirm}
            disabled={state === "sending"}
            className={`pr-pulse inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-80 ${state === "done" ? "pr-pulse-off" : ""}`}
            style={{ background: state === "done" ? "#059669" : BRAND_GRADIENT }}
          >
            {state === "sending" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === "done" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {state === "done" ? "Renovação confirmada — obrigado!" : state === "sending" ? "A registar…" : "Confirmar a renovação"}
          </button>
          <a
            href={callHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-[14px] font-semibold text-white transition hover:bg-white/10"
          >
            <CalendarDays className="h-4 w-4" /> Marcar a call de fim de setembro
          </a>
        </div>
        {state === "done" ? (
          <p className="mt-4 text-[13px] text-emerald-200">
            Registado. O email para {toEmail} abriu no seu programa de correio — basta enviar. O André e a {consultantFirst} respondem hoje.
          </p>
        ) : (
          <p className="mt-4 text-[12.5px] text-white/45">
            Ao confirmar, abre um email já escrito para {toEmail} e o André recebe a notificação na app. Dúvidas? {consultantFirst} — {ccEmail}
          </p>
        )}
      </div>
    </div>
  );
}
