"use client";

// O dropdown «Cliente ou projeto» da folha RH-03 (v77.91). Papel claro, como
// o resto da folha: a carteira do consultor no topo, depois os outros
// clientes da agência, «Interno» fixo para o trabalho sem cliente e, no fim,
// «Outro projeto» para escrever à mão o que não está na lista. Pesquisa sem
// acentos, setas + Enter, Esc fecha.
//
// O valor continua a ser texto (o título do cliente) — o relatório guarda o
// nome tal como estava no dia, mesmo que o cliente mude de nome depois.

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, CornerDownLeft, Home, PenLine, Search, Star, X } from "lucide-react";
import { INTERNAL_CLIENT, LIMITS, type ClientChoice, type ClientChoices } from "@/lib/ineficacias/shared";

type Row =
  | { kind: "internal" }
  | { kind: "client"; c: ClientChoice; group: "mine" | "others" }
  | { kind: "custom"; text: string };

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function ClientPicker({
  id,
  value,
  onChange,
  choices,
  disabled = false,
}: {
  /** Âncora para o «Ir para o que falta» da folha. */
  id: string;
  value: string;
  onChange: (v: string) => void;
  choices: ClientChoices;
  disabled?: boolean;
}) {
  const all = useMemo(() => [...choices.mine, ...choices.others], [choices]);
  const selected = all.find((c) => c.title === value) ?? null;
  const isInternal = value === INTERNAL_CLIENT;
  const [custom, setCustom] = useState(() => value.trim() !== "" && !isInternal && !selected);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const customRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const rows = useMemo<Row[]>(() => {
    const q = fold(query);
    const match = (c: ClientChoice) => !q || fold(c.title).includes(q);
    const out: Row[] = [];
    if (!q || fold(INTERNAL_CLIENT).includes(q)) out.push({ kind: "internal" });
    for (const c of choices.mine) if (match(c)) out.push({ kind: "client", c, group: "mine" });
    for (const c of choices.others) if (match(c)) out.push({ kind: "client", c, group: "others" });
    const exact = all.some((c) => fold(c.title) === q) || fold(INTERNAL_CLIENT) === q;
    out.push({ kind: "custom", text: q && !exact ? query.trim() : "" });
    return out;
  }, [query, choices, all]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    // O foco vai para a pesquisa assim que o painel abre.
    const t = setTimeout(() => searchRef.current?.focus(), 10);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      clearTimeout(t);
    };
  }, [open]);

  // A linha ativa acompanha as setas — sempre à vista dentro da lista.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(row: Row) {
    if (row.kind === "internal") {
      setCustom(false);
      onChange(INTERNAL_CLIENT);
    } else if (row.kind === "client") {
      setCustom(false);
      onChange(row.c.title);
    } else {
      setCustom(true);
      onChange(row.text);
      setTimeout(() => customRef.current?.focus(), 20);
    }
    setOpen(false);
    setQuery("");
  }

  function toggle() {
    if (disabled) return;
    setOpen((o) => !o);
    setQuery("");
    setActive(0);
  }

  if (custom) {
    return (
      <div className="relative mt-1">
        <PenLine className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#783DF5]" />
        <input
          id={id}
          ref={customRef}
          type="text"
          value={value}
          disabled={disabled}
          maxLength={LIMITS.client.max}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreve o cliente ou projeto"
          className="sheet-input !pl-9 !pr-28"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setCustom(false);
            onChange("");
            setOpen(true);
          }}
          className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-bold text-[#4c2bb0] transition hover:bg-[#783DF5]/10"
        >
          <X className="h-3 w-3" />
          Ver a lista
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative mt-1">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex min-h-[40px] w-full items-center gap-2.5 rounded-lg border bg-white/85 px-3 py-2 text-left transition focus:outline-none focus-visible:border-[#783DF5] focus-visible:shadow-[0_0_0_3px_rgba(120,61,245,0.16)] disabled:opacity-60 ${
          open ? "border-[#783DF5] shadow-[0_0_0_3px_rgba(120,61,245,0.16)]" : "border-black/[0.16] hover:border-black/35"
        }`}
      >
        {selected ? (
          <>
            <ClientMark c={selected} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#20202a]">{selected.title}</span>
            <DeptTags depts={selected.depts} />
          </>
        ) : isInternal ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#783DF5]/10 text-[#4c2bb0]">
              <Home className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#20202a]">Interno</span>
            <span className="text-[10.5px] text-black/40">sem cliente</span>
          </>
        ) : (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/[0.05] text-black/35">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-black/35">Escolhe o cliente ou projeto</span>
          </>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-black/40 transition ${open ? "rotate-180 text-[#783DF5]" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-black/12 bg-[#fdfcfa] shadow-[0_24px_60px_-18px_rgba(20,10,40,0.45)]">
          <div className="flex items-center gap-2 border-b border-black/[0.07] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-black/35" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, rows.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const row = rows[active];
                  if (row) choose(row);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder="Procurar cliente…"
              className="w-full bg-transparent text-[13px] text-[#20202a] outline-none placeholder:text-black/30"
            />
            <kbd className="hidden shrink-0 rounded border border-black/12 px-1.5 py-0.5 font-mono text-[9.5px] text-black/35 sm:inline">esc</kbd>
          </div>

          <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const header =
                row.kind === "client" && (prev?.kind !== "client" || prev.group !== row.group)
                  ? row.group === "mine"
                    ? "A tua carteira"
                    : choices.mine.length > 0
                      ? "Outros clientes da agência"
                      : "Clientes da agência"
                  : null;
              const on = i === active;
              const isCurrent =
                (row.kind === "client" && row.c.title === value) || (row.kind === "internal" && isInternal);
              return (
                <li key={row.kind === "client" ? row.c.slug : row.kind} role="option" aria-selected={isCurrent}>
                  {header && (
                    <p className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-black/35">
                      {row.kind === "client" && row.group === "mine" && <Star className="h-3 w-3 fill-[#783DF5]/30 text-[#783DF5]" />}
                      {header}
                    </p>
                  )}
                  {row.kind === "custom" && <div className="mx-3 my-1 border-t border-black/[0.07]" />}
                  <button
                    type="button"
                    data-row={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(row)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${on ? "bg-[#783DF5]/[0.08]" : ""}`}
                  >
                    {row.kind === "internal" ? (
                      <>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#783DF5]/10 text-[#4c2bb0]">
                          <Home className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-[#20202a]">Interno</span>
                          <span className="block text-[10.5px] text-black/45">Trabalho da agência, sem cliente</span>
                        </span>
                      </>
                    ) : row.kind === "client" ? (
                      <>
                        <ClientMark c={row.c} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#20202a]">{row.c.title}</span>
                        <DeptTags depts={row.c.depts} />
                      </>
                    ) : (
                      <>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-black/25 text-black/45">
                          <PenLine className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-black/65">
                          {row.text ? (
                            <>
                              Usar <strong className="font-semibold text-[#20202a]">«{row.text}»</strong>
                            </>
                          ) : (
                            "Outro projeto — escrever à mão"
                          )}
                        </span>
                      </>
                    )}
                    {isCurrent ? (
                      <Check className="h-4 w-4 shrink-0 text-[#783DF5]" strokeWidth={2.5} />
                    ) : on ? (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-black/30" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ClientMark({ c }: { c: ClientChoice }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/[0.05] text-[12px] font-bold text-black/55">
      {c.icon ?? c.title.slice(0, 1).toUpperCase()}
    </span>
  );
}

function DeptTags({ depts }: { depts: string[] }) {
  return (
    <span className="flex shrink-0 gap-1">
      {depts.map((d) => (
        <span key={d} className="rounded border border-black/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-black/40">
          {d}
        </span>
      ))}
    </span>
  );
}
