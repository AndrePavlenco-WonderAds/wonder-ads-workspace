"use client";

// Simulador de comissão — escreve o valor, vê quanto recebes e quando.
// Usa as mesmas constantes que as tabelas da página (lib/documentacao/
// commissions.ts): a regra escrita e a conta feita aqui são a mesma.

import { useId, useState, type ReactNode } from "react";
import { COMMISSION_TIERS, RENEWAL_RATE, formatEurCents, formatRate } from "@/lib/documentacao/commissions";

type BaseKind = "fee" | "margin" | "value";

const SERVICES: Array<{ id: string; label: string; base: BaseKind; hint: string; creatives?: boolean }> = [
  { id: "google", label: "Google Ads", base: "fee", hint: "Conta só a fee de agência. O ad spend não conta." },
  { id: "meta", label: "Meta Ads", base: "fee", hint: "Conta só a fee de agência, menos os criativos externos.", creatives: true },
  { id: "crm", label: "CRM", base: "margin", hint: "Conta a margem: valor faturado menos o custo de execução." },
  { id: "website", label: "Website", base: "value", hint: "Conta o valor faturado sem IVA." },
  { id: "app", label: "App / plataforma", base: "margin", hint: "Conta a margem: valor faturado menos o custo do parceiro." },
  { id: "pr", label: "PR / Imprensa", base: "margin", hint: "Conta a margem: valor faturado menos o custo do parceiro." },
  { id: "wikipedia", label: "Wikipedia", base: "margin", hint: "Conta a margem: valor faturado menos o custo do parceiro." },
  { id: "expansao", label: "Expansão do programa", base: "value", hint: "Conta o valor faturado sem IVA." },
];

const RENEWAL_OPTIONS = [
  { id: "pif12", label: "PIF 12 meses", months: 12, discount: 0.1, pif: true },
  { id: "pif6", label: "PIF 6 meses", months: 6, discount: 0.05, pif: true },
  { id: "mensal6", label: "Mensal 6 meses", months: 6, discount: 0, pif: false },
] as const;

