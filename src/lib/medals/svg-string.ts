// Árvore de elementos React (só SVG, sem hooks) → string SVG.
//
// Existe porque o Next não deixa importar react-dom/server numa rota do App
// Router, e a imagem PNG das medalhas precisa do emblema como texto SVG
// para o embutir em data-URI. O desenho (MedalArt) é uma árvore simples —
// elementos com nome, componentes-função sem hooks, arrays, strings — e
// isto chega. Não é um renderer geral de React.

import type { ReactElement, ReactNode } from "react";

const CAMEL_TO_KEBAB: Record<string, string> = {
  className: "class",
  stopColor: "stop-color",
  stopOpacity: "stop-opacity",
  strokeWidth: "stroke-width",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeDasharray: "stroke-dasharray",
  fillOpacity: "fill-opacity",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  letterSpacing: "letter-spacing",
  textAnchor: "text-anchor",
  attributeName: "attributeName",
  repeatCount: "repeatCount",
  gradientTransform: "gradientTransform",
  gradientUnits: "gradientUnits",
  viewBox: "viewBox",
};

function attrName(key: string): string {
  if (CAMEL_TO_KEBAB[key]) return CAMEL_TO_KEBAB[key];
  if (key.includes("-")) return key; // já em kebab (aria-label, data-*)
  if (/^aria[A-Z]/.test(key)) return `aria-${key.slice(4).toLowerCase()}`;
  return key;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function styleToString(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${String(v)}`)
    .join(";");
}

type Props = Record<string, unknown> & { children?: ReactNode };

function isElement(node: unknown): node is ReactElement<Props> {
  return Boolean(node) && typeof node === "object" && "type" in (node as object) && "props" in (node as object);
}

export function reactSvgToString(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeText(node);
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactSvgToString).join("");
  if (!isElement(node)) return "";

  const { type, props } = node;
  // Componente-função (sem hooks): chama-se e serializa-se o resultado.
  if (typeof type === "function") {
    const rendered = (type as (p: Props) => ReactNode)(props);
    return reactSvgToString(rendered);
  }
  // Fragment (Symbol) — só os filhos.
  if (typeof type !== "string") return reactSvgToString(props.children);

  const attrs: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "key" || key === "ref") continue;
    if (value === undefined || value === null || value === false) continue;
    if (key === "style" && typeof value === "object") {
      const s = styleToString(value as Record<string, unknown>);
      if (s) attrs.push(`style="${escapeAttr(s)}"`);
      continue;
    }
    if (key === "dangerouslySetInnerHTML") continue;
    attrs.push(`${attrName(key)}="${escapeAttr(String(value === true ? "true" : value))}"`);
  }
  const inner = reactSvgToString(props.children);
  const open = `<${type}${attrs.length ? " " + attrs.join(" ") : ""}`;
  return inner ? `${open}>${inner}</${type}>` : `${open}/>`;
}
