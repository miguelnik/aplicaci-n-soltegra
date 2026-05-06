import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Pencil } from "lucide-react";
import { format } from "date-fns";

interface Props {
  searchParams: Promise<{ updated?: string; deleted?: string; invited?: string }>;
}

export default async function UsuariosPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select(`
      id, full_name, role, phone, created_at,
      organizations(name)
    `)
    .order("created_at", { ascending: false });

  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const emailMap = new Map(authUsers?.users?.map((u) => [u.id, u.email]) ?? []);

  const successMsg = params.invited
    ? "Invitación enviada correctamente."
    : params.updated
      ? "Usuario actualizado."
      : params.deleted
        ? "Usuario eliminado."
        : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button asChild>
          <Link href="/admin/usuarios/invitar">
            <UserPlus className="h-4 w-4" />
            Crear usuario
          </Link>
        </Button>
      </div>

      {successMsg && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">
          {successMsg}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Organización</th>
              <th className="px-4 py-3 text-left font-medium">Rol</th>
              <th className="px-4 py-3 text-left font-medium">Alta</th>
              <th className="px-4 py-3 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {profiles?.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{p.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {emailMap.get(p.id) ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {(p.organizations as unknown as { name: string } | null)?.name ?? (
                    <span className="italic">Admin Soltegra</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={p.role === "admin" ? "default" : "secondary"}>
                    {p.role === "admin" ? "Admin" : "Cliente"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(p.created_at), "dd/MM/yyyy")}
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/usuarios/${p.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!profiles?.length && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Sin usuarios todavía.
          </div>
        )}
      </div>
    </div>
  );
}
