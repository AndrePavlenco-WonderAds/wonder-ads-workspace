// Os dois chips de download dos templates (canto superior direito do
// Comercial). Cada um bate em /api/commercial/templates/<tipo>, que gera o
// PDF a pedido — ficheiro sempre atual, sem nada estático a manter.

import { Download, FileSignature, Sparkles } from "lucide-react";

const TEMPLATES = [
  {
    kind: "renovacao",
    label: "Template · Renovação",
    hint: "PDF com a estrutura da proposta de renovação (7 secções) e campos entre [ ]",
    Icon: FileSignature,
  },
  {
    kind: "cross-sell",
    label: "Template · Cross-sell",
    hint: "PDF com a estrutura do orçamento de serviço (itens, incluído/não incluído, condições)",
    Icon: Sparkles,
  },
] as const;

export function TemplateChips() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TEMPLATES.map((t) => (
        <a
          key={t.kind}
          href={`/api/commercial/templates/${t.kind}`}
          download
          title={t.hint}
          className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] py-1.5 pl-3 pr-2 text-[11.5px] font-semibold text-white/80 backdrop-blur-md transition hover:border-white/35 hover:bg-white/[0.1] hover:text-white"
        >
          <t.Icon className="h-3.5 w-3.5 text-[#c4b5fd]" />
          {t.label}
          <span className="brand-gradient-bg inline-flex h-5 w-5 items-center justify-center rounded-full text-white transition group-hover:scale-110">
            <Download className="h-3 w-3" />
          </span>
        </a>
      ))}
    </div>
  );
}
