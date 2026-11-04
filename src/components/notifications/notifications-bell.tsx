// Lado servidor do sino do header: lê a sessão, calcula as notificações desta
// pessoa e entrega-as ao painel. Sem sessão válida (ex.: em /login) não
// renderiza nada — tal como o UserChip ao lado.
//
// O cálculo é barato: duas leituras de KV (regras + estado) e, só quando
// alguma regra é por cliente, a lista de clientes SEO — que já está em
// `unstable_cache` e é partilhada com o resto da app.
//
// QUEM É SUPERADMIN LEVA MAIS UMA COISA: a fotografia das notificações de
// toda a equipa, que aparece por baixo das dele no mesmo painel. Custa um
// `mget` (uma operação KV) porque a carteira e as regras já foram lidas —
// não é uma leitura por pessoa.

import { getCurrentEmployee } from "@/lib/auth/server";
import {
  getTeamNotificationSummary,
  getUserNotifications,
} from "@/lib/notifications/server";
import { overloadAppliesTo, type OverloadState } from "@/lib/notifications/overload";
import { resolveOverload } from "@/lib/notifications/overload-store";
import { NotificationsDrawer } from "./notifications-drawer";

export async function NotificationsBell() {
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  const [own, team] = await Promise.all([
    getUserNotifications({
      username: employee.username,
      name: employee.name,
      dept: employee.dept,
    }).catch((err) => {
      // O header nunca pode ser o motivo de uma página não abrir.
      console.error("Notificações: cálculo falhou:", err);
      return [];
    }),
    employee.isAdmin
      ? getTeamNotificationSummary().catch((err) => {
          console.error("Notificações: painel de equipa falhou:", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // Defensivo: uma regra mal configurada não pode transformar o painel numa
  // lista infinita.
  const notifications = own.length > 200 ? own.slice(0, 200) : own;

  // Excesso de notificações (v78.70): aos 7 em aberto avisa, aos 10 o aviso
  // volta em cada página até a pessoa descer abaixo de 5. Conta o MESMO que
  // o número do sino dela — o aviso não pode dizer um número que ela não vê.
  let overload: OverloadState | null = null;
  if (overloadAppliesTo(employee)) {
    const pendingCount = own.filter((n) => !n.resolved).length;
    overload = await resolveOverload(employee.username, pendingCount).catch(
      (err) => {
        console.error("Notificações: nível de excesso falhou:", err);
        return null;
      },
    );
  }

  return (
    <NotificationsDrawer
      initial={notifications}
      team={team}
      viewerUsername={employee.username}
      overload={overload}
    />
  );
}
