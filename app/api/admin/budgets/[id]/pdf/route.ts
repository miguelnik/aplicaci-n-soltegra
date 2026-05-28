// GET /api/admin/budgets/[id]/pdf
// Descarga el PDF profesional del presupuesto.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { renderBudgetPdf } from "@/lib/budgets/pdf";
import { isNextControlFlowError } from "@/lib/utils";
import type { Budget, BudgetItem, CompanySettings } from "@/lib/budgets/types";

interface Params {
  params: Promise<{ id: string }>;
}

// Cache del logo entre peticiones — el fichero es estático.
let cachedLogoDataUrl: string | null | undefined;
async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const buf = await fs.readFile(logoPath);
    cachedLogoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cachedLogoDataUrl = null;
  }
  return cachedLogoDataUrl;
}

export async function GET(_request: Request, { params }: Params) {
  await requireAdmin();
  const { id } = await params;

  try {
    const admin = createSupabaseAdminClient();

    const { data: budgetRow, error: bErr } = await admin
      .from("budgets")
      .select("*")
      .eq("id", id)
      .single();
    if (bErr || !budgetRow) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado" }, { status: 404 });
    }
    const budget = budgetRow as Budget;

    const { data: itemsRows } = await admin
      .from("budget_items")
      .select("*")
      .eq("budget_id", id)
      .order("position");
    const items = (itemsRows ?? []) as BudgetItem[];

    const { data: companyRow } = await admin.from("company_settings").select("*").limit(1).maybeSingle();
    const company = (companyRow ?? {}) as CompanySettings;

    const logoDataUrl = await getLogoDataUrl();

    const pdfBuffer = await renderBudgetPdf({ budget, items, company, logoDataUrl });

    const filename = `${budget.number ?? "presupuesto"}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
