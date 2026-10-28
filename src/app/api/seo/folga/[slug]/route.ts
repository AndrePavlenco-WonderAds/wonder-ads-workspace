// /api/seo/folga/[slug] — a Folga de custos de um projeto SEO (v78.37).
//
//   POST  → lança um extra (sai da folga ou é cobrado ao cliente)
//   PATCH → anula um extra, com motivo (só quem o lançou ou um SuperAdmin)
//   PUT   → muda a folga mensal a partir de um mês (só SuperAdmin)
//
// Sob /api/seo/*, fora do matcher do middleware: as verificações são feitas
// aqui, à mão, como na rota da renovação — quem pode EDITAR o SEO escreve, e
// com «Ver como» ninguém escreve (o extra ficava assinado por outra pessoa).

import { NextResponse } from "next/server";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { canEditDept } from "@/lib/auth/credentials";
import { getClientTier } from "@/lib/client-tiers";
import { lisbonMonthKey } from "@/lib/dates";
import {
  FOLGA_CATEGORIES,
  FOLGA_KINDS,
  FOLGA_START,
  allowanceFor,
  baseAllowance,
  monthOf,
  shiftFolgaMonth,
  type FolgaCategory,
  type FolgaKind,
} from "@/lib/seo-folga";
import { addFolgaEntry, getFolga, setFolgaAllowance, voidFolgaEntry } from "@/lib/seo-folga-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function writer() {
  const employee = await getCurrentEmployee();
  if (!employee) return { error: bad("Sessão inválida.", 401) } as const;
  if (await getImpersonation()) {
    return { error: bad("Estás a ver a app como outra pessoa — esta vista é só de leitura.", 403) } as const;
  }
  if (!canEditDept(employee.username, "seo")) {
    return { error: bad("Só de leitura — não podes lançar extras no SEO.", 403) } as const;
  }
  return { employee, by: { username: employee.username, name: employee.name } } as const;
}

async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const todayLisbon = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(Date.now());

function validSlug(slug: string) {
  return /^[a-z0-9-]{2,80}$/.test(slug);
}

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  if (!validSlug(slug)) return bad("Projeto inválido.");
  const w = await writer();
  if ("error" in w) return w.error;
  const b = await body(req);
  if (!b) return bad("Pedido inválido.");

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (title.length < 2 || title.length > 120) return bad("Diz o que foi o extra (2 a 120 caracteres).");
  const eur = typeof b.eur === "number" ? Math.round(b.eur * 100) / 100 : NaN;
  if (!(eur > 0) || eur > 100_000) return bad("O valor tem de ser maior do que 0 €.");
  if (!FOLGA_CATEGORIES.some((c) => c.id === b.category)) return bad("Escolhe uma categoria.");
  if (!(FOLGA_KINDS as readonly unknown[]).includes(b.kind)) return bad("Diz se sai da folga ou se é cobrado.");
  const date = typeof b.date === "string" ? b.date : "";
  const today = todayLisbon();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || monthOf(date) < FOLGA_START) {
    return bad("A data tem de ser entre outubro de 2026 e hoje.");
  }
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";

  // Lite sem folga: todos os extras são cobrados — a API não deixa um
  // «oferecido» entrar por engano.
  const tier = getClientTier(slug);
  const record = await getFolga(slug);
  const allowance = allowanceFor(monthOf(date), record, baseAllowance(slug, tier));
  if (b.kind === "folga" && tier === "lite" && !allowance) {
    return bad("Cliente Lite: não tem folga — este extra tem de ser cobrado.");
  }

  await addFolgaEntry(slug, {
    date,
    eur,
    title,
    category: b.category as FolgaCategory,
    kind: b.kind as FolgaKind,
    note: note || null,
    by: w.by,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  if (!validSlug(slug)) return bad("Projeto inválido.");
  const w = await writer();
  if ("error" in w) return w.error;
  const b = await body(req);
  if (!b || typeof b.id !== "string") return bad("Pedido inválido.");
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (reason.length < 3 || reason.length > 300) return bad("Diz porque anulas (3 a 300 caracteres).");

  const result = await voidFolgaEntry(
    slug,
    b.id,
    w.by,
    reason,
    (e) => w.employee.isAdmin || e.by.username === w.employee.username,
  );
  if (result === "missing") return bad("Esse extra já não existe ou já foi anulado.", 404);
  if (result === "forbidden") return bad("Só quem lançou o extra ou a direção o pode anular.", 403);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  if (!validSlug(slug)) return bad("Projeto inválido.");
  const w = await writer();
  if ("error" in w) return w.error;
  if (!w.employee.isAdmin) return bad("Só a direção muda a folga mensal.", 403);
  const b = await body(req);
  if (!b) return bad("Pedido inválido.");
  const eur = typeof b.eur === "number" ? Math.round(b.eur * 100) / 100 : NaN;
  if (!(eur >= 0) || eur > 100_000) return bad("A folga mensal tem de ser 0 € ou mais.");
  const nowKey = lisbonMonthKey(Date.now());
  const allowed = [0, 1, 2].map((d) => shiftFolgaMonth(nowKey, d));
  if (typeof b.from !== "string" || !allowed.includes(b.from)) {
    return bad("Escolhe o mês em curso ou um dos dois seguintes — o passado não se reescreve.");
  }
  await setFolgaAllowance(slug, b.from, eur, w.by);
  return NextResponse.json({ ok: true });
}
