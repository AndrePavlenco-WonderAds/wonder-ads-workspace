import Link from "next/link";
import {
  ArrowRightLeft,
  FilePlus2,
  FolderLock,
  MessageSquare,
  Pencil,
  Trash2,
  History,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import {
  getActivity,
  webStorageConfigured,
  type WebActivity,
  type WebActivityKind,
} from "@/lib/web-projects-store";
import { formatDateTime } from "@/lib/dates";

export const metadata = {
  title: "Web Activity — Wonder Ads Workspace",
};

export const dynamic = "force-dynamic";

const KIND_META: Record<
  WebActivityKind,
  { Icon: LucideIcon; ring: string }
> = {
  created: { Icon: FilePlus2, ring: "border-emerald-400/40 text-emerald-200" },
  moved: { Icon: ArrowRightLeft, ring: "border-sky-400/40 text-sky-200" },
  edited: { Icon: Pencil, ring: "border-amber-400/40 text-amber-200" },
  comment: { Icon: MessageSquare, ring: "border-violet-400/40 text-violet-200" },
  asset: { Icon: FolderLock, ring: "border-white/25 text-white/70" },
  deleted: { Icon: Trash2, ring: "border-rose-400/40 text-rose-200" },
};

export default async function WebActivityPage() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return (
      <PageShell>
        <AccessDenied
          title="No Web access"
          description="The Web department is open to web designers, SEO consultants, and SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  const activity = webStorageConfigured ? await getActivity(300) : [];

  return (
    <PageShell backHref="/web" backLabel="Web board">
      <DepartmentHeader
        title="Activity Log"
        tagline="Every change across the Web department — status moves, edits, new comments, and asset/credential updates — with who made each change and when."
        Icon={History}
      />

      <div className="mt-10 max-w-3xl">
        {activity.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-white/45">
            No activity yet. Changes on the board will show up here.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-3">
            {activity.map((a: WebActivity) => {
              const meta = KIND_META[a.kind] ?? KIND_META.edited;
              const { Icon } = meta;
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white/[0.03] ${meta.ring}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-white/85">
                      <span className="font-semibold text-white">
                        {a.actorName}
                      </span>{" "}
                      {a.message}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                      <time>{formatDateTime(a.at)}</time>
                      {a.kind !== "deleted" && (
                        <>
                          <span aria-hidden>·</span>
                          <Link
                            href={`/web/${a.projectId}`}
                            className="transition hover:text-white/70"
                          >
                            {a.projectName}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </PageShell>
  );
}
