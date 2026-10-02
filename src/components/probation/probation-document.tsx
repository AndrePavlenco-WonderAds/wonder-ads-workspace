// A FOLHA do Plano de Probation, tal como o protótipo a desenha — usada na
// pré-visualização do editor. O texto vem todo de lib/probation/document.ts
// (a mesma fonte do PDF); aqui só se decide o aspeto, com as classes
// `.pd-*` de globals.css (copiadas do protótipo).
//
// Sem hooks nem estado: o editor passa o modelo já montado e a folha
// redesenha-se a cada tecla.

import type { ReactNode } from "react";
import {
  BRAND,
  HERO,
  KPI_OPTIONS,
  S01,
  S02,
  S03,
  S04,
  S05,
  S06,
  S07,
  S08,
  kpiColumns,
  type DocEval,
  type DocKpiRow,
  type DocModel,
  type Para,
  type Seg,
} from "@/lib/probation/document";

function Segs({ para, model }: { para: Para; model: DocModel }) {
  return (
    <>
      {para.map((seg: Seg, i) => {
        if (typeof seg === "string") return <span key={i}>{seg}</span>;
        if ("b" in seg) return <strong key={i}>{seg.b}</strong>;
        if ("bind" in seg) {
          const v = model.binds[seg.bind];
          const content = v || seg.empty;
          const cls = v ? undefined : "pd-empty";
          return seg.strong ? (
            <strong key={i} className={cls}>
              {content}
            </strong>
          ) : (
            <span key={i} className={cls}>
              {content}
            </span>
          );
        }
        const v = model.fills[seg.fill];
        return v ? (
          <span key={i}>{v}</span>
        ) : (
          <span key={i} className="pd-fill">
            {seg.ph}
          </span>
        );
      })}
    </>
  );
}

function H2({ n, children }: { n: string; children: ReactNode }) {
  return (
    <h2>
      <span className="pd-num">{n}</span>
      {children}
    </h2>
  );
}

