import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  draft: { label: "Borrador", variant: "outline" },
  submitted: { label: "Enviada", variant: "info" },
  in_review: { label: "En revisión", variant: "warning" },
  in_progress: { label: "En redacción", variant: "warning" },
  awaiting_info: { label: "Pendiente de info", variant: "destructive" },
  delivered: { label: "Entregado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "secondary" },
} as const;

type Status = keyof typeof STATUS_CONFIG;

export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" };
  return <Badge variant={config.variant as never}>{config.label}</Badge>;
}
