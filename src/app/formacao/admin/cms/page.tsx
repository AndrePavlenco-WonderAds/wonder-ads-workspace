// CMS da Formação — editar módulos, capítulos, aulas e testes sem tocar em
// código. É também aqui que se colam os links dos vídeos à medida que forem
// sendo gravados.

import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingAdminNav } from "@/components/training/admin-nav";
import { TrainingCms } from "@/components/training/training-cms";
import {
  getTrainingCatalog,
  trainingCatalogIsCustom,
} from "@/lib/training/content-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Conteúdo — Formação · Wonder Ads",
};

export default async function TrainingCmsPage() {
  const [tracks, isCustom] = await Promise.all([
    getTrainingCatalog(),
    trainingCatalogIsCustom(),
  ]);

  return (
    <PageShell wide>
      <Link
        href="/formacao/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Formação — Superadmin
      </Link>

      <div className="animate-fade-up mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Conteúdo</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Módulos, capítulos, aulas e testes. Cola aqui o link de cada vídeo à
            medida que for gravado — a aula deixa de aparecer como
            &laquo;brevemente&raquo; e passa a contar para a progressão.
          </p>
        </div>
        <TrainingAdminNav />
      </div>

      <div className="animate-fade-up mt-6 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-[12.5px] text-white/55">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-purple)]" />
        <span>
          As alterações só ficam gravadas quando carregas em{" "}
          <strong className="text-white/75">Guardar alterações</strong>. Os ids
          das aulas e das perguntas são mostrados mas não se editam: é por eles
          que o progresso e as respostas de toda a gente estão guardados —
          apagar uma aula faz o progresso dela deixar de contar. Uma pergunta
          sem nenhuma opção correta é descartada ao gravar, para não haver
          testes impossíveis de passar.
        </span>
      </div>

      <div className="animate-fade-up mt-6">
        <TrainingCms initial={tracks} isCustom={isCustom} />
      </div>
    </PageShell>
  );
}
