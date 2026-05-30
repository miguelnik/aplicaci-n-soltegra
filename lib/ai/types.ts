// ============================================================================
// Tipos y constantes para el módulo de IA.
// ============================================================================

/** Modelos disponibles para la configuración de OpenAI */
export const AI_MODELS = [
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano (más rápido y barato)" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini (equilibrado)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (equilibrado)" },
  { value: "gpt-4o", label: "GPT-4o (avanzado)" },
  { value: "gpt-4.1", label: "GPT-4.1 (más potente)" },
] as const;

export type AiModelValue = (typeof AI_MODELS)[number]["value"];

// ── Knowledge Base ──────────────────────────────────────────────────────────

export interface AiKnowledgeBase {
  id: string;
  content: string;
  updated_at: string;
  updated_by: string | null;
}

// ── Conversaciones del asistente comercial ──────────────────────────────────

export interface AiChatConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

// ── Inteligencia de cliente ─────────────────────────────────────────────────

export interface AiClientAnalysis {
  id: string;
  opportunity_id: string | null;
  organization_id: string | null;
  client_context: string | null;
  client_website: string | null;
  analysis_result: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AiClientChatMessage {
  id: string;
  analysis_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}
