"use client";

// Timeline + formulario de interacciones (comunicaciones).
// Reutilizable desde contactos y oportunidades.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Phone, Users, FileText, MessageSquare, Circle,
  ArrowDownLeft, ArrowUpRight, Plus, Trash2, X, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { createCrmInteraction, deleteCrmInteraction } from "@/lib/crm/actions";
import {
  INTERACTION_KIND_LABEL,
  type InteractionKind, type InteractionDirection,
  type CrmInteractionWithAuthor,
} from "@/lib/crm/types";

interface Props {
  contactId?: string | null;
  opportunityId?: string | null;
  interactions: CrmInteractionWithAuthor[];
}

const KIND_ICON: Record<InteractionKind, React.ReactNode> = {
  email:    <Mail className="h-3.5 w-3.5" />,
  call:     <Phone className="h-3.5 w-3.5" />,
  meeting:  <Users className="h-3.5 w-3.5" />,
  note:     <FileText className="h-3.5 w-3.5" />,
  whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
  other:    <Circle className="h-3.5 w-3.5" />,
};

const KIND_COLOR: Record<InteractionKind, string> = {
  email:    "text-blue-600 bg-blue-50 border-blue-200",
  call:     "text-purple-600 bg-purple-50 border-purple-200",
  meeting:  "text-indigo-600 bg-indigo-50 border-indigo-200",
  note:     "text-slate-600 bg-slate-50 border-slate-200",
  whatsapp: "text-green-600 bg-green-50 border-green-200",
  other:    "text-slate-600 bg-slate-50 border-slate-200",
};

export function InteractionTimeline({ contactId, opportunityId, interactions }: Props) {
  const router = useRouter();
  const [open, setOpen]               = useState(false);
  const [kind, setKind]               = useState<InteractionKind>("call");
  const [direction, setDirection]     = useState<InteractionDirection | "">("");
  const [happenedAt, setHappenedAt]   = useState(() => new Date().toISOString().slice(0, 16));
  const [subject, setSubject]         = useState("");
  const [summary, setSummary]         = useState("");
  const [pending, startTransition]    = useTransition();
  const [busyId, setBusyId]           = useState<string | null>(null);

  function reset() {
    setKind("call");
    setDirection("");
    setHappenedAt(new Date().toISOString().slice(0, 16));
    setSubject("");
    setSummary("");
  }

  function submit() {
    if (!summary.trim() && !subject.trim()) {
      toast.error("Indica al menos un asunto o un resumen");
      return;
    }
    startTransition(async () => {
      const res = await createCrmInteraction({
        contactId: contactId ?? null,
        opportunityId: opportunityId ?? null,
        kind,
        happenedAt: new Date(happenedAt).toISOString(),
        subject: subject || null,
        summary: summary || null,
        direction: direction || null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Interacción registrada");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("¿Eliminar esta interacción?")) return;
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteCrmInteraction(id);
      setBusyId(null);
      if (!res.ok) toast.error(res.error ?? "Error");
      else {
        toast.success("Eliminada");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Historial de comunicaciones ({interactions.length})
        </h3>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Registrar
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Nueva interacción</p>
            <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as InteractionKind)}
                disabled={pending}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {(Object.keys(INTERACTION_KIND_LABEL) as InteractionKind[]).map((k) => (
                  <option key={k} value={k}>{INTERACTION_KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as InteractionDirection | "")}
                disabled={pending}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">—</option>
                <option value="inbound">Entrante</option>
                <option value="outbound">Saliente</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={happenedAt}
                onChange={(e) => setHappenedAt(e.target.value)}
                disabled={pending}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Asunto (opcional)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: Llamada de seguimiento, propuesta enviada…"
              className="h-8 text-sm"
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Resumen</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Qué se habló, acuerdos, próximos pasos…"
              rows={3}
              className="text-sm"
              disabled={pending}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={pending}>Cancelar</Button>
          </div>
        </div>
      )}

      {interactions.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Aún no hay comunicaciones registradas.
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-muted-foreground/20 pl-6">
          {interactions.map((i) => (
            <li key={i.id} className="relative">
              <span className={`absolute -left-[1.45rem] flex h-6 w-6 items-center justify-center rounded-full border bg-background ${KIND_COLOR[i.kind]}`}>
                {KIND_ICON[i.kind]}
              </span>
              <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`gap-1 ${KIND_COLOR[i.kind]}`}>
                      {INTERACTION_KIND_LABEL[i.kind]}
                    </Badge>
                    {i.direction === "inbound" && (
                      <span title="Entrante" className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <ArrowDownLeft className="h-3 w-3" />
                      </span>
                    )}
                    {i.direction === "outbound" && (
                      <span title="Saliente" className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <ArrowUpRight className="h-3 w-3" />
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(i.happened_at), "d MMM yyyy · HH:mm", { locale: es })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i.id)}
                    disabled={busyId === i.id}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {i.subject && <p className="mt-1 text-sm font-medium">{i.subject}</p>}
                {i.summary && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{i.summary}</p>
                )}
                {i.author_name && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">por {i.author_name}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
