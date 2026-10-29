"use client";

// A Jornada de Cliente como uma estrada (v78.46; tarefas só com o título e
// painel lateral em v78.48). Uma estrada em SVG desce a página e passa por uma
// paragem em cada mês e em cada semana; os cartões ficam encostados à
// estrada, alternando de lado. À medida que se lê, a estrada acende-se até ao
// meio do ecrã e um marcador segue por ela — é o único movimento da página e
// responde ao scroll de quem lê.
//
// Em cada semana vê-se só o título de cada tarefa; carregar nele abre o painel
// lateral com a explicação (journey-task-drawer.tsx).
//
// A estrada é desenhada a partir das paragens reais (medidas no DOM), por isso
// acompanha qualquer altura de cartão. No telemóvel desce a direito pela
// esquerda.
//
// A direção (SuperAdmin, sem «Ver como») edita aqui mesmo: as tarefas no
// painel de cada uma; com «Editar o caminho», acrescenta e remove tarefas,
// marcos do mês e meses, e muda o título e o objetivo de cada mês. Cada
// mudança grava logo (ver use-doc-save).

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Check, ChevronRight, Flag, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import {
  MAX_BLOCKS_PER_SLOT,
  MAX_JOURNEY_MONTHS,
  PLACEHOLDER_TITLE,
  WEEKS_PER_JOURNEY_MONTH,
  newJourneyId,
  type Journey,
  type JourneyBlock,
  type JourneyMonth,
} from "@/lib/documentacao/jornada";
import { JourneyTaskDrawer, type TaskPanel } from "./journey-task-drawer";
import { SectionNav } from "./section-nav";
import { useDocSave } from "./use-doc-save";

/** Onde vive uma tarefa: nos marcos do mês (week null) ou numa semana. */
type Slot = { month: number; week: number | null };
type Point = { x: number; y: number };
type Geom = { w: number; h: number; pts: Point[]; wide: boolean };
type Lane = "l" | "r";
type OpenPanel = TaskPanel & { slot: Slot; blockId: string | null };

const GRADIENT = "linear-gradient(135deg,#343ED7,#783DF5 55%,#C535C9)";

const slotBlocks = (ms: JourneyMonth[], s: Slot) => (s.week === null ? ms[s.month]?.blocks : ms[s.month]?.weeks[s.week]?.blocks) ?? [];
function withSlot(ms: JourneyMonth[], s: Slot, blocks: JourneyBlock[]): JourneyMonth[] {
  if (s.week === null) ms[s.month].blocks = blocks;
  else ms[s.month].weeks[s.week].blocks = blocks;
  return ms;
}

/** A estrada: curvas em S verticais entre paragens consecutivas — a tangente
 *  em cada paragem é vertical, por isso as curvas encaixam sem quebras, e o y
 *  cresce sempre (o que deixa procurar um ponto pela altura). */
