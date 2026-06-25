"use client";

// Creatives Studio — a full page where the team generates ad-creative
// concepts with "Claude Creatives Pro Max". Left: the brief (starting
// idea, direction, copy to use, platform, format) + history of past
// generations. Right: the chat with the agent. "Guardar na história"
// persists the latest concept so it can be reopened later.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Sparkles,
  User,
  Wand2,
  Save,
  History,
  Trash2,
  X,
  Lightbulb,
  Image as ImageIcon,
  ImagePlus,
  Download,
  FolderLock,
  Check,
} from "lucide-react";
import type { CreativeEntry } from "@/lib/ads/ads-creatives-store";
import { formatDateTime } from "@/lib/dates";

type Platform = "all" | "google" | "meta";

export function CreativesStudio({
  slug,
  clientName,
  initialHistory,
}: {
  slug: string;
  clientName: string;
  initialHistory: CreativeEntry[];
}) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/ads/${slug}/creatives` }),
    [slug],
  );
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => console.error("Creatives error:", err),
  });

  const [idea, setIdea] = useState("");
  const [direction, setDirection] = useState("");
  const [copy, setCopy] = useState("");
  const [platform, setPlatform] = useState<Platform>("all");
  const [format, setFormat] = useState("");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<CreativeEntry[]>(initialHistory);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<CreativeEntry | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [savedToVault, setSavedToVault] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  function imagePrompt(): string {
    return [
      idea && `Conceito: ${idea}`,
      direction && `Direção visual: ${direction}`,
      copy &&
        `Contexto da copy (NÃO escrever na imagem a não ser que seja pedido): ${copy}`,
      format && `Formato: ${format}`,
      `Plataforma: ${platform}`,
    ]
      .filter(Boolean)
      .join(". ");
  }

  async function generateImage() {
    if (imgBusy) return;
    const prompt = imagePrompt();
    if (!prompt.replace(/Plataforma:.*/, "").trim()) {
      setImgError("Preenche o brief (ideia / direção visual) antes de gerar.");
      return;
    }
    setImgBusy(true);
    setImgError(null);
    try {
      const res = await fetch(`/api/ads/${slug}/creatives/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? `HTTP ${res.status}`);
      setImages((prev) => [json.url as string, ...prev]);
    } catch (err) {
      setImgError(err instanceof Error ? err.message : "Falha a gerar imagem");
    } finally {
      setImgBusy(false);
    }
  }

  async function addImageToVault(url: string) {
    try {
      const cur = await fetch(`/api/ads/${slug}/vault`, { cache: "no-store" });
      const curJson = cur.ok ? ((await cur.json()) as { items: unknown[] }) : { items: [] };
      const item = {
        id: crypto.randomUUID(),
        kind: "creative",
        title: (idea.trim().split("\n")[0] || "Criativo gerado").slice(0, 120),
        description: "Imagem gerada no Creatives Studio",
        url,
        platform: platform === "all" ? null : platform,
        addedAt: Date.now(),
      };
      const res = await fetch(`/api/ads/${slug}/vault`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([item, ...(curJson.items ?? [])]),
      });
      if (res.ok) setSavedToVault((p) => new Set(p).add(url));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const brief = () => ({ idea, direction, copy, platform, format });

  function generate() {
    if (isLoading) return;
    const summary = [
      idea && `Ideia / ponto de partida: ${idea}`,
      direction && `Direcionamentos: ${direction}`,
      copy && `Copy a usar: ${copy}`,
      `Plataforma: ${platform} · Formato: ${format || "livre"}`,
    ]
      .filter(Boolean)
      .join("\n");
    const text = summary
      ? `Gera criativos com este brief:\n${summary}`
      : "Gera 2-3 conceitos de criativo fortes para este cliente, com base no Campaign Vault.";
    sendMessage({ text }, { body: { brief: brief() } });
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || isLoading) return;
    sendMessage({ text: t }, { body: { brief: brief() } });
    setInput("");
  }

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i].parts
          .map((p) => (p.type === "text" ? p.text : ""))
          .join("");
      }
    }
    return "";
  }, [messages]);

  async function saveToHistory() {
    if ((!lastAssistant.trim() && images.length === 0) || saving) return;
    setSaving(true);
    try {
      const title =
        (idea.trim().split("\n")[0] || "Criativo").slice(0, 80) || "Criativo";
      const res = await fetch(`/api/ads/${slug}/creatives/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          idea,
          direction,
          copy,
          platform,
          format,
          content: lastAssistant,
          images,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { entry: CreativeEntry };
        setHistory((prev) => [json.entry, ...prev]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeHistory(id: string) {
    const res = await fetch(`/api/ads/${slug}/creatives/history?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const json = (await res.json()) as { entries: CreativeEntry[] };
      setHistory(json.entries);
    }
  }

  return (
    <div className="animate-fade-up mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      {/* Left: brief + history */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-300" />
            <h2 className="text-[13.5px] font-semibold text-white">Brief</h2>
          </div>
          <div className="space-y-2.5">
            <Textarea
              label="Ideia / ponto de partida"
              value={idea}
              onChange={setIdea}
              placeholder="Ex.: campanha de verão para implantes, foco em confiança…"
            />
            <Textarea
              label="Direcionamentos / que criativos usar"
              value={direction}
              onChange={setDirection}
              placeholder="Tom, estilo visual, referências, ângulos a evitar…"
            />
            <Textarea
              label="Copy a usar (opcional)"
              value={copy}
              onChange={setCopy}
              placeholder="Headlines/frases que queres incorporar…"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                  Plataforma
                </span>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[12.5px] text-white outline-none focus:border-white/30"
                >
                  <option value="all" className="bg-[#111]">Google + Meta</option>
                  <option value="google" className="bg-[#111]">Google</option>
                  <option value="meta" className="bg-[#111]">Meta</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                  Formato
                </span>
                <input
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="Reel, Feed, RSA…"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[12.5px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={isLoading}
              className="brand-gradient-bg inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Gerar conceito + copy
            </button>
            <button
              type="button"
              onClick={generateImage}
              disabled={imgBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#783DF5]/45 bg-[#783DF5]/12 px-4 py-2.5 text-[13px] font-semibold text-[#e0d4ff] transition hover:border-[#783DF5]/80 hover:bg-[#783DF5]/22 hover:text-white disabled:opacity-50"
            >
              {imgBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Gerar imagem
            </button>
            {imgError && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300">
                {imgError}
              </p>
            )}
          </div>
        </div>

        {/* History */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-white/55" />
            <h2 className="text-[13.5px] font-semibold text-white">
              Histórico de criações
            </h2>
            <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/45">
              {history.length}
            </span>
          </div>
          {history.length === 0 ? (
            <p className="text-[12px] text-white/40">
              Ainda sem criações guardadas. Gera um criativo e guarda-o aqui.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2"
                >
                  <button
                    type="button"
                    onClick={() => setViewing(h)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[12.5px] font-semibold text-white">
                      {h.title}
                    </div>
                    <div className="text-[10.5px] text-white/40">
                      {formatDateTime(h.createdAt)} · {h.platform}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeHistory(h.id)}
                    aria-label="Apagar"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/40 transition hover:border-rose-400/50 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right: chat */}
      <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <header className="flex items-center gap-3 border-b border-white/8 bg-black/30 px-5 py-3.5">
          <span className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)]">
            <ImageIcon className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-white">
              Claude Creatives Pro Max · {clientName}
            </h2>
            <p className="text-[11px] text-white/45">
              Conceitos, hooks, headlines, copy e direção visual
            </p>
          </div>
          <button
            type="button"
            onClick={saveToHistory}
            disabled={!lastAssistant.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition hover:border-white/35 hover:bg-white/[0.06] disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar na história
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="brand-gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl opacity-90">
                <Wand2 className="h-6 w-6 text-white" />
              </span>
              <p className="max-w-sm text-sm text-white/55">
                Preenche o brief à esquerda e carrega em{" "}
                <strong>Gerar criativo</strong> — ou escreve aqui o que precisas.
                Eu trago conceitos prontos a usar.
              </p>
            </div>
          )}
          <ul className="space-y-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  aria-hidden
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    m.role === "user" ? "bg-white/10" : "brand-gradient-bg"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="h-3.5 w-3.5 text-white/80" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <div
                  className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-white/[0.06] text-white"
                      : "border border-white/5 bg-white/[0.025] text-white/85"
                  }`}
                >
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      <span key={i} className="whitespace-pre-wrap">
                        {p.text}
                      </span>
                    ) : null,
                  )}
                </div>
              </li>
            ))}
          </ul>
          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              Algo correu mal. Confirma que <code>ANTHROPIC_API_KEY</code> está
              definido.
            </div>
          )}
        </div>

        <form onSubmit={send} className="border-t border-white/8 bg-white/[0.02] px-3 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Refina, pede variações, muda o ângulo…"
              rows={1}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="brand-gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
              aria-label="Enviar"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated images gallery (full-width) */}
      {(images.length > 0 || imgBusy) && (
        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#d4c4ff]" />
              <h2 className="text-[13.5px] font-semibold text-white">
                Imagens geradas
              </h2>
              <span className="text-[11px] text-white/40">
                geradas com Gemini Flash Image · on-brand
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {imgBusy && (
                <div className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <span className="inline-flex flex-col items-center gap-2 text-white/45">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-[11px]">A gerar…</span>
                  </span>
                </div>
              )}
              {images.map((url) => (
                <div
                  key={url}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Criativo gerado" className="aspect-square w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/40 px-2 py-1 text-[10.5px] font-medium text-white transition hover:bg-black/70"
                    >
                      <Download className="h-3 w-3" /> Abrir
                    </a>
                    <button
                      type="button"
                      onClick={() => addImageToVault(url)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/40 px-2 py-1 text-[10.5px] font-medium text-white transition hover:bg-black/70"
                    >
                      {savedToVault.has(url) ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-300" /> No Vault
                        </>
                      ) : (
                        <>
                          <FolderLock className="h-3 w-3" /> Vault
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setViewing(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-white">
                  {viewing.title}
                </h3>
                <p className="text-[11px] text-white/40">
                  {formatDateTime(viewing.createdAt)} · {viewing.platform}
                  {viewing.format ? ` · ${viewing.format}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-4">
              {viewing.images.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {viewing.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Criativo"
                        className="aspect-square w-full rounded-lg border border-white/10 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              {viewing.content && (
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-white/85">
                  {viewing.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[12.5px] leading-relaxed text-white outline-none focus:border-white/30 placeholder:text-white/30"
      />
    </label>
  );
}
