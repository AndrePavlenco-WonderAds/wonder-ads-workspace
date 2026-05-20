// Header chip on the client page showing the count of items in this
// client's Pending Review table. Server component — counts straight
// from KV at render time.

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { listReviewItems } from "@/lib/review-store";

export async function PendingReviewChip({ slug }: { slug: string }) {
  const items = await listReviewItems(slug);
  const pending = items.filter((i) => i.status === "For Approval").length;
  return (
    <Link
      href={`/seo/${slug}/review`}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
      title={`Open this client's Pending Review table${items.length > 0 ? ` (${items.length} item${items.length === 1 ? "" : "s"} total)` : ""}`}
    >
      <ClipboardCheck className="h-3 w-3" />
      <span>Pending Review</span>
      {items.length > 0 && (
        <span
          className={
            pending > 0
              ? "ml-1 inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100"
              : "ml-1 inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100"
          }
        >
          {pending > 0
            ? `${pending} for approval`
            : `${items.length} item${items.length === 1 ? "" : "s"}`}
        </span>
      )}
    </Link>
  );
}
