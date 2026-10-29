// /documentacao/protocolos-proibidos — os Protocolos Proibidos, de toda a equipa (v78.51).
// A página é a mesma das outras listas: ver components/documentacao/protocol-page.tsx.

import { ProtocolPage } from "@/components/documentacao/protocol-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Protocolos Proibidos — Documentação",
};

export default function ProtocolosProibidosPage() {
  return <ProtocolPage list="proibidos" />;
}
