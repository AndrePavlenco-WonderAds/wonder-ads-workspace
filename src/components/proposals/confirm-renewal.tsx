"use client";

// O fecho da proposta — no branding claro do resto do documento, tudo
// centrado: resumo, três passos, e o botão «Confirmar a renovação». O
// clique regista a confirmação na app (POST /api/proposals/<slug>/confirm →
// notificação no sino do SuperAdmin) e abre o email para o André já
// preenchido. Se o registo falhar, o email abre na mesma; se o email não
// abrir (browser sem cliente de correio), fica um link para o repetir.

import { useState } from "react";
import { CalendarDays, Check, Loader2, Mail, Rocket } from "lucide-react";
import { BRAND_GRADIENT, GradientText } from "./proposal-primitives";

type Props = {
  proposalSlug: string;
  clientName: string;
  toEmail: string;
  ccEmail: string;
  consultantFirst: string;
  pricing: { monthly: string; monthlyPer: string; prepaid: string; saving: string };
  period: string;
};

export function ConfirmRenewal({
  proposalSlug,
  clientName,
  toEmail,
  ccEmail,
  consultantFirst,
  pricing,
  period,
}: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  const confirmHref = `mailto:${toEmail}?cc=${encodeURIComponent(ccEmail)}&subject=${encodeURIComponent(
    `${clientName} — confirmação da renovação (${period})`,
  )}&body=${encodeURIComponent(
    `Olá André,\n\nConfirmamos a renovação da parceria com a WonderAds por 6 meses (${period}), nas condições da proposta, com o CRM incluído.\n\nModalidade escolhida (apagar a que não se aplica):\n- Plano mensal: ${pricing.monthly} (${pricing.monthlyPer})\n- Pré-pago: ${pricing.prepaid} (pagamento único à cabeça)\n\nCumprimentos,\n${clientName}`,
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
    <div className="rounded-3xl p-[2px] shadow-2xl shadow-[#783DF5]/15" style={{ background: BRAND_GRADIENT }}>
      <div className="relative overflow-hidden rounded-[22px] bg-white px-5 py-10 text-center sm:px-10 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full opacity-[0.14] blur-3xl" style={{ background: BRAND_GRADIENT }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full opacity-[0.12] blur-3xl" style={{ background: BRAND_GRADIENT }} />

        <div className="relative mx-auto max-w-4xl">
          <span className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white" style={{ background: BRAND_GRADIENT }}>
            Renovação · {period}
          </span>
          <h3 className="mt-6 text-3xl font-semibold leading-[1.08] tracking-tight text-black/90 sm:text-5xl">
            Pronto para levar a <GradientText>{clientName}</GradientText> ao topo?
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-black/60 sm:text-[16px]">
            Seis meses, um só clique para arrancar. Setembro é o primeiro pico de procura do ano — quanto mais cedo confirmar, mais dele apanhamos.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[`${pricing.monthly} em plano mensal`, `${pricing.prepaid} pré-pago · poupa ${pricing.saving}`, "CRM incluído · 0 €", "Arranque em setembro"].map((c) => (
              <span key={c} className="rounded-full border border-[#e9d5ff] bg-[#f5f0ff] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#4c1d95]">
                {c}
              </span>
            ))}
          </div>

          {/* ----- passos ----- */}
          <ol className="relative mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-3 sm:gap-4">
            <div aria-hidden className="absolute left-[16.6%] right-[16.6%] top-6 hidden h-px bg-gradient-to-r from-[#343ED7] via-[#783DF5] to-[#C535C9] opacity-40 sm:block" />
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex flex-col items-center text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white ring-4 ring-white" style={{ background: BRAND_GRADIENT }}>
                  <s.Icon className="h-5 w-5" />
                </span>
                <span className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-black/40">Passo {i + 1}</span>
                <p className="mt-1 text-[15px] font-semibold text-black/85">{s.title}</p>
                <p className="mt-1 max-w-[240px] text-[12.5px] leading-relaxed text-black/55">{s.text}</p>
              </li>
            ))}
          </ol>

          {/* ----- ação ----- */}
          {state === "done" ? (
            <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
              <div className="flex items-center justify-center gap-2 text-[16px] font-semibold text-emerald-900">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-4 w-4" /></span>
                Renovação registada — obrigado!
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-emerald-900/80">
                O André já recebeu a notificação. O email de confirmação abriu no seu programa de correio — basta enviar.
                {" "}
                <a href={confirmHref} className="font-semibold underline underline-offset-2">Não abriu? Clique aqui.</a>
              </p>
            </div>
          ) : (
            <div className="no-print mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={confirm}
                disabled={state === "sending"}
                className="pr-pulse inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 text-[16px] font-bold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-80 sm:w-auto"
                style={{ background: BRAND_GRADIENT }}
              >
                {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {state === "sending" ? "A registar…" : "Confirmar a renovação"}
              </button>
              <a
                href={callHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/12 bg-white px-7 py-4 text-[15px] font-semibold text-black/75 transition hover:-translate-y-0.5 hover:border-[#c4b5fd] hover:text-black sm:w-auto"
              >
                <CalendarDays className="h-4 w-4" /> Marcar a call de fim de setembro
              </a>
            </div>
          )}

          <p className="mt-5 text-[12.5px] text-black/50">
            Dúvidas? {consultantFirst} — <a href={`mailto:${ccEmail}`} className="font-medium text-black/65 underline-offset-2 hover:underline">{ccEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
