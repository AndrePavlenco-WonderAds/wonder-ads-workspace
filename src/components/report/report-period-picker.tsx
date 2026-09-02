"use client";

// Which month does the consultant want to report?
//
//   • Mês fechado  — the last complete month (the default, unchanged).
//   • Mês em curso — month-to-date, for clients who want July's report on the
//     29th. Windows are cut to the data cutoff and the MoM/YoY comparisons
//     are cut to the SAME number of days, so a 26-day July is compared with a
//     26-day June rather than a full one.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  FileBarChart,
  CalendarCheck,
  CalendarClock,
  ShoppingCart,
} from "lucide-react";

type Option = {
  key: string;
  label: string;
  /** "1–26" for a partial month, null when complete. */
  coverage: string | null;
  alreadyGenerated: boolean;
  /** Ainda não reportável (o cutoff de 3 dias não chegou ao dia 1) — a opção
   *  mostra-se na mesma, cinzenta, para o gerador não mudar de forma. */
  disabled?: boolean;
};

export function ReportPeriodPicker({
  slug,
  closed,
  current,
  ecommerce = false,
  lang: initialLang = "pt",
}: {
  slug: string;
  closed: Option;
  current: Option;
  /** Tipo configurado do cliente — pré-seleciona a escolha normal/e-commerce. */
  ecommerce?: boolean;
  /** Idioma configurado/automático do cliente — pré-seleciona PT/EN. */
  lang?: "pt" | "en";
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<"closed" | "current">("closed");
  const [kind, setKind] = useState<"standard" | "ecommerce">(
    ecommerce ? "ecommerce" : "standard",
  );
  const [lang, setLang] = useState<"pt" | "en">(initialLang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const picked = choice === "closed" ? closed : current;

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/${slug}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period: picked.key,
          ecommerce: kind === "ecommerce",
          lang,
          // A escolha do gerador é a deliberada — fica para os meses seguintes.
          rememberKind: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        period?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok || !data.period) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      router.push(`/seo/${slug}/report/${data.period}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
      setBusy(false);
    }
  }

  const opts: { id: "closed" | "current"; opt: Option; icon: typeof CalendarCheck; hint: string }[] =
    [
      {
        id: "closed",
        opt: closed,
        icon: CalendarCheck,
        hint: "Mês completo, dados definitivos.",
      },
      {
        id: "current",
        opt: current,
        icon: CalendarClock,
        hint: current.disabled
          ? "Disponível a partir do dia 3 — os dados do GA4/GSC atrasam ~2 dias."
          : current.coverage
            ? `Dados de 1 a ${current.coverage.split("–")[1]}. Só números, sem percentagens de variação — um mês incompleto não se compara com um mês inteiro.`
            : "Mês ainda a decorrer.",
      },
    ];

  const kinds: {
    id: "standard" | "ecommerce";
    label: string;
    icon: typeof FileBarChart;
    hint: string;
  }[] = [
    {
      id: "standard",
      label: "Relatório normal",
      icon: FileBarChart,
      hint: "Leads, orgânico, keywords, GBP e AI Visibility.",
    },
    {
      id: "ecommerce",
      label: "Relatório e-commerce",
      icon: ShoppingCart,
      hint: "Tudo do normal + conversão orgânica (receita, transações, ticket médio — 3 meses + homólogo), páginas mais acedidas e produtos mais vendidos. Puxa do GA4/Shopify; o que faltar preenche-se à mão.",
    },
  ];

  return (
    <div className="w-full">
      {/* Tipo de relatório — a escolha fica gravada para os meses seguintes. */}
      <div className="mb-2 grid gap-2 sm:grid-cols-2">
        {kinds.map(({ id, label, icon: Icon, hint }) => {
          const on = kind === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={[
                "rounded-xl border px-3.5 py-3 text-left transition",
                on
                  ? "border-[#783DF5]/50 bg-[#783DF5]/12"
                  : "border-white/10 bg-white/[0.02] hover:border-white/22",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={`h-4 w-4 shrink-0 ${on ? "text-[#b79bff]" : "text-white/40"}`}
                />
                <span className="text-[13px] font-semibold text-white/90">
                  {label}
                </span>
              </span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-white/45">
                {hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {opts.map(({ id, opt, icon: Icon, hint }) => {
          const on = choice === id;
          const off = Boolean(opt.disabled);
          return (
            <button
              key={id}
              type="button"
              onClick={() => !off && setChoice(id)}
              disabled={off}
              className={[
                "rounded-xl border px-3.5 py-3 text-left transition",
                off
                  ? "cursor-not-allowed border-white/8 bg-white/[0.01] opacity-55"
                  : on
                    ? "border-[#783DF5]/50 bg-[#783DF5]/12"
                    : "border-white/10 bg-white/[0.02] hover:border-white/22",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={`h-4 w-4 shrink-0 ${on && !off ? "text-[#b79bff]" : "text-white/40"}`}
                />
                <span className="text-[13px] font-semibold text-white/90">
                  {opt.label}
                </span>
                {opt.coverage && !off && (
                  <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-amber-200/80">
                    parcial
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-white/45">
                {hint}
                {opt.alreadyGenerated && " · já gerado"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Idioma do documento — clientes EN (IHN, Kings Gyms…) recebem em
          inglês. A escolha fica gravada como a do tipo. */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11.5px] font-medium text-white/45">
          Idioma do relatório
        </span>
        <div className="inline-flex overflow-hidden rounded-lg border border-white/12">
          {(["pt", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-[12px] font-semibold uppercase transition ${
                lang === l
                  ? "bg-[#783DF5]/25 text-white"
                  : "bg-white/[0.02] text-white/45 hover:text-white/75"
              }`}
            >
              {l === "pt" ? "🇵🇹 PT" : "🇬🇧 EN"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileBarChart className="h-4 w-4" />
          )}
          {busy
            ? "A gerar…"
            : `${picked.alreadyGenerated ? "Regenerar" : "Gerar"} ${picked.label}`}
        </button>
        {err && (
          <span className="text-[11.5px] text-rose-400">
            Não foi possível gerar: {err}
          </span>
        )}
      </div>
    </div>
  );
}
