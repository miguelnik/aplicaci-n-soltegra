import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export type Role = "admin" | "client";

export interface Profile {
  id: string;
  organization_id: string | null;
  role: Role;
  full_name: string | null;
  phone: string | null;
}

/**
 * Devuelve el perfil del usuario autenticado, o null si no hay sesión.
 * No redirige.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name, phone")
    .eq("id", user.id)
    .single();

  return (profile as Profile | null) ?? null;
}

/**
 * Devuelve el perfil del usuario autenticado o redirige a /login.
 * Usar en páginas que requieren sesión.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Devuelve el perfil del admin autenticado o redirige.
 * Usar en páginas /admin/*.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}

/**
 * Devuelve el perfil de un cliente o redirige al admin a su dashboard si entra
 * por error en una ruta de cliente.
 */
export async function requireClient(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "client") redirect("/admin/dashboard");
  return profile;
}
