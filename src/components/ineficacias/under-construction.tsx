// O painel «Em construção» das Ineficácias — o que os consultores veem
// enquanto o André afina o sistema (ver lib/ineficacias/access.ts).

import Link from "next/link";
import { ArrowLeft, Construction, HardHat } from "lucide-react";

export function UnderConstruction({ name }: { name: string }) {
  return (
    <section className="animate-fade-up mt-10 flex justify-center sm:mt-16">
      <div className="brand-gradient-border relative w-full max-w-lg overflow-hidden rounded-3xl bg-white/[0.035] p-8 text-center backdrop-blur-md sm:p-10">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#783DF5]/20 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#C535C9]/15 blur-3xl"
        />
        <div className="relative flex flex-col items-center">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/10 shadow-[0_18px_50px_-18px_rgba(251,191,36,0.6)]">
            <Construction className="h-7 w-7 text-amber-300" strokeWidth={2} />
            <HardHat className="absolute -right-2 -top-2 h-5 w-5 rotate-12 text-amber-200/80" />
          </span>
          <p className="readout mt-5 text-amber-200/70">Em construção</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
            Ineficácias — <span className="brand-gradient-text">a chegar em breve</span>
          </h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-white/60">
            {name.split(" ")[0]}, estamos a montar o sistema de relatório semanal de ineficácias — com o PA, o NO e a
            escala de níveis que viste na apresentação. Quando abrir, aparece aqui e no sino.
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10.5px] uppercase tracking-[0.18em] text-white/45">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
            Em desenvolvimento
          </div>
          <Link
            href="/"
            className="group mt-7 inline-flex items-center gap-2 text-[12.5px] font-medium text-white/60 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </section>
  );
}
