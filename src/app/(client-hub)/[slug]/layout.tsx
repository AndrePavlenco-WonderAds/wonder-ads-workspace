// As páginas públicas de um cliente (v80.36): por cima de tudo, só a
// pastilha do prazo de acesso — aparece quando o projeto está em pausa e um
// SuperAdmin desbloqueou a parte desta página. Sem headers() nem leituras
// aqui: as páginas por baixo podem ser estáticas.

import { ProjectUnlockBanner } from "@/components/project-unlock-banner";

export default async function ClientPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      {children}
      <ProjectUnlockBanner slug={slug} />
    </>
  );
}
