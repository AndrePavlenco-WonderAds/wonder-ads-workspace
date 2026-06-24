"use client";

// Filterable client picker. Suggests registered clients as you type and,
// on selection, hands the full option back so the caller can pre-fill the
// rest of the form (default designer, slug, vault). Free text is always
// allowed — typing a name that isn't registered yet just means "new
// client", and the caller decides what to do with it.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";

export type ClientOption = {
  slug: string;
  name: string;
  defaultAssigneeUsername?: string;
  defaultAssigneeName?: string;
  /** True when this is a saved registry profile (vs a name merely seen on
   *  an existing project/ticket). */
  registered?: boolean;
};

export function ClientCombobox({
  value,
  onChange,
  onPick,
  options,
  placeholder = "ex.: Acme Clinic",
  inputClassName,
  id,
}: {
  /** The current client name (controlled). */
  value: string;
  /** Called on every keystroke — keeps the name in sync for new clients. */
  onChange: (name: string) => void;
  /** Called when an existing client is chosen (full option) or when the
   *  field no longer matches any registered client (null = new client). */
  onPick?: (option: ClientOption | null) => void;
  options: ClientOption[];
  placeholder?: string;
  inputClassName?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
    return list.slice(0, 8);
  }, [options, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (o: ClientOption) => {
    onChange(o.name);
    onPick?.(o);
    setOpen(false);
  };

  const exactMatch = useMemo(
    () =>
      options.find(
        (o) => o.name.trim().toLowerCase() === value.trim().toLowerCase(),
      ) ?? null,
    [options, value],
  );

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            onPick?.(null);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              setOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              pick(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className={
            inputClassName ??
            "w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 pr-9 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          }
        />
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/12 bg-[#14141b] py-1 shadow-xl shadow-black/40">
          {matches.map((o, i) => (
            <li key={o.slug}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                  i === active ? "bg-white/[0.07] text-white" : "text-white/75"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {exactMatch?.slug === o.slug ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-white/35" />
                  )}
                  <span className="truncate">{o.name}</span>
                </span>
                {o.defaultAssigneeName && (
                  <span className="shrink-0 text-[11px] text-white/40">
                    {o.defaultAssigneeName}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
