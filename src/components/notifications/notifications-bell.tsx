// Lado servidor do sino do header: lê a sessão, calcula as notificações desta
// pessoa e entrega-as ao painel. Sem sessão válida (ex.: em /login) não
// renderiza nada — tal como o UserChip ao lado.
//
// O cálculo é barato: duas leituras de KV (regras + estado) e, só quando
// alguma regra é por cliente, a lista de clientes SEO — que já está em
// `unstable_cache` e é partilhada com o resto da app.

import { getCurrentEmployee } from "@/lib/auth/server";
import { getUserNotifications } from "@/lib/notifications/server";
import { NotificationsDrawer } from "./notifications-drawer";

export async function NotificationsBell() {
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  let notifications = await getUserNotifications({
    username: employee.username,
    name: employee.name,
    dept: employee.dept,
  }).catch((err) => {
    // O header nunca pode ser o motivo de uma página não abrir.
    console.error("Notificações: cálculo falhou:", err);
    return [];
  });
  // Defensivo: uma regra mal configurada não pode transformar o painel numa
  // lista infinita.
  if (notifications.length > 200) notifications = notifications.slice(0, 200);

  return <NotificationsDrawer initial={notifications} />;
}
