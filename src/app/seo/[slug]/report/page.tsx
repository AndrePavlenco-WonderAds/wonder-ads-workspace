import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getClientBySlug } from "@/lib/notion";
import { ReportSection } from "@/components/report/report-section";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  return {
    title: client
      ? `Relatórios Mensais — ${client.title} · Wonder Ads`
      : "Relatórios — Wonder Ads",
  };
}

export default async function ReportHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const employee = await getCurrentEmployee();
  const readOnly = !employee || !editableDepts(employee).includes("seo");

  return (
    <PageShell wide backHref={`/seo/${slug}`} backLabel={client.title}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-7">
          <Link
            href={`/seo/${slug}`}
            className="inline-flex items-center gap-1.5 text-[12px] text-white/45 transition hover:text-white/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {client.title}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Relatório Mensal · <span className="brand-gradient-text">{client.title}</span>
          </h1>
        </div>
        <ReportSection slug={slug} readOnly={readOnly} />
      </div>
    </PageShell>
  );
}