function roadPath(pts: Point[]): string {
  if (pts.length < 2) return "";
  const lead = 36;
  let d = `M ${pts[0].x} ${pts[0].y - lead} L ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const k = (b.y - a.y) / 2;
    d += ` C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`;
  }
  return d;
}

export function JourneyRoad({ initial, canEdit }: { initial: Journey; canEdit: boolean }) {
  const { data, save, saving, error, clearError } = useDocSave("jornada-cliente", initial);
  const months = data.months;
  const [editing, setEditing] = useState(false);
  const [monthForm, setMonthForm] = useState<number | null>(null);
  const [panel, setPanel] = useState<OpenPanel | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);

  // ---- Edição ------------------------------------------------------------
  const mutate = useCallback(
    (fn: (ms: JourneyMonth[]) => JourneyMonth[]) => save({ months: fn(structuredClone(months)) }),
    [months, save],
  );
  /** Grava a tarefa do painel: muda a que existe (e deixa de ser espaço por
   *  preencher) ou acrescenta uma nova no fim da semana. */
  const saveTask = (v: { title: string; detail: string }) => {
    if (!panel) return Promise.resolve(false);
    const { slot, blockId } = panel;
    return mutate((ms) => {
      const list = slotBlocks(ms, slot);
      const next = blockId
        ? list.map((b) => {
            if (b.id !== blockId) return b;
            const updated: JourneyBlock = { ...b, ...v };
            delete updated.placeholder;
            return updated;
          })
        : [...list, { id: newJourneyId("tarefa"), ...v }];
      return withSlot(ms, slot, next);
    });
  };
  const removeTask = (slot: Slot, blockId: string) =>
    mutate((ms) => withSlot(ms, slot, slotBlocks(ms, slot).filter((b) => b.id !== blockId)));
  const saveMonth = async (mi: number, v: { title: string; goal: string }) => {
    const ok = await mutate((ms) => {
      ms[mi] = { ...ms[mi], ...v };
      return ms;
    });
    if (ok) setMonthForm(null);
  };
  const removeMonth = (mi: number) => mutate((ms) => ms.filter((_, i) => i !== mi));
  const addMonth = async () => {
    const ok = await mutate((ms) => [
      ...ms,
      {
        id: newJourneyId("m"),
        title: "",
        goal: "",
        blocks: [],
        weeks: Array.from({ length: WEEKS_PER_JOURNEY_MONTH }, () => ({
          id: newJourneyId("s"),
          blocks: [{ id: newJourneyId("tarefa"), title: "", detail: "", placeholder: true as const }],
        })),
      },
    ]);
    if (ok) setMonthForm(months.length);
  };
  const openTask = (slot: Slot, where: string, block: JourneyBlock | null) =>
    setPanel({ slot, where, blockId: block?.id ?? null, editing: !block || Boolean(block.placeholder) });

  // ---- A estrada ---------------------------------------------------------
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<SVGPathElement>(null);
  const litEdgeRef = useRef<SVGPathElement>(null);
  const litLineRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<Geom | null>(null);
  const [passed, setPassed] = useState(0);
  const [reduced, setReduced] = useState(false);
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const pts = Array.from(wrap.querySelectorAll<HTMLElement>("[data-stop]")).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2 - box.left), y: Math.round(r.top + r.height / 2 - box.top) };
    });
    const next: Geom = { w: Math.round(box.width), h: Math.round(box.height), pts, wide: window.matchMedia("(min-width: 1024px)").matches };
    setGeom((g) =>
      g && g.w === next.w && g.h === next.h && g.wide === next.wide && g.pts.length === pts.length && g.pts.every((p, i) => p.x === pts[i].x && p.y === pts[i].y)
        ? g
        : next,
    );
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [measure]);
  // Tarefas e formulários mudam as paragens de sítio sem mudar sempre a altura.
  useEffect(() => measure(), [data, editing, monthForm, measure]);

  const d = useMemo(() => (geom ? roadPath(geom.pts) : ""), [geom]);

  // O troço aceso e o marcador seguem o meio do ecrã. Mexe-se no DOM
  // diretamente (sem estado) para o scroll não re-renderizar a página; só a
  // contagem de paragens passadas é estado, e muda poucas vezes.
  useEffect(() => {
    const path = measureRef.current;
    const wrap = wrapRef.current;
    if (!geom || !d || !path || !wrap) return;
    const lit = [litEdgeRef.current, litLineRef.current];
    if (reduced) {
      lit.forEach((el) => el && (el.style.strokeDashoffset = "0"));
      setPassed(geom.pts.length);
      return;
    }
    const total = path.getTotalLength();
    const startY = path.getPointAtLength(0).y;
    const endY = path.getPointAtLength(total).y;
    let raf = 0;
    const update = () => {
      raf = 0;
      const target = window.innerHeight * 0.5 - wrap.getBoundingClientRect().top;
      let len = 0;
      if (target >= endY) len = total;
      else if (target > startY) {
        let lo = 0;
        let hi = total;
        for (let i = 0; i < 22; i++) {
          const mid = (lo + hi) / 2;
          if (path.getPointAtLength(mid).y < target) lo = mid;
          else hi = mid;
        }
        len = (lo + hi) / 2;
      }
      const p = path.getPointAtLength(len);
      const frac = total > 0 ? len / total : 0;
      lit.forEach((el) => el && (el.style.strokeDashoffset = String(1 - frac)));
      const m = markerRef.current;
      if (m) {
        m.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        m.style.opacity = "1";
      }
      let n = 0;
      for (const pt of geom.pts) if (pt.y <= p.y + 2) n++;
      setPassed((prev) => (prev === n ? prev : n));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [geom, d, reduced]);

  const navItems = useMemo(() => months.map((_, i) => ({ id: `mes-${i + 1}`, label: `Mês ${i + 1}` })), [months]);
  const W = geom?.wide ? 30 : 16;
  const endIndex = 1 + months.length * (WEEKS_PER_JOURNEY_MONTH + 1);
  const panelBlock = panel?.blockId ? (slotBlocks(months, panel.slot).find((b) => b.id === panel.blockId) ?? null) : null;

  const listProps = (slot: Slot, where: string) => ({
    editing,
    canEdit,
    onOpen: (b: JourneyBlock | null) => openTask(slot, where, b),
    onRemove: (id: string) => removeTask(slot, id),
  });

  return (
    <>
      <SectionNav items={navItems} />

      {canEdit && (
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <span className="text-[12px] text-white/40" aria-live="polite">
            {saving ? "A guardar…" : data.updatedBy ? `Editado por ${data.updatedBy} a ${formatDate(data.updatedAt)}` : "Versão de partida"}
          </span>
          <button
            type="button"
            onClick={() => {
              setEditing((e) => !e);
              setMonthForm(null);
            }}
            aria-pressed={editing}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] ${
              editing ? "bg-white text-[#07080d] hover:bg-white/90" : "border border-white/15 bg-white/[0.04] text-white/80 hover:border-white/30 hover:text-white"
            }`}
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Terminar edição" : "Editar o caminho"}
          </button>
        </div>
      )}

      {editing && (
        <p className="mt-4 rounded-2xl border border-[#783DF5]/30 bg-[#783DF5]/[0.08] px-4 py-3 text-[13.5px] text-white/70">
          Estás a editar a jornada: acrescenta ou remove tarefas em cada semana e nos marcos de cada mês, e dá nome a cada mês.
          Para escrever a explicação de uma tarefa, carrega no título dela. Cada mudança grava logo e fica visível para todo o
          SEO DPT.
        </p>
      )}
      {error && (
        <div role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-[13.5px] text-rose-100">
          {error}
          <button type="button" onClick={clearError} aria-label="Fechar aviso" className="text-rose-200/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={wrapRef} className="relative mt-10 pb-4">
        {geom && d && (
          <svg
            aria-hidden
            className="pointer-events-none absolute left-0 top-0"
            width={geom.w}
            height={geom.h}
            viewBox={`0 0 ${geom.w} ${geom.h}`}
          >
            <defs>
              <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={geom.h}>
                <stop offset="0" stopColor="#343ED7" />
                <stop offset="0.5" stopColor="#783DF5" />
                <stop offset="1" stopColor="#C535C9" />
              </linearGradient>
            </defs>
            {/* Brilho à volta, bermas apagadas, bermas acesas até onde se leu,
                o asfalto, o tracejado e a linha acesa ao centro. */}
            <path d={d} fill="none" stroke={`url(#${gid})`} strokeOpacity={0.08} strokeWidth={W + 30} strokeLinecap="round" />
            <path d={d} fill="none" stroke={`url(#${gid})`} strokeOpacity={0.28} strokeWidth={W + 6} strokeLinecap="round" />
            <path ref={litEdgeRef} d={d} fill="none" stroke={`url(#${gid})`} strokeWidth={W + 6} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
            <path d={d} fill="none" stroke="#0f1020" strokeWidth={W} strokeLinecap="round" />
            <path d={d} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={geom.wide ? 2 : 1.5} strokeDasharray="10 14" />
            <path ref={litLineRef} d={d} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={geom.wide ? 2.5 : 2} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
            <path ref={measureRef} d={d} fill="none" stroke="none" />
          </svg>
        )}
        {geom && d && !reduced && (
          <div ref={markerRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-[5] opacity-0 will-change-transform">
            <span className="absolute -left-4 -top-4 h-8 w-8 animate-ping rounded-full bg-[#C535C9]/35" />
            <span className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border-[3px] border-white shadow-[0_0_22px_rgba(197,53,201,0.9)]" style={{ background: GRADIENT }} />
          </div>
        )}

        <ol className="relative z-10">
          {/* Partida */}
          <li className={ROW}>
            <div className={`${STOP_COL} lg:justify-center`}>
              <span data-stop className={stopRing(passed > 0, "h-11 w-11")} style={passed > 0 ? { background: GRADIENT } : undefined}>
                <Flag className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="col-start-2 row-start-1 pt-2.5 lg:col-start-3 lg:pl-10">
              <p className="text-[16px] font-semibold text-white">Partida</p>
              <p className="mt-0.5 max-w-sm text-[13.5px] leading-relaxed text-white/55">Contrato assinado: o projeto entra na semana 1.</p>
            </div>
          </li>

          {months.map((m, mi) => {
            const n = mi + 1;
            const mStop = 1 + mi * (WEEKS_PER_JOURNEY_MONTH + 1);
            const mLit = passed > mStop;
            const weeksLabel = `Semanas ${mi * WEEKS_PER_JOURNEY_MONTH + 1} a ${n * WEEKS_PER_JOURNEY_MONTH}`;
            const showMarcos = m.blocks.length > 0 || editing;
            return (
              <li key={m.id} id={`mes-${n}`} className="scroll-mt-40">
                <div className={`${ROW} pt-10`}>
                  <div className={`${STOP_COL} lg:justify-center`}>
                    <span
                      data-stop
                      className={`relative z-10 flex h-14 w-14 flex-col items-center justify-center rounded-full ring-2 transition duration-500 lg:h-[76px] lg:w-[76px] ${
                        mLit ? "text-white ring-white/70 shadow-[0_0_40px_rgba(167,139,250,0.55)]" : "bg-[#0d0e1c] text-white/60 ring-white/15"
                      }`}
                      style={mLit ? { background: GRADIENT } : undefined}
                    >
                      <span className="text-[10px] font-medium leading-none opacity-80 lg:text-[11px]">Mês</span>
                      <span className="text-[1.25rem] font-semibold leading-none tabular-nums lg:text-[1.7rem]">{n}</span>
                    </span>
                  </div>

                  {/* Título e objetivo — à esquerda da estrada no desktop. */}
                  <div className="col-start-2 row-start-1 self-center lg:col-start-1 lg:pr-10 lg:text-right">
                    {monthForm === mi ? (
                      <MonthForm initial={m} busy={saving} onCancel={() => setMonthForm(null)} onSave={(v) => saveMonth(mi, v)} />
                    ) : (
                      <div className="lg:ml-auto lg:max-w-[460px]">
                        {m.title ? (
                          <>
                            <p className="text-[13px] font-medium text-[#c4a6ff]">{weeksLabel}</p>
                            <h2 className="mt-1 text-[1.6rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[1.95rem]">{m.title}</h2>
                          </>
                        ) : (
                          <h2 className="text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-white/85 sm:text-[1.55rem]">{weeksLabel}</h2>
                        )}
                        {m.goal && <p className="mt-2 text-[15px] leading-relaxed text-white/60">{m.goal}</p>}
                        {editing && (
                          <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                            <SmallButton onClick={() => setMonthForm(mi)} icon={Pencil}>
                              {m.title ? "Editar o mês" : "Dar nome ao mês"}
                            </SmallButton>
                            {months.length > 1 && <RemoveButton label={`Remover o mês ${n}`} confirm={`Remover o mês ${n}`} onConfirm={() => removeMonth(mi)} />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Marcos do mês — à direita da estrada; só aparecem quando há. */}
                  {showMarcos && (
                    <div className="col-start-2 row-start-2 mt-5 lg:col-start-3 lg:row-start-1 lg:mt-0 lg:self-center lg:pl-10">
                      <h3 className="text-[13px] font-medium text-white/45">Marcos do mês</h3>
                      <TaskList blocks={m.blocks} {...listProps({ month: mi, week: null }, `Mês ${n}`)} />
                    </div>
                  )}
                </div>

                <ol>
                  {m.weeks.map((w, wi) => {
                    const lane: Lane = wi % 2 === 0 ? "l" : "r";
                    const global = mi * WEEKS_PER_JOURNEY_MONTH + wi + 1;
                    const lit = passed > mStop + 1 + wi;
                    return (
                      <li key={w.id} className={`${ROW} pt-6`}>
                        <div className={`${STOP_COL} ${lane === "l" ? "lg:justify-start lg:pl-12" : "lg:justify-end lg:pr-12"}`}>
                          {/* O fio da paragem até ao cartão. */}
                          <span
                            aria-hidden
                            className={`absolute top-[30px] hidden h-px w-12 transition duration-500 lg:block ${lane === "l" ? "left-0" : "right-0"} ${
                              lit ? "bg-[#a78bfa]/70" : "bg-white/12"
                            }`}
                          />
                          <span data-stop className={stopRing(lit, "mt-[13px] h-[34px] w-[34px] text-[12.5px]")} style={lit ? { background: GRADIENT } : undefined}>
                            {global}
                          </span>
                        </div>
                        <div className={`col-start-2 row-start-1 ${lane === "l" ? "lg:col-start-1 lg:justify-self-end" : "lg:col-start-3 lg:justify-self-start"} w-full lg:max-w-[440px]`}>
                          <section
                            aria-label={`Semana ${global}`}
                            className={`rounded-[22px] border p-4 transition duration-500 sm:p-5 ${
                              lit
                                ? "border-[#783DF5]/40 bg-[#783DF5]/[0.05] shadow-[0_24px_60px_-36px_rgba(120,61,245,0.7)]"
                                : "border-white/10 bg-white/[0.025]"
                            }`}
                          >
                            <h3 className={`text-[15px] font-semibold transition ${lit ? "text-white" : "text-white/80"}`}>Semana {global}</h3>
                            <TaskList blocks={w.blocks} {...listProps({ month: mi, week: wi }, `Mês ${n} · Semana ${global}`)} />
                          </section>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}

          {editing && months.length < MAX_JOURNEY_MONTHS && (
            <li className={`${ROW} pt-10`}>
              <div className="col-span-2 flex lg:col-span-3 lg:justify-center">
                <button
                  type="button"
                  onClick={addMonth}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/25 bg-[#07080d] px-4 py-2 text-[13px] font-medium text-white/75 transition hover:border-white/45 hover:text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Acrescentar o mês {months.length + 1}
                </button>
              </div>
            </li>
          )}

          {/* Chegada */}
          <li className={`${ROW} pb-2 pt-12`}>
            <div className={`${STOP_COL} lg:justify-center`}>
              <span
                data-stop
                className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full ring-2 transition duration-500 lg:h-20 lg:w-20 ${
                  passed > endIndex ? "text-white ring-white/70 shadow-[0_0_50px_rgba(197,53,201,0.7)]" : "bg-[#0d0e1c] text-white/60 ring-white/15"
                }`}
                style={passed > endIndex ? { background: GRADIENT } : undefined}
              >
                <Star className="h-6 w-6 lg:h-8 lg:w-8" fill="currentColor" />
              </span>
            </div>
            <div className="col-start-2 row-start-1 pt-3 lg:col-start-3 lg:pl-10 lg:pt-5">
              <p className="text-[16px] font-semibold text-white">Próximo ciclo</p>
              <p className="mt-0.5 max-w-sm text-[13.5px] leading-relaxed text-white/55">A renovação: o roadmap seguinte volta a começar no mês 1.</p>
            </div>
          </li>
        </ol>
      </div>

      <JourneyTaskDrawer panel={panel} block={panelBlock} canEdit={canEdit} busy={saving} onSave={saveTask} onClose={closePanel} />
    </>
  );
}

// ---------------------------------------------------------------------------

/** Uma linha da estrada: no telemóvel [estrada | conteúdo]; no desktop
 *  [esquerda | estrada | direita]. */
const ROW = "grid grid-cols-[52px_minmax(0,1fr)] gap-x-4 lg:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)] lg:gap-x-0";
const STOP_COL = "relative col-start-1 row-start-1 flex justify-center lg:col-start-2";

function stopRing(lit: boolean, size: string) {
  return `relative z-10 flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ring-2 transition duration-500 ${size} ${
    lit ? "text-white ring-white/70 shadow-[0_0_24px_rgba(167,139,250,0.65)]" : "bg-[#0d0e1c] text-white/55 ring-white/15"
  }`;
}

/** As tarefas de uma semana (ou os marcos de um mês): só o título, que abre o
 *  painel. Um espaço por preencher só abre para a direção. */
function TaskList({
  blocks,
  editing,
  canEdit,
  onOpen,
  onRemove,
}: {
  blocks: JourneyBlock[];
  editing: boolean;
  canEdit: boolean;
  onOpen: (b: JourneyBlock | null) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="mt-3">
      {blocks.length > 0 && (
        <ul className="space-y-2">
          {blocks.map((b) => {
            const empty = Boolean(b.placeholder);
            const label = empty ? PLACEHOLDER_TITLE : b.title;
            const clickable = !empty || canEdit;
            return (
              <li key={b.id} className="flex items-center gap-1.5">
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onOpen(b)}
                    className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] ${
                      empty
                        ? "border-dashed border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"
                        : b.guide
                          ? "border-[#783DF5]/40 bg-[#783DF5]/[0.1] text-white hover:border-[#a78bfa]/70 hover:bg-[#783DF5]/[0.18]"
                          : "border-white/[0.08] bg-white/[0.03] text-white hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    {b.guide && <BookOpenCheck className="h-4 w-4 shrink-0 text-[#c4a6ff]" />}
                    <span className={`min-w-0 flex-1 text-[14.5px] leading-snug ${empty ? "" : "font-semibold"}`}>{label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
                  </button>
                ) : (
                  <span className="flex-1 rounded-xl border border-dashed border-white/12 px-3.5 py-2.5 text-[14.5px] text-white/35">{label}</span>
                )}
                {editing && <RemoveButton label="Remover a tarefa" confirm="Remover" onConfirm={() => onRemove(b.id)} />}
              </li>
            );
          })}
        </ul>
      )}
      {blocks.length === 0 && !editing && <p className="text-[13px] text-white/35">Sem tarefas nesta semana.</p>}
      {editing && blocks.length < MAX_BLOCKS_PER_SLOT && (
        <button
          type="button"
          onClick={() => onOpen(null)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 py-2 text-[12.5px] font-medium text-white/55 transition hover:border-white/40 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Acrescentar tarefa
        </button>
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-white/12 bg-[#0b0c18] px-3 py-2 text-[13.5px] text-white placeholder:text-white/30 focus:border-[#a78bfa]/70 focus:outline-none";

function MonthForm({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial: JourneyMonth;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: { title: string; goal: string }) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [goal, setGoal] = useState(initial.goal);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title: title.trim(), goal: goal.trim() });
      }}
      className="space-y-2.5 rounded-2xl border border-[#783DF5]/45 bg-[#783DF5]/[0.07] p-3 text-left lg:ml-auto lg:max-w-[460px]"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do mês (ex.: Onboarding)" maxLength={80} autoFocus className={INPUT} aria-label="Nome do mês" />
      <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="O objetivo do mês (opcional)" maxLength={240} rows={2} className={`${INPUT} resize-y`} aria-label="Objetivo do mês" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#07080d] transition hover:bg-white/90 disabled:opacity-40"
        >
          {busy ? "A guardar…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function SmallButton({ onClick, icon: Icon, children }: { onClick: () => void; icon: typeof Pencil; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[12.5px] text-white/70 transition hover:border-white/30 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/** Remover em dois toques: o primeiro arma, o segundo confirma (4 s). */
function RemoveButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button
      type="button"
      onClick={() => {
        setArmed(false);
        onConfirm();
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-500"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {confirm}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setArmed(true)}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-rose-500/20 hover:text-rose-200"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
