import Link from "next/link";
import { Link2, ArrowUpRight } from "lucide-react";

/** Entry card to the SEO Directories tool, shown above the SEO DPT KPIs.
 *  Mirrors KpisCard's brand-gradient style. */
export function SeoDirectoriesCard({
  href = "/seo/directories",
}: {
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="brand-gradient-border animate-fade-up group relative flex w-full flex-col gap-6 overflow-hidden rounded-2xl bg-white/[0.04] p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.07] sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="relative z-10 flex items-center gap-5">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_10px_40px_-6px_rgba(120,61,245,0.7)] transition-transform duration-500 group-hover:scale-110"
            aria-hidden
          >
            <Link2 className="h-6 w-6 text-white" strokeWidth={2.25} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-xl"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="brand-gradient-text">SEO Directories</span>
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/60 sm:text-base">
            Arranja novos backlinks para os teus clientes · diretórios com
            melhor fit por idioma, nicho e país
          </p>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2 text-sm font-medium text-white/80 transition-colors group-hover:text-white sm:text-base">
        <span>Abrir</span>
        <ArrowUpRight
          className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
          aria-hidden
        />
      </div>
    </Link>
  );
}