function num(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: ReactNode }>;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`rounded-xl border px-3 py-1.5 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] ${
              on ? "border-white bg-white font-medium text-[#07080d]" : "border-white/12 text-white/65 hover:border-white/30 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MoneyInput({ label, value, onChange, suffix = "€" }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="text-[12.5px] text-white/55">{label}</span>
      <span className="mt-1.5 flex items-center rounded-xl border border-white/12 bg-white/[0.04] px-3 focus-within:border-[#783DF5] focus-within:ring-1 focus-within:ring-[#783DF5]">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent py-2.5 text-[16px] font-medium tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[13px] text-white/40">{suffix}</span>
      </span>
    </label>
  );
}

function eur(n: number): string {
  return `${Math.round(n).toLocaleString("de-DE")} €`;
}

export function CommissionSimulator({ defaultTier = 1 }: { defaultTier?: number }) {
  const [mode, setMode] = useState<"renovacao" | "novo">("renovacao");

  // Renovação
  const [fee, setFee] = useState("2500");

  // Cross-sell / upsell
  const [serviceId, setServiceId] = useState("google");
  const [monthly, setMonthly] = useState("1000");
  const [creatives, setCreatives] = useState("0");
  const [billed, setBilled] = useState("5000");
  const [cost, setCost] = useState("2000");
  const [months, setMonths] = useState("6");
  const [payment, setPayment] = useState<"pif" | "mensal">("mensal");
  const [tierN, setTierN] = useState(String(defaultTier));

  const service = SERVICES.find((s) => s.id === serviceId)!;
  const tier = COMMISSION_TIERS.find((t) => String(t.n) === tierN) ?? COMMISSION_TIERS[0];
  const n = Math.max(1, Math.round(num(months)) || 1);

  let base = 0;
  if (service.base === "fee") base = Math.max(0, num(monthly) - (service.creatives ? num(creatives) : 0)) * n;
  else if (service.base === "margin") base = Math.max(0, num(billed) - num(cost));
  else base = num(billed);
  const commission = base * tier.rate;
  const paidMonthly = payment === "mensal";

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5 sm:p-8">
      <Segmented
        label="Tipo de negócio"
        value={mode}
        onChange={setMode}
        options={[
          { id: "renovacao", label: "Renovação" },
          { id: "novo", label: "Cross-sell ou upsell" },
        ]}
      />

      {mode === "renovacao" ? (
        <div className="mt-6 space-y-6">
          <div className="max-w-xs">
            <MoneyInput label="Fee mensal, sem IVA" value={fee} onChange={setFee} suffix="€/mês" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {RENEWAL_OPTIONS.map((o, i) => {
              const table = num(fee) * o.months;
              const discount = table * o.discount;
              const billedValue = table - discount;
              const c = billedValue * RENEWAL_RATE;
              return (
                <div
                  key={o.id}
                  className={`rounded-2xl border p-4 ${i === 0 ? "border-[#783DF5]/50 bg-[#783DF5]/[0.08]" : "border-white/10 bg-white/[0.02]"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[14px] font-semibold text-white">{o.label}</p>
                    <span className="text-[11.5px] text-white/45">{i === 0 ? "Apresenta primeiro" : `${i + 1}.ª opção`}</span>
                  </div>
                  <dl className="mt-3 space-y-1 text-[13px]">
                    <div className="flex justify-between text-white/55">
                      <dt>Valor de tabela</dt>
                      <dd className="tabular-nums">{eur(table)}</dd>
                    </div>
                    <div className="flex justify-between text-white/55">
                      <dt>Desconto</dt>
                      <dd className="tabular-nums">{o.discount ? `− ${eur(discount)} (${formatRate(o.discount)})` : "—"}</dd>
                    </div>
                    <div className="flex justify-between text-white/80">
                      <dt>Faturado sem IVA</dt>
                      <dd className="tabular-nums">{eur(billedValue)}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-[1.9rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-emerald-300">
                    {formatEurCents(c)}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-white/50">
                    {o.pif
                      ? "De uma vez, depois dos 30 dias de reembolso"
                      : `${formatEurCents(c / o.months)} por mensalidade paga`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_17rem]">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[12.5px] text-white/55">Serviço</p>
              <Segmented
                label="Serviço"
                value={serviceId}
                onChange={setServiceId}
                options={SERVICES.map((s) => ({ id: s.id, label: s.label }))}
              />
              <p className="mt-2 text-[12.5px] text-[#c4a6ff]">{service.hint}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {service.base === "fee" ? (
                <>
                  <MoneyInput label="Fee de agência" value={monthly} onChange={setMonthly} suffix="€/mês" />
                  {service.creatives && <MoneyInput label="Criativos externos" value={creatives} onChange={setCreatives} suffix="€/mês" />}
                  <MoneyInput label="Duração" value={months} onChange={setMonths} suffix="meses" />
                </>
              ) : (
                <>
                  <MoneyInput label="Valor faturado sem IVA" value={billed} onChange={setBilled} />
                  {service.base === "margin" && <MoneyInput label="Custo externo" value={cost} onChange={setCost} />}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <p className="mb-2 text-[12.5px] text-white/55">O cliente paga</p>
                <Segmented
                  label="Como paga o cliente"
                  value={payment}
                  onChange={setPayment}
                  options={[
                    { id: "pif", label: "De uma vez" },
                    { id: "mensal", label: "Mensal" },
                  ]}
                />
              </div>
              {service.base !== "fee" && payment === "mensal" && (
                <div className="w-32">
                  <MoneyInput label="Em quantos meses" value={months} onChange={setMonths} suffix="meses" />
                </div>
              )}
              <div>
                <p className="mb-2 text-[12.5px] text-white/55">O teu patamar ao fechar</p>
                <Segmented
                  label="Patamar"
                  value={tierN}
                  onChange={setTierN}
                  options={COMMISSION_TIERS.map((t) => ({ id: String(t.n), label: `${t.n} · ${formatRate(t.rate)}` }))}
                />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:self-start">
            <p className="text-[12.5px] text-white/55">Recebes</p>
            <p className="mt-1 text-[2.4rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-emerald-300">
              {formatEurCents(commission)}
            </p>
            <p className="mt-2 text-[13px] leading-snug text-white/60">
              {paidMonthly
                ? `${formatEurCents(commission / n)} por mês, durante ${n} meses, à medida que o cliente paga. A 1.ª depois dos 30 dias de reembolso.`
                : "De uma vez, depois dos 30 dias de reembolso."}
            </p>
            <dl className="mt-4 space-y-1 border-t border-white/10 pt-3 text-[12.5px] text-white/50">
              <div className="flex justify-between">
                <dt>Base da comissão</dt>
                <dd className="tabular-nums text-white/75">{eur(base)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Taxa</dt>
                <dd className="text-white/75">{formatRate(tier.rate)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
