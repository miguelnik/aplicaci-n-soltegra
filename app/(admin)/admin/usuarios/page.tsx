import Link from "next/link";
import { requireAdmin, getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Pencil } from "lucide-react";
import { format } from "date-fns";
import { WorkerRateEditor } from "@/components/admin/WorkerRateEditor";

interface Props {
  searchParams: Promise<{ updated?: string; deleted?: string; invited?: string }>;
}

const ROLE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  superadmin: { label: "Superadmin",    variant: "destructive" },
  admin:      { label: "Admin",         variant: "default" },
  client:     { label: "Cliente",       variant: "secondary" },
};

export default async function UsuariosPage({ searchParams }: Props) {
  const currentProfile = await requireAdmin();
  await getCurrentProfile();
  const params = await searchParams;
  const isSuperAdmin = currentProfile.role === "superadmin";

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: profiles } = await adminClient
    .from("profiles")
    .select(`
      id, full_name, role, phone, hourly_cost, created_at,
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

      {!isSuperAdmin && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Como administrador solo puedes editar y eliminar usuarios clientes. Para gestionar administradores, contacta con un superadministrador.
        </div>
      )}

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
              {isSuperAdmin && (
                <th className="px-4 py-3 text-left font-medium">Tarifa coste/h</th>
              )}
              <th className="px-4 py-3 text-left font-medium">Alta</th>
              <th className="px-4 py-3 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {profiles?.map((p) => {
              const roleCfg = ROLE_LABEL[p.role] ?? ROLE_LABEL.client;
              // Un admin normal no puede editar a otros admins ni superadmins
              const canEdit = isSuperAdmin || p.role === "client";

              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emailMap.get(p.id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(p.organizations as unknown as { name: string } | null)?.name ?? (
                      <span className="italic text-muted-foreground/60">
                        {p.role === "superadmin" ? "Superadmin" : "Admin Soltegra"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleCfg.variant}>{roleCfg.label}</Badge>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3">
                      {(p.role === "admin" || p.role === "superadmin") ? (
                        <WorkerRateEditor
                          workerId={p.id}
                          initialRate={(p as { hourly_cost?: number | null }).hourly_cost ?? null}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(p.created_at), "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/usuarios/${p.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 px-2">
                        Solo superadmin
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
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
