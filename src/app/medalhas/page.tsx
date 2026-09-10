// /medalhas — a galeria de medalhas da pessoa com sessão (v77.25).
//
// Mostra o catálogo inteiro (o que dá para ganhar), o que já tem, o
// progresso em cada uma e deixa escolher as três que vão para o header.
// Segue a pessoa VISTA com «Ver como» — o SuperAdmin vê a galeria dela —
// mas a escolha fica só de leitura, como o resto da lente.

import { Medal as MedalIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { MedalBadge } from "@/components/medals/medal-badge";
import { MedalsGallery, type GalleryItem } from "@/components/medals/medals-gallery";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { MEDALS, progressFor } from "@/lib/medals/catalog";
import { getMedalsForUser } from "@/lib/medals/server";
import { closedCount, presentedCount } from "@/lib/proposals/leaderboard";
import { formatEur } from "@/lib/proposals/value";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Medalhas — Wonder Ads Workspace",
};

export default async function MedalhasPage() {
  const [employee, impersonation] = await Promise.all([getCurrentEmployee(), getImpersonation().catch(() => null)]);
  if (!employee) return null;
  const mine = await getMedalsForUser(employee.username);
  const items: GalleryItem[] = MEDALS.map((medal) => ({
    medal,
    progress: progressFor(medal, mine.row, mine.board),
  }));
  const earned = items.filter((i) => i.progress.earned).length;
  const row = mine.row;

  return (
    <PageShell backHref="/" backLabel="workspace">
      <section className="animate-fade-up mt-4 sm:mt-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <MedalIcon className="h-3.5 w-3.5 text-amber-300" />
              Comercial · {employee.name}
            </p>
            <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">Medalhas</h1>
            <p className="mt-3 max-w-2xl text-base text-white/65 sm:text-lg">
              <span className="font-semibold text-white">{earned}</span> de {MEDALS.length} conquistadas. As de patamar
              ficam para sempre; as «Top» são de quem lidera agora. Escolhe até três para o header.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.14em]">
            <Stat n={row ? String(closedCount(row)) : "0"} label="fechadas" />
            <Stat n={row ? String(presentedCount(row)) : "0"} label="apresentadas" />
            <Stat n={formatEur(row?.closedValue ?? 0)} label="fechado" />
            <Stat n={formatEur(row?.biggestClosedValue ?? 0)} label="maior negócio" />
          </div>
        </div>

        {/* As que tem, em grande — a estante. */}
        {mine.earned.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            {mine.earned.map(({ medal }) => (
              <span key={medal.id} title={`${medal.name} · ${medal.requirement}`} className="inline-flex">
                <MedalBadge medal={medal} size={48} />
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="animate-fade-up mt-10 sm:mt-12">
        <MedalsGallery
          items={items}
          chosen={mine.chosen}
          defaultDisplay={mine.display.map((m) => m.id)}
          canChoose={!impersonation}
        />
      </section>
    </PageShell>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-white/60">
      <span className="text-[13px] font-bold tracking-normal text-white">{n}</span>
      {label}
    </span>
  );
}
