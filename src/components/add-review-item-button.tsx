"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  REVIEW_CATEGORIES,
  type ReviewCategory,
} from "@/lib/review-store";

/** Modal-less inline add — pops a small form, POSTs the new item,
 *  reloads the page so the table refreshes via SSR. */
export function AddReviewItemButton({ clientSlug }: { clientSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [category, setCategory] = useState<ReviewCategory>("Other");
  const [docLink, setDocLink] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!task.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/reviews/${clientSlug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task,
          category,
          docLink: docLink || undefined,
        }),
      });
      if (res.ok) {
        setTask("");
        setDocLink("");
        setCategory("Other");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        Add row manually
      </button>
    );
  }
  return (
    <div className="brand-gradient-border w-full rounded-xl bg-white/[0.03] p-3 backdrop-blur-md">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_2fr_auto_auto]">
        <input
          type="text"
          autoFocus
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Task name"
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ReviewCategory)}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
        >
          {REVIEW_CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-[#0a0a0f]">
              {c}
            </option>
          ))}
        </select>
        <input
          type="url"
          value={docLink}
          onChange={(e) => setDocLink(e.target.value)}
          placeholder="Doc link (optional)"
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
        />
        <button
          type="button"
          disabled={!task.trim() || saving}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
