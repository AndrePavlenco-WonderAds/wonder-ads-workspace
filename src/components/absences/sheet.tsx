"use client";

// As peças da FOLHA — o material de que os formulários de RH são feitos:
// secções numeradas que se carimbam quando ficam completas, campos com
// linha pontilhada, e a linha de assinatura que escreve o nome à mão.
//
// Vivem aqui, e não dentro de um dos formulários, porque há duas folhas
// com o mesmo papel: a RH-01 (o pedido que o colaborador assina) e a RH-02
// (a falta que o C-Level lança). Se a assinatura animada só existisse numa
// delas, a outra ia nascer com uma imitação — e as duas iam divergir ao
// primeiro retoque.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, PenLine } from "lucide-react";

/* -------------------------- helpers de data ----------------------- */

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** DD/MM/YYYY — o formato da casa. */
export function formatDatePT(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fileSizeLabel(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------------------------- as peças ---------------------------- */

export function SheetSection({
  n,
  title,
  done = false,
  last = false,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`relative ${last ? "" : "mb-7 border-b border-black/[0.07] pb-7"}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden
          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-extrabold transition ${
            done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-black/25 bg-white/70 text-black/50"
          }`}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
        </span>
        <h3 className="text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-black/60">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export function SheetField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="border-b border-dotted border-black/30 pb-1 text-[13.5px] font-semibold text-[#20202a]">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">
        {label}
      </p>
    </div>
  );
}

/** A linha de assinatura + a escrita animada + o carimbo.
 *
 *  Os rótulos são parâmetros porque quem assina muda com a folha: numa RH-01
 *  é o colaborador e o carimbo diz SUBMETIDO; numa RH-02 é o C-Level e o
 *  carimbo diz REGISTADO. */
export function SignatureLine({
  name,
  playing,
  showStamp,
  stampRef,
  onDone,
  signatureLabel = "Assinatura do colaborador",
  stampLabel = "Submetido",
  placeholder = "A tua assinatura",
}: {
  name: string;
  playing: boolean;
  showStamp: boolean;
  stampRef: string | null;
  onDone: () => void;
  signatureLabel?: string;
  stampLabel?: string;
  placeholder?: string;
}) {
  const letters = useMemo(() => Array.from(name), [name]);
  const [revealed, setRevealed] = useState(0);
  const [underline, setUnderline] = useState(false);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [penX, setPenX] = useState(0);

  useEffect(() => {
    if (!playing) {
      setRevealed(0);
      setUnderline(false);
      setPenX(0);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || letters.length === 0) {
      setRevealed(letters.length);
      setUnderline(true);
      const t = setTimeout(onDone, 250);
      return () => clearTimeout(t);
    }
    // Nem lento demais num nome curto, nem eterno num nome comprido: o passo
    // ajusta-se para a escrita durar ~1.4–2s no total.
    const step = Math.max(45, Math.min(95, Math.round(1500 / letters.length)));
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setRevealed(i);
      const el = letterRefs.current[i - 1];
      if (el) setPenX(el.offsetLeft + el.offsetWidth);
      if (i >= letters.length) {
        clearInterval(timer);
        setUnderline(true);
        setTimeout(onDone, 750);
      }
    }, step);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, letters]);

  const writing = playing && revealed < letters.length;

  return (
    <div className="relative mt-4">
      <div className="relative flex min-h-[74px] items-end overflow-hidden px-1">
        {/* O nome, escrito à mão */}
        <p
          aria-live="polite"
          aria-label={playing ? `A assinar como ${name}` : undefined}
          className="font-signature relative z-10 whitespace-nowrap text-[38px] font-semibold leading-none text-[#2b3a94] sm:text-[42px]"
        >
          {playing ? (
            letters.map((ch, i) => (
              <span
                key={i}
                ref={(el) => {
                  letterRefs.current[i] = el;
                }}
                className={i < revealed ? "signature-letter" : "opacity-0"}
              >
                {ch === " " ? " " : ch}
              </span>
            ))
          ) : (
            <span className="select-none text-black/[0.13]">
              {name || placeholder}
            </span>
          )}
        </p>

        {/* A caneta a acompanhar a escrita */}
        {writing && (
          <PenLine
            aria-hidden
            className="signature-pen absolute z-20 h-6 w-6 text-[#2b3a94] transition-[left] duration-75 ease-linear"
            style={{ left: penX + 6, bottom: 18 }}
          />
        )}

        {/* Carimbo */}
        {showStamp && (
          <div aria-hidden className="stamp-in absolute right-1 top-0 z-30 opacity-0">
            <div className="rounded-md border-[2.5px] border-[#2b3a94]/80 bg-[#2b3a94]/[0.04] px-3 py-1.5 text-center">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.26em] text-[#2b3a94]">
                {stampLabel}
              </p>
              {stampRef && (
                <p className="mt-0.5 font-mono text-[9px] font-bold tracking-[0.1em] text-[#2b3a94]/75">
                  {stampRef}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* A linha de assinatura + o traço desenhado */}
      <div className="relative">
        <div className="border-b border-black/35" />
        {underline && (
          <svg
            aria-hidden
            viewBox="0 0 320 12"
            preserveAspectRatio="none"
            className="absolute -top-2 left-0 h-3 w-full"
          >
            <path
              d="M4 8 C 70 3, 150 10, 240 5 S 310 6, 316 4"
              fill="none"
              stroke="#2b3a94"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="signature-underline"
            />
          </svg>
        )}
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">
          {signatureLabel}
        </p>
      </div>
    </div>
  );
}
