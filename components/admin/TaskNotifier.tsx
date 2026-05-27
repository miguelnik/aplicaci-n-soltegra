"use client";

// Lanza toasts para tareas vencidas o que vencen hoy.
// Usa localStorage para no repetir el aviso de la misma tarea más de una vez por sesión.

import { useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, Clock } from "lucide-react";
import type { PendingItem } from "@/lib/tasks/dashboard";

const STORAGE_KEY = "soltegra:task-notifications:shown";
/** Tiempo (ms) que dura un aviso "silenciado" tras mostrarse (1 hora) */
const SILENCE_MS = 60 * 60 * 1000;

interface Props {
  items: PendingItem[];
}

interface ShownMap {
  [key: string]: number;   // key: source-id  → timestamp ms when shown
}

function readShown(): ShownMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ShownMap;
  } catch { return {}; }
}

function writeShown(m: ShownMap) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch {}
}

export function TaskNotifier({ items }: Props) {
  useEffect(() => {
    if (items.length === 0) return;

    const shown = readShown();
    const now = Date.now();
    const updated: ShownMap = { ...shown };

    // Limpiar entradas viejas
    for (const k of Object.keys(updated)) {
      if (now - updated[k] > SILENCE_MS * 24) delete updated[k];
    }

    let overdueCount = 0;
    let todayCount = 0;
    const toShow: PendingItem[] = [];

    for (const item of items) {
      if (!item.due_at) continue;
      const due = new Date(item.due_at).getTime();
      const overdue = due < now;
      const isToday = (() => {
        const d = new Date(item.due_at);
        const nowD = new Date();
        return d.getFullYear() === nowD.getFullYear() && d.getMonth() === nowD.getMonth() && d.getDate() === nowD.getDate();
      })();

      if (!overdue && !isToday) continue;

      const key = `${item.source}-${item.id}`;
      const lastShown = shown[key];
      if (lastShown && (now - lastShown) < SILENCE_MS) continue;

      toShow.push(item);
      updated[key] = now;

      if (overdue) overdueCount++;
      else if (isToday) todayCount++;
    }

    // Mostrar máximo 3 toasts individuales para no saturar; el resto resumir
    const individuals = toShow.slice(0, 3);
    for (const item of individuals) {
      const due = item.due_at ? new Date(item.due_at) : null;
      const overdue = due ? due.getTime() < now : false;
      toast(
        <div className="flex items-start gap-2">
          {overdue
            ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
          <div className="min-w-0">
            <p className="font-medium">{overdue ? "Tarea vencida" : "Tarea para hoy"}</p>
            <p className="text-sm text-muted-foreground">{item.title}</p>
          </div>
        </div>,
        {
          duration: 6000,
          action: {
            label: "Ver",
            onClick: () => { window.location.href = item.href; },
          },
        },
      );
    }

    if (toShow.length > 3) {
      toast.info(`Y ${toShow.length - 3} más en tu lista de tareas`);
    }

    if (toShow.length > 0) writeShown(updated);
  }, [items]);

  return null;
}
