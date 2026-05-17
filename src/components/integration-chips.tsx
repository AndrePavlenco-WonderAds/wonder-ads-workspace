"use client";

import { useEffect, useState } from "react";
import type { ActionToolName } from "@/lib/seo-pillars";

type DiagEntry = { present: boolean; length: number };
type Diagnostics = {
  anthropic: { ANTHROPIC_API_KEY: DiagEntry };
  dataforseo: {
    DATAFORSEO_LOGIN: DiagEntry;
    DATAFORSEO_PASSWORD: DiagEntry;
  };
  pagespeed: { PAGESPEED_API_KEY: DiagEntry };
  google: {
    GOOGLE_SERVICE_ACCOUNT_JSON: DiagEntry;
    GOOGLE_IMPERSONATE_SUBJECT: DiagEntry;
  };
};

type ToolStatus = {
  label: string;
  status: "ready" | "missing" | "no-key-soft" | "always";
  message: string;
  envVars: string[];
};

function statusForTool(tool: ActionToolName, d: Diagnostics | null): ToolStatus {
  switch (tool) {
    case "crawl-page":
    case "sitemap-discovery":
    case "crawl-sample":
      return {
        label: chipLabel(tool),
        status: "always",
        message: "No external API needed — built-in HTTP fetch + parsing.",
        envVars: [],
      };
    case "pagespeed-mobile":
    case "pagespeed-desktop": {
      if (!d) return { label: chipLabel(tool), status: "ready", message: "Loading…", envVars: ["PAGESPEED_API_KEY"] };
      const ok = d.pagespeed.PAGESPEED_API_KEY.present;
      return {
        label: chipLabel(tool),
        status: ok ? "ready" : "no-key-soft",
        message: ok
          ? "PAGESPEED_API_KEY set — full quota available."
          : "PAGESPEED_API_KEY not set — falls back to anonymous shared quota (429s likely).",
        envVars: ["PAGESPEED_API_KEY"],
      };
    }
    case "gsc-site-data": {
      if (!d) return { label: chipLabel(tool), status: "ready", message: "Loading…", envVars: [] };
      const sa = d.google.GOOGLE_SERVICE_ACCOUNT_JSON.present;
      const impersonate = d.google.GOOGLE_IMPERSONATE_SUBJECT.present;
      const ok = sa && impersonate;
      return {
        label: chipLabel(tool),
        status: ok ? "ready" : "missing",
        message: ok
          ? "Google service account configured."
          : `Missing: ${!sa ? "GOOGLE_SERVICE_ACCOUNT_JSON" : ""}${!sa && !impersonate ? ", " : ""}${!impersonate ? "GOOGLE_IMPERSONATE_SUBJECT" : ""}.`,
        envVars: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_IMPERSONATE_SUBJECT"],
      };
    }
    case "dataforseo-domain": {
      if (!d) return { label: chipLabel(tool), status: "ready", message: "Loading…", envVars: [] };
      const login = d.dataforseo.DATAFORSEO_LOGIN;
      const pw = d.dataforseo.DATAFORSEO_PASSWORD;
      const ok = login.present && pw.present;
      let message: string;
      if (ok) {
        message = `LOGIN length ${login.length}, PASSWORD length ${pw.length}. If a run still shows 'Not connected', the credentials are wrong (DataforSEO API password, not your account password).`;
      } else {
        const missing: string[] = [];
        if (!login.present) missing.push("DATAFORSEO_LOGIN");
        if (!pw.present) missing.push("DATAFORSEO_PASSWORD");
        message = `Missing: ${missing.join(", ")}. Add in Vercel env and redeploy.`;
      }
      return {
        label: chipLabel(tool),
        status: ok ? "ready" : "missing",
        message,
        envVars: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
      };
    }
  }
}

function chipLabel(t: ActionToolName): string {
  switch (t) {
    case "crawl-page":
      return "Page HTML";
    case "pagespeed-mobile":
      return "PSI Mobile";
    case "pagespeed-desktop":
      return "PSI Desktop";
    case "sitemap-discovery":
      return "Sitemap";
    case "crawl-sample":
      return "Sample crawl";
    case "gsc-site-data":
      return "Search Console";
    case "dataforseo-domain":
      return "DataforSEO";
  }
}

export function IntegrationChips({ tools }: { tools: ActionToolName[] }) {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/diagnostics/env", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Diagnostics>;
      })
      .then((d) => {
        if (!cancelled) setDiag(d);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
        Live tools
      </span>
      {tools.map((t) => {
        const s = statusForTool(t, diag);
        return (
          <span
            key={t}
            title={s.message}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${chipColor(s.status)}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${dotColor(s.status)}`}
            />
            {s.label}
          </span>
        );
      })}
      {loadErr && (
        <span className="text-[10px] text-red-300/80">
          (diagnostic load failed: {loadErr})
        </span>
      )}
    </div>
  );
}

function chipColor(s: ToolStatus["status"]): string {
  switch (s) {
    case "ready":
    case "always":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "no-key-soft":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "missing":
      return "border-red-400/30 bg-red-400/10 text-red-200";
  }
}

function dotColor(s: ToolStatus["status"]): string {
  switch (s) {
    case "ready":
    case "always":
      return "bg-emerald-400";
    case "no-key-soft":
      return "bg-amber-400";
    case "missing":
      return "bg-red-400";
  }
}
