"use client";

// Navegação do overview de admin da Formação. Quatro áreas, sempre visíveis,
// com a atual destacada — o mesmo hábito das outras secções do workspace.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Film, Pencil, Users } from "lucide-react";

const TABS = [
  { href: "/formacao/admin", label: "Equipa", Icon: Users, exact: true },
  { href: "/formacao/admin/conteudo", label: "Gravações", Icon: Film },
  {
    href: "/formacao/admin/inscricoes",
    label: "Inscrições",
    Icon: ClipboardList,
  },
  { href: "/formacao/admin/cms", label: "Conteúdo", Icon: Pencil },
];

export function TrainingAdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1.5">
      {TABS.map(({ href, label, Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium transition ${
              active
                ? "border-[#783DF5]/45 bg-[#783DF5]/12 text-white"
                : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/85"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
