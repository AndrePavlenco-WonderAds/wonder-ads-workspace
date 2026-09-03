"use client";

// O baralho de /tools — cinco cartões de cada vez, a rodar para o lado.
//
// PORQUÊ UM CARROSSEL CIRCULAR E NÃO PÁGINAS. Com 11 ferramentas e 5 por
// vista, paginar dava 5 + 5 + 1: a última página com um cartão solitário
// no meio do vazio. O baralho roda de UM cartão de cada vez sobre uma
// lista circular, por isso estão sempre cinco em cena e nunca há um fim.
//
// A mecânica é a clássica: a pista tem três cópias da lista e o índice
// vive na do meio. Quando uma seta o empurra para fora dessa cópia, o
// índice salta de volta uma cópia inteira com a transição desligada —
// o olho não vê nada, e o baralho pode rodar para sempre nos dois sentidos.
//
// A PESQUISA NÃO MUDA DE MODO. Filtrar encolhe o baralho; quando o que
// sobra cabe na vista, as setas desaparecem e os cartões centram-se. Um
// modo «grelha» separado só para resultados obrigaria a aprender dois
// ecrãs para a mesma coisa.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { WorkspaceTool } from "@/lib/tools-catalogue";
import type { ToolAccess } from "@/lib/tools-access-store";
import { formatDateTime } from "@/lib/dates";

export type ToolCard = WorkspaceTool & { access: ToolAccess };

/** Espaço entre cartões, em px. Vive aqui porque a conta da largura do
 *  cartão e a do deslocamento da pista têm de usar o mesmo número. */
const GAP = 18;

/** Altura ÷ largura do cartão. Uma carta de jogo tem ~1,4; aqui é mais
 *  alta de propósito (pedido do André, v77.8) para o baralho encher o
 *  ecrã em vez de deixar o rodapé a meio. Proporção e não altura fixa,
 *  para o cartão de telemóvel (1 por linha) e o de portátil (5 por
 *  linha) parecerem a mesma carta em tamanhos diferentes. */
const CARD_RATIO = 1.6;

/** Sem acentos, sem pontuação, minúsculas — «SemRush access», «semrush» e
 *  «Sem Rush» têm de acender o mesmo cartão. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavras que são verdade sobre QUALQUER cartão. Existem porque
 *  ninguém procura «SemRush» — procura «SemRush access». Sem isto, a
 *  exigência de que todas as palavras batam certo transformava a palavra
 *  genérica num filtro que não deixava passar nada. */
const UNIVERSAL_TERMS =
  "acesso acessos access login conta contas credenciais credencial password passwords palavra passe ferramenta ferramentas tool tools subscricao";

/** Quantos cartões cabem na vista. Cinco é o alvo do desenho; abaixo disso
 *  é só o que a largura permite sem espremer o cartão. */
function perViewFor(width: number): number {
  // Os cortes estão calibrados à LARGURA DA PISTA, não à do ecrã: dentro
  // do max-w-7xl do workspace um portátil comum dá ~1200px de pista, e é
  // aí que têm de caber os cinco cartões pedidos.
  if (width < 440) return 1;
  if (width < 690) return 2;
  if (width < 930) return 3;
  if (width < 1120) return 4;
  return 5;
}

