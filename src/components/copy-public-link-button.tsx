"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";

/** Copy a path to clipboard, resolving against the current origin. */
export function CopyPublicLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url =
      typeof window !== "undefined"
        ? new URL(path, window.location.origin).toString()
        : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: prompt the user to copy manually.
      window.prompt("Copy this link:", url);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy the public link to share with the client"
      className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <LinkIcon className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy public link"}
    </button>
  );
}
