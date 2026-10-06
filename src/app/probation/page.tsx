// O plano de probation do próprio consultor — o que a direção lhe ENVIOU
// (nunca o rascunho): o documento, os check-ins semanais e as avaliações,
// cada um com a confirmação de leitura. O username vem da sessão; quem não
// tem plano vê uma página vazia e neutra.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ConsultantPlan } from "@/components/probation/consultant-plan";
import { getCurrentEmployee } from "@/lib/auth/server";
import { listPublishedForUser } from "@/lib/probation/store";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "O meu plano de probation · Wonder Ads",
  robots: { index: false, follow: false },
};

export default async function MyProbationPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login?next=/probation");
  const plans = await listPublishedForUser(me.username);
  const today = todayLisbonISO();

  return (
    <PageShell backHref="/" backLabel="Início">
      {plans.length === 0 ? (
        <div className="animate-fade-up mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-white/12 px-6 py-12 text-center">
          <ClipboardCheck className="mx-auto h-7 w-7 text-white/25" />
          <p className="mt-3 text-[14px] font-medium text-white/70">Não tens nenhum plano de probation.</p>
          <p className="mt-1 text-[12.5px] text-white/40">Se te enviarem um, aparece aqui e no sino.</p>
        </div>
      ) : (
        <div className="space-y-16">
          {plans.map((pub) => (
            <ConsultantPlan key={pub.id} pub={pub} today={today} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