export function ToolsDeck({
  tools,
  canEdit,
}: {
  tools: ToolCard[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = fold(query);
    if (!q) return tools;
    // Cada palavra escrita tem de COMEÇAR uma palavra do cartão, em
    // qualquer ordem: «semrush access» e «access semrush» dão o mesmo.
    //
    // Prefixo e não pedaço solto: com `includes`, «IA» — que é a categoria
    // do ChatGPT e do Claude — acendia os onze cartões, porque «ia» vive
    // dentro de «credenciais» e de meia dúzia de outras palavras.
    const words = q.split(" ").filter(Boolean);
    return tools.filter((t) => {
      const hay = `${fold(
        [t.name, t.category, t.description, ...t.aliases].join(" "),
      )} ${UNIVERSAL_TERMS}`.split(" ");
      return words.every((w) => hay.some((h) => h.startsWith(w)));
    });
  }, [tools, query]);

  // «/» foca a pesquisa, Esc limpa-a — o atalho que o resto do workspace
  // já usa. Ignorado enquanto se escreve noutro campo, senão não se
  // conseguia escrever uma barra em lado nenhum.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && el === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const editingTool = editing
    ? (tools.find((t) => t.id === editing) ?? null)
    : null;

  return (
    <div>
      <SearchBar ref={inputRef} value={query} onChange={setQuery} />

      {filtered.length === 0 ? (
        <EmptyResults query={query} onClear={() => setQuery("")} />
      ) : (
        <Carousel
          tools={filtered}
          canEdit={canEdit}
          onEdit={(id) => setEditing(id)}
        />
      )}

      {editingTool && (
        <EditAccessModal
          tool={editingTool}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Pesquisa
   --------------------------------------------------------------------------- */

function SearchBar({
  ref,
  value,
  onChange,
}: {
  ref: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="animate-fade-up">
      <div className="relative w-full max-w-[760px]">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/30" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Procurar acesso ou ferramenta…"
          aria-label="Procurar ferramenta"
          className="w-full rounded-full border border-white/12 bg-white/[0.04] py-3.5 pl-12 pr-16 text-[15px] text-white/85 outline-none transition placeholder:text-white/30 focus:border-[color:var(--brand-purple)]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[color:var(--brand-purple)]/15 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Limpar pesquisa"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd
            aria-hidden
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-white/12 px-1.5 py-0.5 text-[10px] font-medium text-white/30"
          >
            /
          </kbd>
        )}
      </div>
    </div>
  );
}

function EmptyResults({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div className="animate-fade-up mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-14 text-center">
      <p className="text-sm text-white/60">
        Nenhuma ferramenta encontrada para{" "}
        <span className="font-semibold text-white/85">
          &laquo;{query.trim()}&raquo;
        </span>
        .
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-full border border-white/12 px-4 py-1.5 text-xs font-medium text-white/70 transition hover:border-[color:var(--brand-purple)]/45 hover:text-white"
      >
        Ver todas
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Carrossel
   --------------------------------------------------------------------------- */

function Carousel({
  tools,
  canEdit,
  onEdit,
}: {
  tools: ToolCard[];
  canEdit: boolean;
  onEdit: (id: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const perView = perViewFor(width || 1280);
  const len = tools.length;
  const loop = len > perView;

  const [index, setIndex] = useState(loop ? len : 0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // A lista mudou (pesquisa) ou deixou de haver volta a dar: recomeça no
  // princípio da cópia do meio, sem animação — animar daqui para ali seria
  // um deslize que não quer dizer nada.
  useEffect(() => {
    setAnimate(false);
    setIndex(loop ? len : 0);
  }, [len, loop]);

  // Reatar a transição só no frame seguinte ao salto, senão o próprio
  // salto seria animado e via-se o baralho a correr para trás.
  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const cardW =
    width > 0 ? Math.max(150, (width - GAP * (perView - 1)) / perView) : 0;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!loop) return;
      setAnimate(true);
      setIndex((i) => i + dir);
    },
    [loop],
  );

  /** O salto invisível: chegado ao fim de uma cópia, volta-se à do meio. */
  function onTransitionEnd(e: React.TransitionEvent) {
    if (!loop || e.target !== trackRef.current) return;
    if (index >= 2 * len) {
      setAnimate(false);
      setIndex(index - len);
    } else if (index < len) {
      setAnimate(false);
      setIndex(index + len);
    }
  }

  // Arrastar com o dedo. Só toque: com o rato, um drag por cima do cartão
  // roubaria o clique aos botões de copiar.
  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) > 45) go(delta < 0 ? 1 : -1);
  }

  const slides = loop ? [...tools, ...tools, ...tools] : tools;
  const active = ((index % len) + len) % len;

  return (
    <div className="mt-6">
      <div className="relative">
        <div
          ref={viewportRef}
          className="overflow-hidden px-1 py-2"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          // Focar um cartão que está fora da vista faz o browser
          // «scrollar» a caixa escondida; a pista fica desalinhada da
          // conta do transform e o baralho parte-se. Desfaz-se logo.
          onScroll={(e) => {
            e.currentTarget.scrollLeft = 0;
            e.currentTarget.scrollTop = 0;
          }}
        >
          <div
            ref={trackRef}
            onTransitionEnd={onTransitionEnd}
            className={`flex items-stretch ${
              loop ? "" : "justify-center"
            } ${animate ? "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" : ""}`}
            style={{
              gap: `${GAP}px`,
              transform: loop
                ? `translate3d(-${index * (cardW + GAP)}px,0,0)`
                : undefined,
            }}
          >
            {slides.map((tool, i) => {
              // As cópias de fora são o mesmo cartão outra vez: ficam
              // fora do teclado e do leitor de ecrã, para a lista existir
              // uma só vez para quem não vê o baralho a rodar.
              const isClone = loop && Math.floor(i / len) !== 1;
              return (
                <div
                  key={`${tool.id}-${i}`}
                  // `flex`: o artigo estica até esta altura mínima. Com
                  // `block`, o `h-full` lá dentro não tinha a que se agarrar.
                  className="flex shrink-0"
                  style={{
                    width: cardW || undefined,
                    minHeight: cardW ? Math.round(cardW * CARD_RATIO) : undefined,
                  }}
                  aria-hidden={isClone || undefined}
                  inert={isClone || undefined}
                >
                  <ToolCardView
                    tool={tool}
                    canEdit={canEdit}
                    onEdit={() => onEdit(tool.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {loop && (
          <>
            <DeckArrow side="left" onClick={() => go(-1)} />
            <DeckArrow side="right" onClick={() => go(1)} />
          </>
        )}
      </div>

      {loop && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {tools.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setAnimate(true);
                setIndex(len + i);
              }}
              aria-label={`Ir para ${t.name}`}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active
                  ? "w-6 brand-gradient-bg"
                  : "w-1.5 bg-white/15 hover:bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeckArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Cartões anteriores" : "Cartões seguintes"}
      className={`absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[color:var(--background)]/85 text-white/70 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md transition hover:border-[color:var(--brand-purple)]/50 hover:bg-[color:var(--background)] hover:text-white ${
        side === "left" ? "-left-3 sm:-left-5" : "-right-3 sm:-right-5"
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

/* ---------------------------------------------------------------------------
   O cartão
   --------------------------------------------------------------------------- */

function ToolCardView({
  tool,
  canEdit,
  onEdit,
}: {
  tool: ToolCard;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const { access } = tool;
  // O SuperAdmin pode apontar o cartão para um link de login específico
  // (SSO, painel de agência, convite); sem ele, abre-se a porta da frente.
  const href = access.loginUrl ?? tool.url;
  return (
    <article className="group relative flex w-full flex-col">
      {/* Halo da cor da marca — só acende ao passar por cima, senão cinco
          cartões acesos ao mesmo tempo faziam do baralho uma manta. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-[30px] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
        style={{
          background: `radial-gradient(55% 55% at 50% 25%, ${tool.accent}66, transparent 72%)`,
        }}
      />
      {/* A moldura dupla do cartão de jogo: rebordo claro por fora,
          painel escuro por dentro. */}
      <div
        className="relative flex flex-1 flex-col rounded-[22px] p-[2px] transition-transform duration-300 group-hover:-translate-y-1.5"
        style={{
          background: `linear-gradient(155deg, ${tool.accent}b0, rgba(255,255,255,0.30) 34%, rgba(255,255,255,0.08) 66%, rgba(255,255,255,0.22))`,
        }}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[20px] bg-[#0a0c13] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.95)]">
          {/* Brilho no topo, como a luz que cai sobre a carta. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-56"
            style={{
              background: `radial-gradient(90% 100% at 50% -10%, ${tool.accent}2e, transparent 70%)`,
            }}
          />
          {/* O rebordo interior escuro que dá a moldura dupla das cartas de
              jogo: fora fica o aro claro, dentro esta linha a separá-lo do
              painel. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-black/70"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[3px] rounded-[17px] ring-1 ring-inset ring-white/[0.07]"
          />

          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar acesso — ${tool.name}`}
              title="Editar acesso"
              className="absolute right-2.5 top-2.5 z-20 rounded-lg border border-amber-400/25 bg-amber-500/[0.12] p-1.5 text-amber-200 transition hover:border-amber-300/50 hover:bg-amber-500/20 hover:text-amber-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex flex-1 flex-col items-center px-5 pb-6 pt-10 text-center outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-purple)]/50"
          >
            <span className="relative">
              <span
                aria-hidden
                className="absolute -inset-2 rounded-[30px] opacity-35 blur-xl transition-opacity duration-300 group-hover:opacity-70"
                style={{ background: tool.accent }}
              />
              <span className="relative flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-[28px] bg-white/[0.07] ring-1 ring-white/15 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.9)]">
                <Image
                  src={tool.logo}
                  alt=""
                  width={208}
                  height={208}
                  unoptimized
                  className={
                    tool.logoFit === "cover"
                      ? "h-full w-full object-cover"
                      : "h-full w-full object-contain p-4"
                  }
                />
              </span>
            </span>

            <h3 className="mt-6 flex items-center gap-1.5 text-[19px] font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
              <span className="truncate">{tool.name}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/0 transition group-hover:text-white/45" />
            </h3>
            <span
              className="readout mt-2.5 rounded-full px-2.5 py-1"
              style={{
                color: tool.accent,
                background: `${tool.accent}1a`,
              }}
            >
              {tool.category}
            </span>
            <p className="mt-4 max-w-[26ch] text-[13px] leading-[1.6] text-white/50">
              {tool.description}
            </p>
          </a>

          {/* A gaveta das credenciais — encostada ao fundo para que cinco
              cartões de alturas diferentes alinhem o que interessa. */}
          <div className="mt-auto space-y-2.5 border-t border-white/[0.07] bg-black/35 px-4 pb-4 pt-4">
            {access.googleLogin && (
              <div
                className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] py-1 pl-2 pr-3"
                title="Entrar com o botão «Continuar com Google», usando esta conta"
              >
                <GoogleG className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-semibold text-white/70">
                  Login com conta Google
                </span>
              </div>
            )}
            <CredentialRow label="User" value={access.username} />
            <CredentialRow label="Pass" value={access.password} secret />
            {/* O nome já abre a ferramenta, mas um botão diz-o em voz alta
                — e é o que se procura a seguir a copiar a password. */}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={href}
              className="!mt-4 flex items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] py-2 text-[11.5px] font-semibold text-white/70 transition hover:border-[color:var(--brand-purple)]/50 hover:bg-white/[0.08] hover:text-white"
            >
              Abrir ferramenta
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function CredentialRow({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string | null;
  secret?: boolean;
}) {
  // A password nasce tapada. Copiar não obriga a revelar — o caso normal é
  // colar noutro sítio, e é numa partilha de ecrã que isto costuma abrir.
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado — nada a fazer, o valor continua visível */
    }
  }

  const shown = !value
    ? "Por definir"
    : secret && !revealed
      ? "•".repeat(Math.min(value.length, 14))
      : value;

  return (
    <div className="flex items-center gap-2">
      {/* Etiqueta com o tracking apertado (e não o `readout` de 0.22em): num
          cartão de ~225px, cada píxel que a etiqueta larga é um píxel que o
          email deixa de cortar. */}
      <span className="w-[30px] shrink-0 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/25">
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[12px] ${
          value
            ? `text-white/80 ${secret ? "font-mono" : ""}`
            : "italic text-white/25"
        }`}
        title={value ?? undefined}
      >
        {shown}
      </span>
      {value && secret && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? "Esconder password" : "Revelar password"}
          className="shrink-0 rounded p-1 text-white/35 transition hover:bg-white/[0.07] hover:text-white"
        >
          {revealed ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        disabled={!value}
        aria-label={`Copiar ${label}`}
        className="shrink-0 rounded p-1 text-white/35 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-300" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

/** O «G» da Google. Inline porque o lucide não tem marcas registadas e um
 *  ficheiro em /public seria mais um pedido por cartão. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Edição (só SuperAdmin)
   --------------------------------------------------------------------------- */

function EditAccessModal({
  tool,
  onClose,
}: {
  tool: ToolCard;
  onClose: () => void;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(tool.access.username ?? "");
  const [password, setPassword] = useState(tool.access.password ?? "");
  const [googleLogin, setGoogleLogin] = useState(tool.access.googleLogin);
  const [loginUrl, setLoginUrl] = useState(tool.access.loginUrl ?? "");
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(method: "PUT" | "DELETE") {
    setError(null);
    try {
      const res = await fetch(`/api/tools/${tool.id}`, {
        method,
        ...(method === "PUT"
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                username,
                password,
                googleLogin,
                loginUrl: loginUrl.trim() || null,
              }),
            }
          : {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Não foi possível gravar.");
        return false;
      }
      router.refresh();
      onClose();
      return true;
    } catch {
      setError("Sem ligação ao servidor.");
      return false;
    }
  }

  async function save() {
    // A mesma regra da rota, mas antes de sair daqui — o erro aparece por
    // baixo do campo enquanto ainda se está a olhar para ele.
    const trimmed = loginUrl.trim();
    if (trimmed && !/^https?:\/\/\S+$/i.test(trimmed)) {
      setError(
        "O link de login tem de ser um endereço completo, a começar por https://",
      );
      return;
    }
    setSaving(true);
    await send("PUT");
    setSaving(false);
  }

  async function clear() {
    setClearing(true);
    await send("DELETE");
    setClearing(false);
  }

  const busy = saving || clearing;

  const body = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar acesso — ${tool.name}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="animate-fade-up w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[color:var(--background)] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.07] ring-1 ring-white/15">
            <Image
              src={tool.logo}
              alt=""
              width={80}
              height={80}
              unoptimized
              className={
                tool.logoFit === "cover"
                  ? "h-full w-full object-cover"
                  : "h-full w-full object-contain p-1.5"
              }
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {tool.name}
            </p>
            <p className="readout text-white/35">Editar acesso</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="readout text-white/35">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              placeholder="ex.: seo@wonder-ads.com"
              className="mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-[color:var(--brand-purple)]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[color:var(--brand-purple)]/15"
            />
          </label>

          <label className="block">
            <span className="readout text-white/35">Password</span>
            <span className="relative mt-1.5 block">
              <input
                type={revealed ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 pr-11 font-mono text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-[color:var(--brand-purple)]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[color:var(--brand-purple)]/15"
              />
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                aria-label={revealed ? "Esconder" : "Revelar"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.07] hover:text-white"
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </span>
          </label>

          <label className="block">
            <span className="readout text-white/35">Link de login</span>
            <span className="relative mt-1.5 block">
              <input
                type="url"
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={tool.url}
                className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 pr-10 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-[color:var(--brand-purple)]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[color:var(--brand-purple)]/15"
              />
              {loginUrl && (
                <button
                  type="button"
                  onClick={() => setLoginUrl("")}
                  aria-label="Repor o link por defeito"
                  title="Repor o link por defeito"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </span>
            <span className="mt-1.5 block text-[11px] leading-snug text-white/35">
              Só quando o login é por um link específico (SSO, painel de
              agência, convite). Vazio abre{" "}
              <span className="text-white/50">{tool.url}</span>.
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-3 transition hover:bg-white/[0.06]">
            <input
              type="checkbox"
              checked={googleLogin}
              onChange={(e) => setGoogleLogin(e.target.checked)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[#783DF5]"
            />
            <GoogleG className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-white/85">
                Login com conta Google
              </span>
              <span className="block text-[11px] leading-snug text-white/40">
                Entra-se pelo botão «Continuar com Google», com esta conta.
              </span>
            </span>
            <span
              className={`readout shrink-0 rounded-full px-2 py-0.5 ${
                googleLogin
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/[0.06] text-white/35"
              }`}
            >
              {googleLogin ? "Sim" : "Não"}
            </span>
          </label>

          <p className="text-[11px] leading-relaxed text-white/35">
            Visível a toda a equipa com sessão. Deixar um campo vazio apaga-o
            do cartão.
          </p>

          {tool.access.updatedAt && (
            <p className="text-[11px] text-white/30">
              Última alteração {formatDateTime(tool.access.updatedAt)}
              {tool.access.updatedBy ? ` · ${tool.access.updatedBy}` : ""}
            </p>
          )}

          {error && <p className="text-[12px] text-rose-300">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-white/8 px-5 py-4">
          {(tool.access.username || tool.access.password) &&
            (confirmClear ? (
              <button
                type="button"
                onClick={clear}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-60"
              >
                {clearing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Confirmar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-white/55 transition hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar
              </button>
            ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full px-3.5 py-2 text-xs font-medium text-white/55 transition hover:text-white disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(body, document.body);
}
