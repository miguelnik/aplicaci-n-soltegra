"use client";

// Editor inline de la tarifa coste/hora de un trabajador. Sólo superadmin.

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateWorkerHourlyCost } from "@/lib/hours/actions";

interface Props {
  workerId: string;
  initialRate: number | null;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

export function WorkerRateEditor({ workerId, initialRate }: Props) {
  const [rate, setRate] = useState(initialRate);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialRate != null ? String(initialRate) : "");
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = value === "" ? null : parseFloat(value);
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error("Tarifa inválida");
      return;
    }
    startTransition(async () => {
      const res = await updateWorkerHourlyCost(workerId, parsed);
      if (res.ok) {
        setRate(parsed);
        setEditing(false);
        toast.success("Tarifa actualizada");
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs">
          {rate != null ? `${eur(rate)}/h` : <span className="text-muted-foreground italic">Sin tarifa</span>}
        </span>
        <button
          type="button"
          onClick={() => { setEditing(true); setValue(rate != null ? String(rate) : ""); }}
          className="text-muted-foreground hover:text-foreground"
          title="Editar tarifa"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="€/h"
        className="h-7 w-20 text-xs"
        autoFocus
        disabled={pending}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button size="icon" className="h-7 w-7" onClick={save} disabled={pending}>
        <Check className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)} disabled={pending}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
