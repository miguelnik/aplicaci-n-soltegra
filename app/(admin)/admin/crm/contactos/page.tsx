import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Mail, Phone, Plus, Search, UserRound, Users } from "lucide-react";

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
  const contactsWithEmail = contacts.filter((contact) => Boolean(contact.email)).length;
  const contactsWithPhone = contacts.filter((contact) => Boolean(contact.phone)).length;
  const assignedContacts = contacts.filter((contact) => Boolean(contact.owner_id)).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Agenda comercial</p>
            <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Centraliza decisores, interlocutores y contactos de empresas para el CRM.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/crm/contactos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo contacto
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Contactos visibles</p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{contacts.length}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Con email</p>
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{contactsWithEmail}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Con teléfono</p>
            <Phone className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{contactsWithPhone}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Asignados</p>
            <UserRound className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{assignedContacts}</p>
        </div>
      </div>

      <form className="rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Buscar por nombre, email, teléfono o empresa"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 md:flex-none">
              Buscar
            </Button>
            {sp.q && (
              <Button variant="outline" asChild>
                <Link href="/admin/crm/contactos">Limpiar</Link>
              </Button>
            )}
          </div>
        </div>
      </form>

      {contacts.length === 0 ? (
        <div className="rounded-lg border bg-background px-4 py-10 text-center shadow-sm">
          <p className="font-medium">
            No hay contactos {sp.q ? "con esa búsqueda" : "todavía"}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sp.q ? "Prueba con otra búsqueda." : "Crea el primer contacto comercial para alimentar el CRM."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden overflow-x-auto rounded-lg border bg-background shadow-sm md:block">
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

          <div className="grid gap-3 md:hidden">
            {contacts.map((c) => {
              const org = c.organizations as { name?: string | null } | null;
              const owner = c.profiles as { full_name?: string | null } | null;
              return (
                <Link
                  key={c.id}
                  href={`/admin/crm/contactos/${c.id}`}
                  className="rounded-lg border bg-background p-4 shadow-sm transition-colors hover:bg-muted/30"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">{c.full_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{org?.name ?? c.company_name ?? "Sin empresa"}</span>
                    </div>
                    {c.position && <p className="text-sm text-muted-foreground">{c.position}</p>}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.email ?? "Sin email"}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {c.phone ?? "Sin teléfono"}
                    </span>
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      {owner?.full_name ?? "Sin comercial"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
