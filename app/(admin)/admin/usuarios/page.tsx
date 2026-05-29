import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserEmailsMap } from "@/lib/supabase/users-cache";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Mail,
  Pencil,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { WorkerRateEditor } from "@/components/admin/WorkerRateEditor";

interface Props {
  searchParams: Promise<{
    updated?: string;
    deleted?: string;
    invited?: string;
    error?: string;
    q?: string;
  }>;
}

const ROLE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  superadmin: { label: "Superadmin",    variant: "destructive" },
  admin:      { label: "Admin",         variant: "default" },
  client:     { label: "Cliente",       variant: "secondary" },
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  hourly_cost?: number | null;
  created_at: string;
  organizations: { name: string } | { name: string }[] | null;
};

function getOrganizationName(profile: ProfileRow) {
  const org = profile.organizations;
  if (Array.isArray(org)) return org[0]?.name ?? null;
  return org?.name ?? null;
}

function getVisibleOrganization(profile: ProfileRow) {
  return getOrganizationName(profile) ?? (profile.role === "superadmin" ? "Superadmin" : "Admin Soltegra");
}

export default async function UsuariosPage({ searchParams }: Props) {
  const currentProfile = await requireAdmin();
  const params = await searchParams;
  const isSuperAdmin = currentProfile.role === "superadmin";
  const query = (params.q ?? "").trim().toLowerCase();

  const adminClient = createSupabaseAdminClient();

  const { data: profiles } = await adminClient
    .from("profiles")
    .select(`
      id, full_name, role, phone, hourly_cost, created_at,
      organizations(name)
    `)
    .order("created_at", { ascending: false });
  const profileRows = (profiles ?? []) as ProfileRow[];

  // Cacheado con TTL de 5 min — listUsers es lento y los emails cambian rara vez
  const emailsObj = await getUserEmailsMap();
  const emailMap = new Map(Object.entries(emailsObj));

  const successMsg = params.invited
    ? "Invitación enviada correctamente."
    : params.updated
      ? "Usuario actualizado."
      : params.deleted
        ? "Usuario eliminado."
        : null;

  const filteredProfiles = query
    ? profileRows.filter((profile) => {
        const email = emailMap.get(profile.id) ?? "";
        const orgName = getVisibleOrganization(profile);
        return [profile.full_name, email, orgName, ROLE_LABEL[profile.role]?.label ?? profile.role]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
    : profileRows;

  const totalUsers = profileRows.length;
  const adminUsers = profileRows.filter((profile) => profile.role === "admin" || profile.role === "superadmin").length;
  const clientUsers = profileRows.filter((profile) => profile.role === "client").length;
  const usersWithoutOrg = profileRows.filter((profile) => profile.role === "client" && !getOrganizationName(profile)).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Equipo y accesos</p>
            <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Gestiona clientes, administradores y permisos desde una vista rápida.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/usuarios/invitar">
              <UserPlus className="h-4 w-4" />
              Crear usuario
            </Link>
          </Button>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Como administrador solo puedes editar y eliminar usuarios clientes. Para gestionar administradores,
            contacta con un superadministrador.
          </p>
        </div>
      )}

      {successMsg && (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {params.error && (
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{params.error}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Usuarios totales</p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{totalUsers}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Equipo Soltegra</p>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{adminUsers}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Clientes</p>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{clientUsers}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Clientes sin empresa</p>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{usersWithoutOrg}</p>
        </div>
      </div>

      <form className="rounded-lg border bg-background p-4 shadow-sm" action="/admin/usuarios">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar por nombre, email, organización o rol"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 md:flex-none">
              Buscar
            </Button>
            {query && (
              <Button variant="outline" asChild>
                <Link href="/admin/usuarios">Limpiar</Link>
              </Button>
            )}
          </div>
        </div>
      </form>

      <div className="hidden overflow-x-auto rounded-lg border bg-background shadow-sm md:block">
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
            {filteredProfiles.map((p) => {
              const roleCfg = ROLE_LABEL[p.role] ?? ROLE_LABEL.client;
              // Un admin normal no puede editar a otros admins ni superadmins
              const canEdit = isSuperAdmin || p.role === "client";
              const orgName = getOrganizationName(p);
              const email = emailMap.get(p.id);

              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {orgName ?? (
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
                          initialRate={p.hourly_cost ?? null}
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
      </div>

      <div className="grid gap-3 md:hidden">
        {filteredProfiles.map((p) => {
          const roleCfg = ROLE_LABEL[p.role] ?? ROLE_LABEL.client;
          const canEdit = isSuperAdmin || p.role === "client";
          const orgName = getVisibleOrganization(p);
          const email = emailMap.get(p.id);

          return (
            <div key={p.id} className="rounded-lg border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-semibold">{p.full_name ?? "Sin nombre"}</p>
                  <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{email ?? "Sin email visible"}</span>
                  </div>
                </div>
                <Badge variant={roleCfg.variant}>{roleCfg.label}</Badge>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{orgName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>Alta {format(new Date(p.created_at), "dd/MM/yyyy")}</span>
                </div>
              </div>

              {isSuperAdmin && (p.role === "admin" || p.role === "superadmin") && (
                <div className="mt-4 rounded-md border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Tarifa coste/h</p>
                  <WorkerRateEditor workerId={p.id} initialRate={p.hourly_cost ?? null} />
                </div>
              )}

              <div className="mt-4">
                {canEdit ? (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/admin/usuarios/${p.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar usuario
                    </Link>
                  </Button>
                ) : (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
                    Solo superadmin puede editar este usuario
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!filteredProfiles.length && (
        <div className="rounded-lg border bg-background px-4 py-10 text-center shadow-sm">
          <p className="font-medium">{query ? "No hay usuarios con esa búsqueda." : "Sin usuarios todavía."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query ? "Prueba con otro nombre, email u organización." : "Crea el primer usuario para dar acceso a la plataforma."}
          </p>
        </div>
      )}
    </div>
  );
}
