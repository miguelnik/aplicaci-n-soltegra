"use client";

// Tablero Kanban del embudo de ventas.
// Cada columna = un stage. Las tarjetas se arrastran entre columnas con
// @dnd-kit para cambiar el stage de la oportunidad.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import { Euro, Calendar, User, Building2, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { setOpportunityStage } from "@/lib/crm/actions";
import {
  ACTIVE_STAGES, STAGE_LABEL, STAGE_COLOR,
  type OpportunityStage, type CrmOpportunityWithRelations,
} from "@/lib/crm/types";

interface Props {
  opportunities: CrmOpportunityWithRelations[];
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
});

export function PipelineBoard({ opportunities }: Props) {
  const router = useRouter();
  // Estado local optimista — al soltar, movemos la tarjeta de inmediato
  const [items, setItems]     = useState(opportunities);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;
    const newStage = String(over.id) as OpportunityStage;
    const id = String(active.id);
    const current = items.find((o) => o.id === id);
    if (!current || current.stage === newStage) return;

    // Optimistic update
    setItems((prev) => prev.map((o) => o.id === id ? { ...o, stage: newStage } : o));

    const res = await setOpportunityStage(id, newStage);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar de estado");
      // Revertir
      setItems((prev) => prev.map((o) => o.id === id ? { ...o, stage: current.stage } : o));
    } else {
      const stageLabel = STAGE_LABEL[newStage];
      toast.success(`Movida a "${stageLabel}"`);
      router.refresh();
    }
  }

  const draggingOpp = draggingId ? items.find((o) => o.id === draggingId) : null;

  // Métricas resumidas (visibles arriba)
  const activeOpps = items.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const totalActiveValue = activeOpps.reduce((a, o) => a + (o.estimated_value ?? 0), 0);
  const wonCount = items.filter((o) => o.stage === "won").length;
  const lostCount = items.filter((o) => o.stage === "lost").length;
  const wonValue = items.filter((o) => o.stage === "won")
    .reduce((a, o) => a + (o.estimated_value ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Oportunidades activas" value={String(activeOpps.length)} />
        <SummaryCard label="Valor en pipeline" value={eur(totalActiveValue)} />
        <SummaryCard label="Ganadas (total)" value={`${wonCount} · ${eur(wonValue)}`} color="green" />
        <SummaryCard label="Perdidas (total)" value={String(lostCount)} color="rose" />
      </div>

      {/* Kanban activo */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${ACTIVE_STAGES.length}, minmax(220px, 1fr))` }}>
          {ACTIVE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              opportunities={items.filter((o) => o.stage === stage)}
            />
          ))}
        </div>

        <DragOverlay>
          {draggingOpp && <OpportunityCard opp={draggingOpp} dragging />}
        </DragOverlay>
      </DndContext>

      {/* Ganadas / Perdidas (no draggables, sólo info) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ClosedColumn
          label={STAGE_LABEL.won}
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          color="green"
          opportunities={items.filter((o) => o.stage === "won")}
        />
        <ClosedColumn
          label={STAGE_LABEL.lost}
          icon={<XCircle className="h-4 w-4 text-rose-600" />}
          color="rose"
          opportunities={items.filter((o) => o.stage === "lost")}
        />
      </div>
    </div>
  );
}

// ── Resumen card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color = "default" }: { label: string; value: string; color?: "default" | "green" | "rose" }) {
  const colorClass =
    color === "green" ? "text-green-700" :
    color === "rose"  ? "text-rose-600" :
                        "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-mono text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ── Columna Kanban ───────────────────────────────────────────────────────────

function KanbanColumn({ stage, opportunities }: { stage: OpportunityStage; opportunities: CrmOpportunityWithRelations[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalValue = opportunities.reduce((a, o) => a + (o.estimated_value ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[400px] flex-col rounded-lg border bg-muted/30 p-2 transition-colors ${isOver ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <Badge variant="outline" className={STAGE_COLOR[stage]}>
          {STAGE_LABEL[stage]}
        </Badge>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>{opportunities.length}</div>
          {totalValue > 0 && <div className="font-mono">{eur(totalValue)}</div>}
        </div>
      </div>

      <div className="space-y-2">
        {opportunities.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
            Suelta aquí
          </p>
        ) : (
          opportunities.map((o) => (
            <DraggableCard key={o.id} opp={o} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({ opp }: { opp: CrmOpportunityWithRelations }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${isDragging ? "opacity-30" : ""}`}
    >
      <OpportunityCard opp={opp} />
    </div>
  );
}

// ── Tarjeta de oportunidad ───────────────────────────────────────────────────

function OpportunityCard({ opp, dragging }: { opp: CrmOpportunityWithRelations; dragging?: boolean }) {
  const initials = (opp.owner_name ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Link
      href={`/admin/crm/oportunidades/${opp.id}`}
      onClick={(e) => { if (dragging) e.preventDefault(); }}
      className={`block cursor-grab rounded-md border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md ${dragging ? "rotate-1 shadow-lg" : ""}`}
    >
      <p className="text-sm font-medium leading-tight">{opp.title}</p>
      <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
        {(opp.contact_name || opp.organization_name) && (
          <div className="flex items-center gap-1.5">
            {opp.organization_name ? <Building2 className="h-3 w-3 shrink-0" /> : <User className="h-3 w-3 shrink-0" />}
            <span className="truncate">{opp.organization_name ?? opp.contact_name}</span>
          </div>
        )}
        {opp.service_name && (
          <p className="truncate text-muted-foreground/80">{opp.service_name}</p>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-1">
        <div className="flex flex-col gap-0.5">
          {opp.estimated_value != null && (
            <span className="flex items-center gap-0.5 font-mono text-xs font-semibold">
              <Euro className="h-3 w-3" />
              {opp.estimated_value.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </span>
          )}
          {opp.expected_close_date && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Calendar className="h-2.5 w-2.5" />
              {format(parseISO(opp.expected_close_date), "d MMM", { locale: es })}
            </span>
          )}
        </div>
        {opp.owner_name && (
          <span
            title={opp.owner_name}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary"
          >
            {initials}
          </span>
        )}
      </div>
      {opp.next_action && (
        <p className="mt-2 truncate rounded bg-muted/50 px-1.5 py-1 text-[10px] text-muted-foreground">
          ⇒ {opp.next_action}
        </p>
      )}
    </Link>
  );
}

// ── Columnas cerradas (won/lost) ─────────────────────────────────────────────

function ClosedColumn({
  label, icon, color, opportunities,
}: {
  label: string;
  icon: React.ReactNode;
  color: "green" | "rose";
  opportunities: CrmOpportunityWithRelations[];
}) {
  const totalValue = opportunities.reduce((a, o) => a + (o.estimated_value ?? 0), 0);
  const border = color === "green" ? "border-green-200" : "border-rose-200";

  return (
    <details className={`rounded-lg border ${border} bg-card p-3`}>
      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
        <div className="flex items-center gap-2">
          {icon}
          {label} <span className="text-muted-foreground">({opportunities.length})</span>
        </div>
        {totalValue > 0 && (
          <span className="font-mono text-xs text-muted-foreground">{eur(totalValue)}</span>
        )}
      </summary>
      <ul className="mt-3 space-y-2">
        {opportunities.length === 0 ? (
          <li className="text-xs text-muted-foreground">—</li>
        ) : (
          opportunities.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/crm/oportunidades/${o.id}`}
                className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs hover:bg-muted/60"
              >
                <span className="truncate">{o.title}</span>
                {o.estimated_value != null && (
                  <span className="shrink-0 font-mono">{eur(o.estimated_value)}</span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
    </details>
  );
}
