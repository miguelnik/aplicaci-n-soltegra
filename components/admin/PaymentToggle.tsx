"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, CircleDashed, CreditCard, Loader2 } from "lucide-react";

interface Props {
  requestId: string;
  isPaid: boolean;
  paidAt: string | null;
}

export function PaymentToggle({ requestId, isPaid, paidAt }: Props) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/update-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: [requestId], isPaid: !isPaid }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success(isPaid ? "Marcado como pendiente de cobro" : "Marcado como cobrado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4" />
          Facturación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {isPaid ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Cobrado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300">
              <CircleDashed className="h-3 w-3" />
              Pendiente de cobro
            </Badge>
          )}
        </div>
        {isPaid && paidAt && (
          <p className="text-xs text-muted-foreground">
            Marcado el {new Date(paidAt).toLocaleDateString("es-ES")}
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={toggle}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isPaid ? (
            <CircleDashed className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {isPaid ? "Marcar como pendiente" : "Marcar como cobrado"}
        </Button>
      </CardContent>
    </Card>
  );
}
