// SuperAdmin-only editor for the onboarding content (lessons course + intake
// form). Lives under /seo so it inherits the SEO chrome; gated on isAdmin.

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { OnboardingEditor } from "@/components/onboarding-editor";
import {
  getCourse,
  getFormSteps,
  courseIsCustom,
  formIsCustom,
} from "@/lib/onboarding-content-store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editor de Onboarding — Wonder Ads Workspace",
};

export default async function OnboardingEditorPage() {
  const employee = await getCurrentEmployee();
  if (!employee || !employee.isAdmin) {
    return (
      <PageShell>
        <AccessDenied
          title="Acesso restrito"
          description="O editor de onboarding é exclusivo para SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  const [course, form, courseCustom, formCustom] = await Promise.all([
    getCourse(),
    getFormSteps(),
    courseIsCustom(),
    formIsCustom(),
  ]);

  return (
    <PageShell wide backHref="/seo" backLabel="SEO DPT">
      <div className="mb-8">
        <Link
          href="/seo"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/45 transition hover:text-white/75"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          SEO DPT
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="brand-gradient-bg flex h-10 w-10 items-center justify-center rounded-xl">
            <Pencil className="h-5 w-5 text-white" />
          </span>
          <span className="brand-gradient-text">Editor de Onboarding</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Edita as lições do curso (vídeos, textos, ordem) e as perguntas do
          formulário que os clientes preenchem. As alterações aplicam-se de
          imediato a todos os links de onboarding.
        </p>
      </div>

      <OnboardingEditor
        initialCourse={course}
        initialForm={form}
        courseCustom={courseCustom}
        formCustom={formCustom}
      />
    </PageShell>
  );
}
