// A vista de LEITURA de um relatório semanal — a mesma para o consultor e
// para a direção, com dois níveis de detalhe na assinatura: o consultor vê
// «Assinado por X em dd/mm/aaaa HH:mm» e o hash; a direção vê também o IP,
// o user-agent e a verificação de integridade. Puro (server-safe); os
// controlos de pontuação da direção entram por `itemExtras`.

import type { ReactNode } from "react";
import { BadgeCheck, CheckCheck, Fingerprint, Hourglass, ShieldCheck, ShieldX } from "lucide-react";
import {
  bandOf,
  DECLARATION_TEXT,
  formatISODate,
  formatLisbonDateTime,
  noticedLabel,
  reasonLabel,
  type IneficaciaItem,
  type IneficaciaReport,
  type IneficaciaScore,
} from "@/lib/ineficacias/shared";

export const BAND_TONES: Record<ReturnType<typeof bandOf>["id"], string> = {
  zero: "border-white/15 bg-white/[0.05] text-white/60",
  baixo: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  medio: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  alto: "border-orange-400/35 bg-orange-400/10 text-orange-200",
  critico: "border-rose-400/40 bg-rose-500/10 text-rose-200",
};

/** «4 · Médio» — a pontuação numa pastilha. */
export function ScoreBadge({ score, size = "md" }: { score: IneficaciaScore | null; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]";
  if (!score) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#a78bfa]/40 bg-[#783DF5]/10 font-semibold text-[#c3aaff] ${pad}`}>
        <Hourglass className="h-3 w-3" />
        Por pontuar
      </span>
    );
  }
  const band = bandOf(score.points);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${BAND_TONES[band.id]} ${pad}`}>
      <span className="tabular">{score.points} pt{score.points === 1 ? "" : "s"}</span>
      <span className="opacity-80">· {band.label}</span>
    </span>
  );
}

export function ReportStatusChip({ report }: { report: IneficaciaReport }) {
  if (report.review) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
        <CheckCheck className="h-3 w-3" />
        Pontuado pela direção
      </span>
    );
  }
  const scored = report.items.filter((it) => it.score).length;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a78bfa]/40 bg-[#783DF5]/10 px-2.5 py-1 text-[11px] font-semibold text-[#c3aaff]">
      <Hourglass className="h-3 w-3" />
      {scored ? `${scored} de ${report.items.length} pontuadas` : "Por pontuar"}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">{label}</p>
      <div className="mt-1 text-[13px] leading-relaxed text-white/80">{children}</div>
    </div>
  );
}

export function ItemView({
  item,
  n,
  extra,
  audience = "direcao",
}: {
  item: IneficaciaItem;
  n: number;
  extra?: ReactNode;
  /** Na página do próprio os rótulos falam-lhe por «tu». */
  audience?: "consultor" | "direcao";
}) {
  const me = audience === "consultor";
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[11px] font-bold text-white/70">
            {n}
          </span>
          <span className="text-[12.5px] font-semibold text-white/85">{item.client}</span>
          <span className="text-[11.5px] text-white/40">· {formatISODate(item.occurredOn)}</span>
        </div>
        <ScoreBadge score={item.score} size="sm" />
      </header>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Row label={me ? "O erro que cometeste — o que aconteceu" : "O erro — o que aconteceu"}>
            <p className="whitespace-pre-wrap">{item.what}</p>
          </Row>
        </div>
        <Row label="Motivo">{reasonLabel(item.reason, item.reasonOther)}</Row>
        <Row label={me ? "Percebeste o erro?" : "Percebeu o erro?"}>{noticedLabel(item.noticed)}</Row>
        <div className="md:col-span-2">
          <Row label={me ? "Como achas que deverias ter feito" : "Como acha que deveria ter feito"}>
            <p className="whitespace-pre-wrap">{item.shouldHave}</p>
          </Row>
        </div>
        <Row label="Primeira vez?">
          {item.firstTime ? "Sim — é a primeira vez." : <>Não — última vez: <span className="text-white/90">{item.lastTime || "—"}</span></>}
        </Row>
        {item.score && (
          <Row label={`Pontuação · ${item.score.byName || "direção"} · ${formatLisbonDateTime(item.score.at)}`}>
            {item.score.note ? <p className="whitespace-pre-wrap">{item.score.note}</p> : <span className="text-white/40">Sem nota.</span>}
          </Row>
        )}
      </div>
      {extra && <div className="mt-4 border-t border-white/[0.06] pt-4">{extra}</div>}
    </article>
  );
}

export function SignatureBlock({
  report,
  audience,
  integrity,
}: {
  report: IneficaciaReport;
  audience: "consultor" | "direcao";
  /** null = não verificado; true/false = resultado da verificação. */
  integrity?: boolean | null;
}) {
  const s = report.signature;
  return (
    <div className="rounded-2xl border border-[#783DF5]/25 bg-[linear-gradient(135deg,rgba(52,62,215,0.08),rgba(120,61,245,0.08)_54%,rgba(197,53,201,0.08))] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#783DF5]/30 bg-[#783DF5]/15 text-[#c3aaff]">
            <BadgeCheck className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-white">
              Assinado por {s.fullName || report.name} em {formatLisbonDateTime(s.signedAt)}
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/50">
              Ref.ª {report.ref} · {report.items.length} {report.items.length === 1 ? "ocorrência" : "ocorrências"} · declaração aceite
            </p>
          </div>
        </div>
        {integrity !== undefined && integrity !== null && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              integrity
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/40 bg-rose-500/10 text-rose-200"
            }`}
          >
            {integrity ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
            {integrity ? "Integridade verificada" : "Hash NÃO confere"}
          </span>
        )}
      </div>
      <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-[11.5px] italic leading-relaxed text-white/55">
        «{DECLARATION_TEXT}»
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-2">
        <div className="flex items-center gap-2 text-white/45">
          <Fingerprint className="h-3.5 w-3.5 shrink-0" />
          <dt className="shrink-0">SHA-256</dt>
          <dd className="truncate font-mono text-white/65" title={s.hash}>
            {s.hash ? `${s.hash.slice(0, 16)}…${s.hash.slice(-8)}` : "—"}
          </dd>
        </div>
        <div className="flex items-center gap-2 text-white/45">
          <dt className="shrink-0">Utilizador</dt>
          <dd className="font-mono text-white/65">{s.userId}</dd>
          <dt className="ml-2 shrink-0">UTC</dt>
          <dd className="font-mono text-white/65">{s.signedAt.replace("T", " ").slice(0, 19)}</dd>
        </div>
        {audience === "direcao" && (
          <>
            <div className="flex items-center gap-2 text-white/45">
              <dt className="shrink-0">IP</dt>
              <dd className="font-mono text-white/65">{s.ip || "—"}</dd>
            </div>
            <div className="flex items-start gap-2 text-white/45">
              <dt className="shrink-0">User-agent</dt>
              <dd className="line-clamp-2 break-all font-mono text-[10.5px] text-white/55">{s.userAgent || "—"}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}

export function ReportView({
  report,
  audience,
  integrity,
  itemExtras,
  footer,
  defaultOpen = false,
}: {
  report: IneficaciaReport;
  audience: "consultor" | "direcao";
  integrity?: boolean | null;
  /** Controlos por ocorrência (a pontuação da direção), por id. */
  itemExtras?: Record<string, ReactNode>;
  /** Controlos do relatório inteiro («marcar como visto»). */
  footer?: ReactNode;
  defaultOpen?: boolean;
}) {
  const n = report.items.length;
  return (
    <details
      id={`relatorio-${report.id}`}
      open={defaultOpen}
      className="group scroll-mt-24 rounded-3xl border border-white/[0.08] bg-white/[0.02] open:border-white/[0.14] open:bg-white/[0.03]"
    >
      <summary className="flex cursor-pointer select-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-white/45">{report.ref}</span>
            <span className="text-[13.5px] font-semibold text-white/90">Relatório de {formatISODate(report.submittedOn)}</span>
          </span>
          <span className="mt-0.5 block text-[11.5px] text-white/45">
            {audience === "direcao" ? `${report.name} · ` : ""}
            {`${n} ${n === 1 ? "ocorrência" : "ocorrências"}`} · assinado{" "}
            {formatLisbonDateTime(report.signature.signedAt)}
          </span>
        </span>
        <ReportStatusChip report={report} />
      </summary>

      <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
        <div className="space-y-3">
          {report.items.map((it, i) => (
            <ItemView key={it.id} item={it} n={i + 1} extra={itemExtras?.[it.id]} audience={audience} />
          ))}
        </div>
        {report.review?.note && (
          <p className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[12.5px] text-white/70">
            <span className="font-semibold text-white/85">Nota da direção ({report.review.byName || "direção"}):</span>{" "}
            {report.review.note}
          </p>
        )}
        <div className="mt-4">
          <SignatureBlock report={report} audience={audience} integrity={integrity} />
        </div>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </details>
  );
}
