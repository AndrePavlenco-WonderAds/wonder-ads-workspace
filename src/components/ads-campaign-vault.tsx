"use client";

// Campaign Vault — ADS-DPT-only, one per client. Briefings, ad docs
// (copy + creatives) and past monthly reports. Separate from the shared
// Client Files. Includes "Pedir Aconselhamento AI" which opens the ADS
// Advisor (grounded in analytics + this vault).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderLock,
  Upload,
  Link as LinkIcon,
  Plus,
  Loader2,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  Sparkles,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  VAULT_KINDS,
  VAULT_KIND_LABEL,
  type VaultItem,
  type VaultKind,
} from "@/lib/ads/ads-vault-store";
import { formatDate } from "@/lib/dates";
import { AdsAdvisorModal } from "./ads-advisor-modal";

const KIND_STYLE: Record<VaultKind, string> = {
  brief: "border-sky-400/40 bg-sky-500/12 text-sky-200",
  creative: "border-fuchsia-400/40 bg-fuchsia-500/12 text-fuchsia-200",
  report: "border-emerald-400/40 bg-emerald-500/12 text-emerald-200",
  doc: "border-white/15 bg-white/[0.05] text-white/70",
  other: "border-white/15 bg-white/[0.05] text-white/60",
};
const PLATFORM_STYLE: Record<"google" | "meta", { label: string; color: string }> = {
  google: { label: "Google", color: "#4285F4" },
  meta: { label: "Meta", color: "#E1306C" },
};

export function AdsCampaignVault({
  slug,
  clientName,
  initialItems,
}: {
  slug: string;
  clientName: string;
  initialItems: VaultItem[];
}) {
  const [items, setItems] = useState<VaultItem[]>(initialItems);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingKind, setPendingKind] = useState<VaultKind>("brief");

  // Refresh from server on mount (page may be cached).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ads/${slug}/vault`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { items: VaultItem[] };
        if (!cancelled) setItems(json.items ?? []);
      } catch {
        /* keep initial */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const persist = useCallback(
    async (next: VaultItem[]) => {
      setBusy(true);
      setError(null);
      const prev = items;
      setItems(next);
      try {
        const res = await fetch(`/api/ads/${slug}/vault`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { items: VaultItem[] };
        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setItems(prev);
      } finally {
        setBusy(false);
      }
    },
    [slug, items],
  );

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    const picked = Array.from(list);
    const added: VaultItem[] = [];
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      try {
        setProgress(
          picked.length > 1
            ? `A carregar ${i + 1}/${picked.length}…`
            : `A carregar ${file.name}…`,
        );
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/files/upload",
        });
        added.push({
          id: crypto.randomUUID(),
          kind: pendingKind,
          title: file.name,
          description: "",
          url: blob.url,
          platform: null,
          addedAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : `Falhou: ${file.name}`);
      }
    }
    setProgress(null);
    if (added.length) await persist([...added, ...items]);
  }

  function addLink(item: Omit<VaultItem, "id" | "addedAt">) {
    setAdding(false);
    persist([
      { ...item, id: crypto.randomUUID(), addedAt: Date.now() },
      ...items,
    ]);
  }

  function remove(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  return (
    <section aria-label="Campaign Vault" className="animate-fade-up mt-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <header className="flex flex-wrap items-center gap-2">
          <FolderLock className="h-4 w-4 text-[#d4c4ff]" strokeWidth={2.25} />
          <h2 className="text-[14px] font-semibold text-white">Campaign Vault</h2>
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
            ADS DPT · único por cliente
          </span>
          {busy && (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
              <Loader2 className="h-3 w-3 animate-spin" /> {progress ?? "A guardar…"}
            </span>
          )}
          {error && !busy && (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
              {error}
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAdvisorOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#783DF5]/45 bg-[#783DF5]/15 px-3 py-1.5 text-[12px] font-semibold text-[#e0d4ff] transition hover:border-[#783DF5]/80 hover:bg-[#783DF5]/25 hover:text-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Pedir Aconselhamento AI
            </button>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-white/35 hover:bg-white/[0.06]"
            >
              <LinkIcon className="h-3.5 w-3.5" /> Adicionar link
            </button>
            <button
              type="button"
              disabled={progress !== null}
              onClick={() => fileRef.current?.click()}
              className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> Adicionar doc
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </header>

        {/* Kind picker for the next upload */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-white/35">
            Tipo do próximo doc:
          </span>
          {VAULT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPendingKind(k)}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
                pendingKind === k
                  ? KIND_STYLE[k]
                  : "border-white/10 bg-white/[0.02] text-white/45 hover:text-white/70"
              }`}
            >
              {VAULT_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {adding && <AddLinkForm onAdd={addLink} onCancel={() => setAdding(false)} />}

        {items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[12.5px] text-white/35">
            Vault vazio — adiciona briefings, criativos, copys e reports
            mensais. Fica só neste cliente do ADS DPT.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/8">
            {items.map((it) => {
              const isImg = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(it.url);
              return (
                <li key={it.id} className="flex items-center gap-3 py-3">
                  <span className="brand-gradient-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    {isImg ? (
                      <ImageIcon className="h-4 w-4 text-white" strokeWidth={2.25} />
                    ) : (
                      <FileText className="h-4 w-4 text-white" strokeWidth={2.25} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.1em] ${KIND_STYLE[it.kind]}`}
                      >
                        {VAULT_KIND_LABEL[it.kind]}
                      </span>
                      {it.platform && (
                        <span
                          className="rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.1em]"
                          style={{
                            borderColor: `${PLATFORM_STYLE[it.platform].color}66`,
                            color: PLATFORM_STYLE[it.platform].color,
                          }}
                        >
                          {PLATFORM_STYLE[it.platform].label}
                        </span>
                      )}
                      <span className="truncate text-[13px] font-semibold text-white" title={it.title}>
                        {it.title}
                      </span>
                    </div>
                    {it.description && (
                      <div className="truncate text-[11.5px] text-white/45">
                        {it.description}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-[10.5px] text-white/35">
                    {formatDate(it.addedAt)}
                  </span>
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    aria-label="Remover"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-rose-400/50 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {advisorOpen && (
        <AdsAdvisorModal
          slug={slug}
          clientName={clientName}
          onClose={() => setAdvisorOpen(false)}
        />
      )}
    </section>
  );
}

function AddLinkForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: Omit<VaultItem, "id" | "addedAt">) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<VaultKind>("brief");
  const [platform, setPlatform] = useState<"google" | "meta" | "">("");

  function submit() {
    if (!/^https?:\/\//i.test(url.trim())) return;
    onAdd({
      kind,
      title: title.trim() || url.trim(),
      description: description.trim(),
      url: url.trim(),
      platform: platform || null,
    });
  }

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (https://… — Drive, Figma, etc.)"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
        />
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as VaultKind)}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[12px] text-white outline-none focus:border-white/30"
        >
          {VAULT_KINDS.map((k) => (
            <option key={k} value={k} className="bg-[#111]">
              {VAULT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as "google" | "meta" | "")}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[12px] text-white outline-none focus:border-white/30"
        >
          <option value="" className="bg-[#111]">Sem plataforma</option>
          <option value="google" className="bg-[#111]">Google</option>
          <option value="meta" className="bg-[#111]">Meta</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
