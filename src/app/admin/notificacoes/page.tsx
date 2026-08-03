// SuperAdmin → Notificações. As regras que geram os lembretes que aparecem no
// sino do header de toda a gente. Fechada pelo layout do /admin (isAdmin).
//
// Uma nota que vale a pena ter à frente dos olhos e por isso está na página:
// as notificações não são gravadas, são calculadas. Mudar uma regra tem efeito
// imediato para toda a gente — não há fila nem cron para esperar.

import Link from "next/link";
import { ArrowLeft, BellRing } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { NotificationRulesPanel } from "@/components/notifications/notification-rules-panel";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  getNotificationRules,
  notificationRulesAreCustom,
} from "@/lib/notifications/rules-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Notificações — SuperAdmin Control Suite",
};

export default async function AdminNotificationsPage() {
  const [rules, isCustom, employee] = await Promise.all([
    getNotificationRules(),
    notificationRulesAreCustom(),
    getCurrentEmployee(),
  ]);

  return (
    <PageShell wide>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        SuperAdmin Control Suite
      </Link>

      <div className="animate-fade-up mb-8 mt-6">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight sm:text-4xl">
          <BellRing className="h-7 w-7 text-[#b79bff]" />
          <span className="brand-gradient-text">Notificações</span>
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-white/50">
          As regras que alimentam o sino no topo da app. Uma regra por cliente
          gera uma linha por cada cliente da carteira do consultor, cada uma com
          o seu botão de ação e o seu «concluído». Não há cron nem fila: a lista
          é calculada a partir do calendário sempre que alguém abre o painel,
          por isso uma alteração aqui tem efeito imediato.
        </p>
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-white/35">
          Gravar aqui cria um override que vence os defaults do código — se um
          dia uma regra nova não aparecer depois de um deploy, é isto. «Repor
          originais» apaga o override; o que os consultores já marcaram como
          concluído nunca é apagado.
        </p>
      </div>

      <div className="animate-fade-up">
        <NotificationRulesPanel
          initial={rules}
          isCustom={isCustom}
          currentUser={employee?.username ?? "—"}
        />
      </div>
    </PageShell>
  );
}
