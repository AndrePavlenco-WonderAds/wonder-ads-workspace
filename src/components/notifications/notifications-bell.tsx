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

  return (
    <NotificationsDrawer
      initial={notifications}
      team={team}
      viewerUsername={employee.username}
    />
  );
}
