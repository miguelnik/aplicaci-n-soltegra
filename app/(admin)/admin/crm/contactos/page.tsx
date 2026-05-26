import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ContactosPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("crm_contacts")
    .select(`
      *,
      organizations:organization_id ( name ),
      profiles:owner_id ( full_name )
    `)
    .order("updated_at", { ascending: false });

  if (sp.q?.trim()) {
    const q = sp.q.trim();
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%`);
  }

  const { data: rows } = await query;
  const contacts = rows ?? [];

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-xs font-medium">Buscar</label>
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nombre, email, teléfono, empresa…"
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <button type="submit" className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">
          Buscar
        </button>
        <Link href="/admin/crm/contactos" className="text-xs text-muted-foreground hover:text-foreground">
          Limpiar
        </Link>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href="/admin/crm/contactos/nuevo">
              <Plus className="h-3.5 w-3.5" />
              Nuevo contacto
            </Link>
          </Button>
        </div>
      </form>

      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay contactos {sp.q ? "con esa búsqueda" : "todavía"}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-3 py-2 text-left font-medium">Empresa</th>
                <th className="px-3 py-2 text-left font-medium">Cargo</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Teléfono</th>
                <th className="px-3 py-2 text-left font-medium">Comercial</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contacts.map((c) => {
                const org = c.organizations as { name?: string | null } | null;
                const owner = c.profiles as { full_name?: string | null } | null;
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link href={`/admin/crm/contactos/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {org?.name ?? c.company_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.position ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{owner?.full_name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
