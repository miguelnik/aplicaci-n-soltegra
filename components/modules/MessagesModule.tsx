// Módulo: Mensajes
// Hilo de conversación entre cliente y Soltegra.
// Delega en el componente MessageThread existente (sin cambios en él).

import { MessageThread } from "@/components/messages/MessageThread";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

export function MessagesModule({ module, data, currentRole }: Props) {
  const { req, messages } = data;

  // En borrador, el hilo no está disponible todavía
  if (req.status === "draft") return null;

  const canWrite =
    currentRole === "admin" ||
    (req.status !== "draft" && req.status !== "cancelled");

  return (
    <MessageThread
      requestId={req.id}
      messages={messages}
      currentRole={currentRole}
      title={module.label}
      placeholder={
        currentRole === "admin"
          ? "Escribe un mensaje para el cliente..."
          : "Escribe un mensaje para el equipo..."
      }
      disabled={!canWrite}
    />
  );
}