function Opt({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className={`pd-opt${on ? " on" : ""}`}>{children}</span>;
}

function KpiTable({ rows, which }: { rows: DocKpiRow[]; which: 15 | 30 }) {
  const cols = kpiColumns(which);
  return (
    <table className="pd-kpi">
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th
              key={c.label}
              className={["c-n", "c-k", "c-m", "c-s", "c-r", ""][i] || undefined}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="n">{i + 1}</td>
            <td>{r.kpi}</td>
            <td>{r.target}</td>
            <td>{r.measure}</td>
            <td>{r.result}</td>
            <td>
              {KPI_OPTIONS.map((o) => (
                <Opt key={o.id} on={r.met === o.id}>
                  {o.label}
                </Opt>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Inline({ value, ph }: { value: string; ph: string }) {
  return value ? <span>{value}</span> : <span className="pd-fill">{ph}</span>;
}

function EvalCard({
  title,
  when,
  ev,
}: {
  title: string;
  when: string;
  ev: DocEval;
}) {
  const L = S07.labels;
  return (
    <div className={`pd-eval${ev.notApplicable ? " na" : ""}`}>
      <h3>{title}</h3>
      <div className={`pd-when${when ? "" : " pd-empty"}`}>{when || "dd/mm/aaaa"}</div>
      <span className="pd-lab">{L.met}</span>
      <div className="pd-inline">
        <Inline value={ev.metN} ph={S07.metPh.n} />
        {S07.metPh.of}
        <Inline value={ev.metTotal} ph={S07.metPh.total} />
      </div>
      <span className="pd-lab">{L.wentWell}</span>
      <div className="pd-box">{ev.wentWell}</div>
      <span className="pd-lab">{L.fellShort}</span>
      <div className="pd-box">{ev.fellShort}</div>
      <span className="pd-lab">{L.comment}</span>
      <div className="pd-box">{ev.consultantComment}</div>
      <span className="pd-lab">{L.decision}</span>
      <div className="pd-decision">
        {S07.options.map((o) => (
          <Opt key={o.id} on={ev.decision === o.id}>
            {o.label}
          </Opt>
        ))}
      </div>
      <span className="pd-lab">{L.newDate}</span>
      <div className="pd-inline">
        <Inline value={ev.newDate} ph={S07.newDatePh} />
      </div>
      <span className="pd-lab">{L.decidedBy}</span>
      <div className="pd-inline">
        <Inline value={ev.decidedBy} ph={S07.decidedByPh} />
      </div>
    </div>
  );
}

export function ProbationDocument({ model }: { model: DocModel }) {
  const b = model.binds;
  return (
    <article className="probation-doc" aria-label="Plano de Probation — pré-visualização">
      <header className="pd-hero">
        <div className="pd-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wonder-ads-butterfly.png" alt="" />
          <span>{BRAND}</span>
        </div>
        <p className="pd-eyebrow">
          {HERO.eyebrow}
          {model.periodLabel ? ` · ${model.periodLabel}` : ""}
        </p>
        <h1>
          <Segs para={[HERO.title]} model={model} />
        </h1>
        <p className="pd-sub">
          <Segs para={HERO.sub} model={model} />
        </p>
        <div className="pd-dates">
          {HERO.tiles.map((t) => (
            <div key={t.label} className="pd-tile">
              <span className="pd-lab">{t.label}</span>
              <b className={b[t.bind] ? undefined : "pd-empty"}>{b[t.bind] || HERO.dateEmpty}</b>
              <small>{t.small}</small>
            </div>
          ))}
        </div>
      </header>

      <div className="pd-body">
        <section style={{ marginTop: 0 }}>
          <H2 n={S01.n}>{S01.title}</H2>
          <table className="pd-info">
            <tbody>
              {S01.rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>
                    <Segs para={r.value} model={model} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <H2 n={S02.n}>{S02.title}</H2>
          {S02.paragraphs.map((p, i) => (
            <p key={i}>
              <Segs para={p} model={model} />
            </p>
          ))}
          <div className="pd-note">
            <p>
              <strong>{S02.note.title}</strong>
            </p>
            <ul>
              {S02.note.items.map((it, i) => (
                <li key={i}>
                  <Segs para={it} model={model} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <H2 n={S03.n}>{S03.title}</H2>
          <p>
            <Segs para={S03.intro} model={model} />
          </p>
          <KpiTable rows={model.kpis15} which={15} />
          <p style={{ marginTop: 12 }}>
            <Segs para={S03.outro} model={model} />
          </p>
        </section>

        <section>
          <H2 n={S04.n}>{S04.title}</H2>
          <p>
            <Segs para={S04.intro} model={model} />
          </p>
          <KpiTable rows={model.kpis30} which={30} />
          <p style={{ marginTop: 12 }}>
            <Segs para={S04.outro} model={model} />
          </p>
        </section>

        <section>
          <H2 n={S05.n}>{S05.title}</H2>
          <p>
            <Segs para={S05.intro} model={model} />
          </p>
          <div className="pd-outs">
            {S05.outcomes.map((o) => (
              <div key={o.id} className="pd-out" style={{ ["--c" as string]: o.color }}>
                <span className="k">{o.k}</span>
                <h3>{o.title}</h3>
                <span className="pd-lab">{S05.whenLabel}</span>
                <p>{o.when}</p>
                <span className="pd-lab">{S05.whatLabel}</span>
                <p>{o.what}</p>
              </div>
            ))}
          </div>
          <div className="pd-note">
            <p>
              <Segs para={S05.note} model={model} />
            </p>
          </div>
        </section>

        <section>
          <H2 n={S06.n}>{S06.title}</H2>
          <p>
            <Segs para={S06.intro} model={model} />
          </p>
          <ul>
            {S06.ours.map((it, i) => (
              <li key={i}>
                <Segs para={it} model={model} />
              </li>
            ))}
          </ul>
          <p>
            <Segs para={S06.askIntro} model={model} />
          </p>
          <ul>
            {S06.theirs.map((it, i) => (
              <li key={i}>
                <Segs para={it} model={model} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <H2 n={S07.n}>{S07.title}</H2>
          <p>
            <Segs para={S07.intro} model={model} />
          </p>
          <div className="pd-evals">
            <EvalCard title={S07.evals[0].title} when={b.d15} ev={model.eval15} />
            <EvalCard title={S07.evals[1].title} when={b.d30} ev={model.eval30} />
          </div>
        </section>

        <section>
          <H2 n={S08.n}>{S08.title}</H2>
          <p>
            <Segs para={S08.text} model={model} />
          </p>
          <div className="pd-sigs">
            {S08.sigs.map((s) => (
              <div key={s.role} className="pd-sig">
                <div className="ln" />
                <b className={b[s.bind] ? undefined : "pd-empty"}>{b[s.bind] || s.empty}</b>
                <small>{s.role}</small>
              </div>
            ))}
          </div>
          <div className="pd-foot">
            <span>{S08.foot[0]}</span>
            <span>{S08.foot[1]}</span>
          </div>
        </section>
      </div>
    </article>
  );
}
