import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ThreadMessage } from "@/components/messages/MessageThread";

/**
 * Carga el hilo de mensajes de una solicitud (orden cronológico).
 * Hace una segunda consulta a profiles para obtener el nombre del autor.
 */
export async function getRequestMessages(requestId: string): Promise<ThreadMessage[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("request_messages")
    .select("id, body, author_id, author_role, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    body: string;
    author_id: string;
    author_role: "admin" | "client";
    created_at: string;
  };

  const messages = (rows ?? []) as Row[];
  if (messages.length === 0) return [];

  // Resolver nombres en una sola consulta a profiles
  const authorIds = Array.from(new Set(messages.map((m) => m.author_id)));
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", authorIds);

  const nameById = new Map<string, string | null>();
  (profileRows ?? []).forEach((p: { id: string; full_name: string | null }) => {
    nameById.set(p.id, p.full_name);
  });

  return messages.map((m) => ({
    id: m.id,
    body: m.body,
    authorRole: m.author_role,
    authorName: nameById.get(m.author_id) ?? null,
    createdAt: m.created_at,
  }));
}
