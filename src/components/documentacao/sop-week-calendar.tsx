// A semana-tipo do SEO DPT no SOP de Comunicação (v80.9), desenhada como
// uma vista semanal do Google Calendar: horas de lado (9h–20h), um dia por
// coluna, cada evento posicionado pela hora. É um EXEMPLO de agenda, para
// parecer uma semana real: as três reuniões fixas da equipa, reuniões com
// clientes espalhadas, 30 min de almoço, o Daily Update ao fim do dia, ginásio
// ao fim da tarde, e «Foco» em todos os espaços livres de 45 min ou mais.
// Servidor, sem estado.

const START = 9;
const END = 20;
const HOUR_PX = 46;
const WORK_END = 18;

type Kind = "equipa" | "cliente" | "almoco" | "daily" | "gym" | "foco";
type Ev = { start: number; end: number; title: string; kind: Kind };

const DAYS: Array<{ day: string; events: Ev[] }> = [
  {
    day: "Segunda",
    events: [
      { start: 10, end: 11, title: "Reunião com Cliente A", kind: "cliente" },
      { start: 13, end: 13.5, title: "Almoço", kind: "almoco" },
      { start: 15.5, end: 16.5, title: "Bloqueios e calls", kind: "equipa" },
      { start: 18, end: 18.5, title: "Daily Update", kind: "daily" },
    ],
  },
  {
    day: "Terça",
    events: [
      { start: 11.5, end: 12.5, title: "Reunião com Cliente B", kind: "cliente" },
      { start: 13, end: 13.5, title: "Almoço", kind: "almoco" },
      { start: 18, end: 18.5, title: "Daily Update", kind: "daily" },
      { start: 18.5, end: 20, title: "Gym", kind: "gym" },
    ],
  },
  {
    day: "Quarta",
    events: [
      { start: 9.5, end: 10.25, title: "Reunião com Cliente C", kind: "cliente" },
      { start: 13, end: 13.5, title: "Almoço", kind: "almoco" },
      { start: 14, end: 15.5, title: "Deep dive", kind: "equipa" },
      { start: 18, end: 18.5, title: "Daily Update", kind: "daily" },
    ],
  },
  {
    day: "Quinta",
    events: [
      { start: 13, end: 13.5, title: "Almoço", kind: "almoco" },
      { start: 15, end: 16, title: "Reunião com Cliente D", kind: "cliente" },
      { start: 18, end: 18.5, title: "Daily Update", kind: "daily" },
      { start: 18.5, end: 20, title: "Gym", kind: "gym" },
    ],
  },
  {
    day: "Sexta",
    events: [
      { start: 11, end: 11.75, title: "Reunião com Cliente E", kind: "cliente" },
      { start: 13, end: 13.5, title: "Almoço", kind: "almoco" },
      { start: 15.5, end: 16.25, title: "Fecho da semana", kind: "equipa" },
      { start: 18, end: 18.5, title: "Daily Update", kind: "daily" },
      { start: 18.5, end: 20, title: "Gym", kind: "gym" },
    ],
  },
];

const STYLE: Record<Kind, string> = {
  equipa: "bg-[#c4a6ff] text-[#120f24] font-semibold",
  cliente: "border-l-[3px] border-sky-300 bg-sky-400/[0.18] text-sky-50",
  almoco: "bg-white/[0.07] text-white/55",
  daily: "border border-dashed border-[#c4a6ff]/60 bg-[#783DF5]/[0.12] text-[#e4d9ff]",
  gym: "border-l-[3px] border-emerald-300 bg-emerald-400/[0.14] text-emerald-50",
  foco: "border border-white/[0.06] bg-white/[0.02] text-white/30",
};

const LEGEND: Array<{ kind: Kind; label: string }> = [
  { kind: "equipa", label: "Reunião de equipa" },
  { kind: "cliente", label: "Reunião com cliente" },
  { kind: "foco", label: "Foco" },
  { kind: "daily", label: "Daily Update" },
  { kind: "almoco", label: "Almoço" },
  { kind: "gym", label: "Pessoal" },
];

function hhmm(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}h${mins ? String(mins).padStart(2, "0") : ""}`;
}

/** «Foco» em cada espaço livre de 45 min ou mais, dentro do horário. */
function withFocus(events: Ev[]): Ev[] {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const out: Ev[] = [];
  let cursor = START;
  for (const e of sorted) {
    const gapEnd = Math.min(e.start, WORK_END);
    if (gapEnd - cursor >= 0.75) out.push({ start: cursor, end: gapEnd, title: "Foco", kind: "foco" });
    cursor = Math.max(cursor, e.end);
  }
  if (WORK_END - cursor >= 0.75) out.push({ start: cursor, end: WORK_END, title: "Foco", kind: "foco" });
  return [...out, ...sorted];
}

export function SopWeekCalendar() {
  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const height = (END - START) * HOUR_PX;
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[680px]">
          {/* Cabeçalho dos dias */}
          <div className="grid grid-cols-[3.25rem_repeat(5,1fr)] border-b border-white/10">
            <span />
            {DAYS.map((d) => (
              <span key={d.day} className="border-l border-white/[0.06] py-2.5 text-center text-[12.5px] font-semibold text-white/65">
                {d.day}
              </span>
            ))}
          </div>

          <div className="relative grid grid-cols-[3.25rem_repeat(5,1fr)]" style={{ height }}>
            {/* Horas + linhas */}
            <div className="relative">
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-white/35"
                  style={{ top: i * HOUR_PX }}
                >
                  {i === 0 ? "" : `${h}h`}
                </span>
              ))}
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-0 left-[3.25rem]">
              {hours.map((h, i) => (
                <span key={h} className="absolute inset-x-0 border-t border-white/[0.05]" style={{ top: i * HOUR_PX }} />
              ))}
            </div>

            {DAYS.map((d) => (
              <div key={d.day} className="relative border-l border-white/[0.06]">
                {withFocus(d.events).map((e) => {
                  const top = (e.start - START) * HOUR_PX + 1;
                  const h = (e.end - e.start) * HOUR_PX - 3;
                  const short = e.end - e.start <= 0.5;
                  return (
                    <div
                      key={`${e.kind}-${e.start}`}
                      className={`absolute inset-x-1 overflow-hidden rounded-md px-2 ${short ? "flex items-center py-0" : "py-1"} ${STYLE[e.kind]}`}
                      style={{ top, height: h }}
                      title={`${e.title} · ${hhmm(e.start)}–${hhmm(e.end)}`}
                    >
                      {short ? (
                        <p className="truncate text-[11px] leading-none">
                          {e.title} <span className="opacity-60">{hhmm(e.start)}</span>
                        </p>
                      ) : (
                        <>
                          <p className="truncate text-[11.5px] font-medium leading-tight">{e.title}</p>
                          {e.kind !== "foco" && (
                            <p className="truncate text-[10.5px] leading-tight opacity-70">
                              {hhmm(e.start)} – {hhmm(e.end)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map((l) => (
          <li key={l.kind} className="flex items-center gap-2 text-[12px] text-white/55">
            <span aria-hidden className={`h-3 w-3 rounded-[4px] ${STYLE[l.kind]}`} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
