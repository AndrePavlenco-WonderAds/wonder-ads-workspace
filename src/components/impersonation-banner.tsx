// Faixa que fica no ecrã enquanto um SuperAdmin está a ver a app como
// outra pessoa.
//
// PORQUE EXISTE E NÃO SE FECHA: o chip do header já muda de cor, mas o
// header desaparece com o scroll e há páginas que se abrem a meio. Estar na
// pele de outra pessoa sem dar por isso é a única forma de este mecanismo
// correr mal — lê-se «não tenho acesso a isto» como um bug da app, ou
// escreve-se algo a pensar que é em nome próprio. A faixa é o preço de
// nunca haver dúvida.
//
// PORQUE EM BAIXO E NÃO EM CIMA: o header da app já é `sticky top-0`; duas
// coisas coladas ao topo tapam-se uma à outra. Em baixo não disputa espaço
// com nada e continua sempre à vista — o PageShell abre a margem no rodapé
// para ela não tapar a última linha.
//
// Diz também que a vista é só de leitura, porque o bloqueio é real (está no
// middleware) e um 403 sem explicação parece avaria.

import { Eye } from "lucide-react";
import { StopImpersonatingButton } from "./stop-impersonating-button";

export function ImpersonationBanner({
  viewingName,
  viewingRole,
  viewingDept,
  realName,
}: {
  viewingName: string;
  viewingRole: string;
  viewingDept: string;
  realName: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-amber-400/35 bg-amber-500/[0.16] px-4 py-1.5 text-[11.5px] text-amber-100 backdrop-blur-md">
      <span className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        A ver a app como{" "}
        <strong className="font-semibold text-white">{viewingName}</strong>
        <span className="text-amber-200/70">
          ({viewingRole} · {viewingDept})
        </span>
        <span className="text-amber-200/70">· só de leitura</span>
      </span>
      <StopImpersonatingButton realName={realName} />
    </div>
  );
}
