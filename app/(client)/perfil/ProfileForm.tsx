"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Building2, Mail, Loader2 } from "lucide-react";

interface Props {
  profile: {
    fullName: string | null;
    phone: string | null;
    email: string;
  };
  organization: {
    name: string;
    cif: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  } | null;
}

export function ProfileForm({ profile, organization }: Props) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [orgName, setOrgName] = useState(organization?.name ?? "");
  const [orgCif, setOrgCif] = useState(organization?.cif ?? "");
  const [orgEmail, setOrgEmail] = useState(organization?.contactEmail ?? "");
  const [orgPhone, setOrgPhone] = useState(organization?.contactPhone ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/client/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          orgName,
          orgCif,
          orgEmail,
          orgPhone,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error al guardar: ${result.error}`);
        return;
      }
      toast.success("Datos guardados correctamente");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Datos personales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email: solo lectura, viene de Supabase Auth */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              Correo electrónico
            </Label>
            <Input value={profile.email} disabled className="bg-muted/40" />
            <p className="text-xs text-muted-foreground">
              Para cambiar el email contacta con Soltegra.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre y apellidos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                type="tel"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos de facturación */}
      {organization !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Datos de facturación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Estos datos se usan para la facturación de los servicios contratados.
              Todos los usuarios de tu empresa comparten esta información.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="orgName">Nombre o razón social</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Mi Empresa S.L."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orgCif">CIF / NIF</Label>
                <Input
                  id="orgCif"
                  value={orgCif}
                  onChange={(e) => setOrgCif(e.target.value)}
                  placeholder="B12345678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orgPhone">Teléfono de contacto</Label>
                <Input
                  id="orgPhone"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  placeholder="+34 900 000 000"
                  type="tel"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="orgEmail">Email de facturación</Label>
                <Input
                  id="orgEmail"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  placeholder="facturacion@miempresa.com"
                  type="email"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
