// Chip «Reviews» no cabeçalho do cliente no SEO (ao lado do NPS) — só para
// os clientes com Reviews Hub. Mostra a média Google e o que falta responder,
// e abre a plataforma (a equipa entra sem password; o cliente usa a dele).

import { Star } from "lucide-react";
import { getHubConfig, hubPath } from "@/lib/reviews-hub/config";
import { getSummary } from "@/lib/reviews-hub/store";

export async function ReviewsHubChip({ slug }: { slug: string }) {
  if (!getHubConfig(slug)) return null;
  const summary = await getSummary(slug).catch(() => null);
  const avg = summary?.average ?? null;
  const pending = summary?.unanswered ?? 0;
  const negative = summary?.negativeUnanswered ?? 0;
  const approval = summary?.awaitingApproval ?? 0;

  const title = summary
    ? `Plataforma de respostas a reviews · ${summary.total.toLocaleString("pt-PT")} reviews Google` +
      (pending ? ` · ${pending} por responder (${negative} negativas)` : " · tudo respondido") +
      (approval ? ` · ${approval} à espera de aprovação` : "") +
      " — o cliente entra com password"
    : "Plataforma de respostas a reviews — ainda sem sincronização (abre e liga-se ao Google)";

  return (
    <a
      href={hubPath(slug)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/65 transition hover:border-amber-300/40 hover:bg-amber-300/[0.06] hover:text-white"
    >
      <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
      <span className="uppercase tracking-[0.08em] text-white/45">Reviews</span>
      {avg !== null ? (
        <span className="font-semibold text-amber-200">
          {avg.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </span>
      ) : (
        <span className="font-semibold text-white/70">Abrir</span>
      )}
      {pending > 0 && (
        <span
          className={`ml-0.5 rounded-full px-1.5 text-[10px] font-semibold ${
            negative > 0 ? "bg-rose-500/20 text-rose-200" : "bg-white/10 text-white/70"
          }`}
        >
          {pending > 999 ? "999+" : pending} por responder
        </span>
      )}
    </a>
  );
}
