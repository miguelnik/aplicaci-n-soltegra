"use server";

// ============================================================================
// Convertir un contacto del CRM en un cliente (usuario role=client).
// Crea (o vincula) una organización y opcionalmente envía invitación al email.
// ============================================================================

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

export interface ConvertContactInput {
  contactId: string;
  /** Si se indica, vincula al cliente existente */
  organizationId?: string | null;
  /** Si no hay organizationId, crea una nueva con este nombre */
  newOrganizationName?: string | null;
  /** Si true, envía email de invitación */
  sendInvite?: boolean;
}

export async function convertContactToClient(
  input: ConvertContactInput,
): Promise<{ ok: boolean; userId?: string; organizationId?: string; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    // 1. Cargar contacto
    const { data: contact, error: cErr } = await admin
      .from("crm_contacts")
      .select("*")
      .eq("id", input.contactId)
      .single();
    if (cErr || !contact) return { ok: false, error: "Contacto no encontrado" };
    if (!contact.email?.trim()) return { ok: false, error: "El contacto no tiene email" };
    if (contact.linked_user_id) return { ok: false, error: "Este contacto ya está vinculado a un usuario" };

    // 2. Resolver organización
    let orgId: string | null = input.organizationId ?? null;
    if (!orgId) {
      if (!input.newOrganizationName?.trim()) {
        return { ok: false, error: "Indica una organización" };
      }
      const { data: newOrg, error: orgErr } = await admin
        .from("organizations")
        .insert({
          name: input.newOrganizationName.trim(),
          contact_email: contact.email,
          contact_phone: contact.phone,
        })
        .select("id")
        .single();
      if (orgErr) return { ok: false, error: "Error creando organización: " + orgErr.message };
      orgId = newOrg.id;
    }

    // 3. ¿Existe ya un usuario con ese email?
    //    Listamos en Auth con admin API y buscamos por email (no hay get-by-email directo).
    const { data: authList } = await admin.auth.admin.listUsers();
    const existing = authList?.users?.find((u) => u.email?.toLowerCase() === contact.email!.toLowerCase());

    let userId: string;

    if (existing) {
      // Si existe, vincular y forzar role=client + org_id
      userId = existing.id;

      const { error: profileErr } = await admin
        .from("profiles")
        .upsert({
          id: userId,
          full_name: contact.full_name,
          role: "client",
          organization_id: orgId,
          phone: contact.phone,
        });
      if (profileErr) return { ok: false, error: "Error vinculando perfil: " + profileErr.message };
    } else {
      // Crear nuevo usuario con password aleatoria
      const tempPassword = `Tmp${nanoid(12)}!`;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: contact.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: contact.full_name,
          organization_id: orgId,
          role: "client",
        },
      });

      if (createErr || !created.user) {
        return { ok: false, error: "Error creando usuario: " + (createErr?.message ?? "desconocido") };
      }

      userId = created.user.id;

      const { error: profileErr } = await admin
        .from("profiles")
        .upsert({
          id: userId,
          full_name: contact.full_name,
          role: "client",
          organization_id: orgId,
          phone: contact.phone,
        });
      if (profileErr) return { ok: false, error: "Usuario creado pero error en perfil: " + profileErr.message };

      // 4. Invitar (opcional) — generar magic link
      if (input.sendInvite) {
        try {
          // Generar link de recuperación para que el usuario establezca su contraseña
          await admin.auth.admin.generateLink({
            type: "recovery",
            email: contact.email,
          });
          // Nota: Supabase enviará el email automáticamente si está configurado el SMTP.
        } catch {
          // No bloqueamos por error de invitación
        }
      }
    }

    // 5. Actualizar el contacto con el vínculo
    const { error: linkErr } = await admin
      .from("crm_contacts")
      .update({
        linked_user_id: userId,
        organization_id: orgId,
      })
      .eq("id", input.contactId);

    if (linkErr) return { ok: false, error: "Error vinculando contacto: " + linkErr.message };

    revalidatePath(`/admin/crm/contactos/${input.contactId}`);
    revalidatePath("/admin/clientes");
    revalidatePath("/admin/usuarios");

    return { ok: true, userId, organizationId: orgId ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Versión interna que se llama automáticamente al convertir una oportunidad
 *  ganada en proyecto. Recibe el contactId si existe — silencioso si falla. */
export async function autoLinkContactOnConversion(
  contactId: string | null,
  organizationId: string,
): Promise<void> {
  if (!contactId) return;
  try {
    const admin = createSupabaseAdminClient();
    const { data: c } = await admin
      .from("crm_contacts")
      .select("email, linked_user_id")
      .eq("id", contactId)
      .single();
    if (!c || c.linked_user_id) return;

    // Reutilizamos el flujo principal. Si no tiene email, lo dejamos sin invitación.
    if (!c.email?.trim()) {
      // Sólo vincular org
      await admin
        .from("crm_contacts")
        .update({ organization_id: organizationId })
        .eq("id", contactId);
      return;
    }

    await convertContactToClient({
      contactId,
      organizationId,
      sendInvite: true,
    });
  } catch {
    // Silencioso
  }
}
