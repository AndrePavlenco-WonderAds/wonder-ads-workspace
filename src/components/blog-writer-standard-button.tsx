"use client";

// Top-right button on the Write Blog Article action page.
// Opens a modal/drawer containing the Blog Article Writer Pro
// agent's full rule-set — collapsed by default so the page header
// stays clean.

import { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { BlogWriterStandardPanel } from "./blog-writer-standard-panel";

export function BlogWriterStandardButton() {
  const [open, setOpen] = useState(false);

  // Close on Escape + lock scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
        title="What the Blog Article Writer Pro agent always does — language rule, brief check, writing standard, process, output format."
      >
        <BookOpen className="h-3.5 w-3.5" />
        Agent rules
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Blog Article Writer Pro — agent rules"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm"
          onClick={(e) => {
            // Click outside the dialog closes — but ignore clicks on the
            // inner content.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/12 bg-[#0c0c12] shadow-2xl shadow-black/50">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-white/8 bg-[#0c0c12]/95 px-5 py-3.5 backdrop-blur">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[color:var(--brand-purple)]" />
                <h2 className="text-[13px] font-semibold text-white">
                  Blog Article Writer Pro — agent rules
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-white/55 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 pb-4 pt-1">
              <BlogWriterStandardPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
