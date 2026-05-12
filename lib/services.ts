import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceModuleConfig } from "@/lib/modules/types";

export { nameToSlug } from "./slug";

export interface ServiceType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  /**
   * Configuración de módulos del portal del cliente para este servicio.
   * Si es null, se usa la configuración por defecto definida en lib/modules/defaults.ts.
   */
  module_config: ServiceModuleConfig | null;
  created_at: string;
  updated_at: string;
}

/** Lista de servicios activos, ordenados. */
export async function getActiveServices(): Promise<ServiceType[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("service_types")
    .select("*")
    .eq("is_active", true)
    .order("display_order")
    .order("name");
  return (data as ServiceType[] | null) ?? [];
}

/** Lista de TODOS los servicios (para admin). */
export async function getAllServices(): Promise<ServiceType[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("service_types")
    .select("*")
    .order("display_order")
    .order("name");
  return (data as ServiceType[] | null) ?? [];
}

/** Obtiene un servicio por slug. */
export async function getServiceBySlug(slug: string): Promise<ServiceType | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("service_types")
    .select("*")
    .eq("slug", slug)
    .single();
  return (data as ServiceType | null) ?? null;
}

/** Obtiene un servicio por id. */
export async function getServiceById(id: string): Promise<ServiceType | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("service_types")
    .select("*")
    .eq("id", id)
    .single();
  return (data as ServiceType | null) ?? null;
}
