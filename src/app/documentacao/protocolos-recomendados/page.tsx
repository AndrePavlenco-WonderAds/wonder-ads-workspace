// /documentacao/protocolos-recomendados — os Protocolos Recomendados do SEO DPT (v78.46).
// A página é a mesma das duas listas: ver components/documentacao/protocol-page.tsx.

import { ProtocolPage } from "@/components/documentacao/protocol-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Protocolos Recomendados — Documentação",
};

export default function ProtocolosRecomendadosPage() {
  return <ProtocolPage list="recomendados" />;
}
