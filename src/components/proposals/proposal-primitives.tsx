// Peças de composição das propostas públicas — secções, grelhas de números,
// tabelas, caixas de destaque, cartões de mês e cartões de preço.
//
// Tudo server-safe (sem hooks): o corpo de uma proposta é um documento,
// não uma app. O tema é o das outras páginas para clientes — fundo
// #f4f4ed, texto escuro, gradiente da marca só nos acentos — para que uma
// proposta, um relatório e um roadmap pareçam vir da mesma casa.

import type { ReactNode } from "react";
import { Check } from "lucide-react";

export const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

export function GradientText({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        background: BRAND_GRADIENT,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }}
    >
      {children}
    </span>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-24 sm:mt-20">
      <div className="mb-6 sm:mb-8">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b21b6]">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black/88 sm:text-3xl">
          {title}
        </h2>
        {lead && (
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-black/65">
            {lead}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 mt-10 text-lg font-semibold tracking-tight text-black/85">
      {children}
    </h3>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 max-w-3xl text-[14.5px] leading-relaxed text-black/70">
      {children}
    </p>
  );
}

export type StatItem = { value: ReactNode; label: string; sub?: string };

export function StatGrid({
  items,
  cols = 3,
}: {
  items: StatItem[];
  cols?: 2 | 3 | 4;
}) {
  const colClass =
    cols === 4
      ? "sm:grid-cols-4"
      : cols === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-3";
  return (
    <div className={`grid grid-cols-2 gap-3 ${colClass}`}>
      {items.map((s, i) => (
        <div
          key={i}
          className="rounded-xl border border-black/8 border-l-[3px] border-l-[#783df5] bg-white px-4 py-3.5"
        >
          <div className="text-2xl font-bold leading-none tracking-tight text-black/90 sm:text-[1.7rem]">
            {s.value}
          </div>
          <div className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-black/55">
            {s.label}
          </div>
          {s.sub && <div className="mt-1 text-[11.5px] text-black/50">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  caption,
  head,
  rows,
  numeric = [],
  note,
  lastRowBold = false,
  highlightRows = [],
}: {
  caption?: string;
  head: string[];
  rows: ReactNode[][];
  /** Índices das colunas alinhadas à direita (números). */
  numeric?: number[];
  note?: ReactNode;
  lastRowBold?: boolean;
  /** Índices das linhas a destacar (fundo lilás claro). */
  highlightRows?: number[];
}) {
  return (
    <figure className="my-4">
      {caption && (
        <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
          {caption}
        </figcaption>
      )}
      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-black/[0.035]">
              {head.map((h, i) => (
                <th
                  key={i}
                  className={`border-b border-black/10 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-black/60 ${numeric.includes(i) ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              const last = ri === rows.length - 1;
              const bold = lastRowBold && last;
              const hi = highlightRows.includes(ri);
              return (
                <tr
                  key={ri}
                  className={`${hi ? "bg-[#f5f0ff]" : ri % 2 ? "bg-black/[0.015]" : ""} ${bold ? "font-semibold" : ""}`}
                >
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-black/6 px-3 py-2.5 align-top text-black/78 ${numeric.includes(ci) ? "text-right tabular-nums" : ""}`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-2 text-[12px] leading-relaxed text-black/50">{note}</p>}
    </figure>
  );
}

type Tone = "brand" | "green" | "amber" | "neutral";
const TONES: Record<Tone, { bg: string; border: string; title: string }> = {
  brand: { bg: "#f5f0ff", border: "#d6bcfa", title: "#4c1d95" },
  green: { bg: "#ecfdf5", border: "#a7f3d0", title: "#065f46" },
  amber: { bg: "#fffbeb", border: "#fde68a", title: "#92400e" },
  neutral: { bg: "#ffffff", border: "rgba(0,0,0,0.1)", title: "rgba(0,0,0,0.85)" },
};

export function Callout({
  title,
  tone = "brand",
  children,
}: {
  title?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      className="my-5 rounded-xl border px-5 py-4 text-[14px] leading-relaxed text-black/72"
      style={{ background: t.bg, borderColor: t.border }}
    >
      {title && (
        <p className="mb-1.5 text-[13px] font-semibold" style={{ color: t.title }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="my-3 space-y-2 text-[14px] leading-relaxed text-black/72">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: BRAND_GRADIENT }}
          />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function CheckList({
  items,
  columns = 1,
}: {
  items: ReactNode[];
  columns?: 1 | 2;
}) {
  return (
    <ul
      className={`my-3 grid gap-x-6 gap-y-2 text-[14px] leading-relaxed text-black/75 ${columns === 2 ? "sm:grid-cols-2" : ""}`}
    >
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Pill({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "dark" | "soft" | "green";
}) {
  if (tone === "brand") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        {children}
      </span>
    );
  }
  const cls =
    tone === "dark"
      ? "bg-black/85 text-white"
      : tone === "green"
        ? "bg-emerald-100 text-emerald-900"
        : "bg-[#ede9fe] text-[#4c1d95]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${cls}`}
    >
      {children}
    </span>
  );
}

export function GoalCard({
  n,
  title,
  text,
  accent = false,
}: {
  n: string;
  title: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${accent ? "border-[#c4b5fd] shadow-[0_0_0_3px_rgba(120,61,245,0.08)]" : "border-black/8"}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: BRAND_GRADIENT }}
        >
          {n}
        </span>
        <p className="text-[14px] font-semibold text-black/85">{title}</p>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-black/62">{text}</p>
    </div>
  );
}

export function MonthCard({
  index,
  month,
  title,
  bullets,
  checkpoint = false,
}: {
  index: number;
  month: string;
  title: string;
  bullets: ReactNode[];
  checkpoint?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-black/8 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="soft">
          Mês {index} · {month}
        </Pill>
        {checkpoint && <Pill tone="green">Checkpoint</Pill>}
      </div>
      <p className="mt-2.5 text-[15px] font-semibold text-black/85">{title}</p>
      <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-black/68">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-black/35" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PriceCard({
  eyebrow,
  name,
  price,
  priceNote,
  intro,
  featuresTitle,
  features,
  extraTitle,
  extra,
  highlight = false,
}: {
  eyebrow: string;
  name: string;
  price: string;
  priceNote?: string;
  intro?: ReactNode;
  featuresTitle?: string;
  features: ReactNode[];
  extraTitle?: string;
  extra?: ReactNode[];
  highlight?: boolean;
}) {
  const inner = (
    <div className="flex h-full flex-col rounded-[15px] bg-white p-6 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b21b6]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-black/88">{name}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight">
          {highlight ? <GradientText>{price}</GradientText> : <span className="text-black/85">{price}</span>}
        </span>
      </div>
      {priceNote && <p className="mt-1.5 text-[12.5px] text-black/55">{priceNote}</p>}
      {intro && <div className="mt-4 text-[13.5px] leading-relaxed text-black/68">{intro}</div>}
      {featuresTitle && (
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
          {featuresTitle}
        </p>
      )}
      <CheckList items={features} />
      {extraTitle && (
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
          {extraTitle}
        </p>
      )}
      {extra && <CheckList items={extra} />}
    </div>
  );
  if (!highlight) {
    return <div className="rounded-2xl border border-black/10 bg-white">{inner}</div>;
  }
  return (
    <div className="rounded-2xl p-[2px] shadow-xl shadow-[#783DF5]/15" style={{ background: BRAND_GRADIENT }}>
      {inner}
    </div>
  );
}
