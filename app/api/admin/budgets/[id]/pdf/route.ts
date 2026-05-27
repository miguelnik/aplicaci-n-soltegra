// GET /api/admin/budgets/[id]/pdf
// Descarga el PDF profesional del presupuesto.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { renderBudgetPdf } from "@/lib/budgets/pdf";
import type { Budget, BudgetItem, CompanySettings } from "@/lib/budgets/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

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

    // Cargar logo desde /public/logo.png a base64
    let logoDataUrl: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const buf = await fs.readFile(logoPath);
      logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      // Si no hay logo, se renderiza el nombre de la empresa en su lugar
    }

    const pdfBuffer = await renderBudgetPdf({ budget, items, company, logoDataUrl });

    const filename = `${budget.number ?? "presupuesto"}.pdf`;
    // Convertir Buffer a Uint8Array para que NextResponse lo acepte sin
    // problemas de tipos en Node 18+ runtime.
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
