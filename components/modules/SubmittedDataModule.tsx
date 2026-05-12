// Módulo: Datos enviados
// Muestra el formulario inicial rellenado por el cliente en modo solo lectura.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { FormData } from "@/lib/form-schema/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

export function SubmittedDataModule({ module, data }: Props) {
  const { req, schema } = data;

  // Si no hay schema disponible, el módulo no se renderiza
  if (!schema) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{module.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormRenderer
          schema={schema}
          defaultValues={req.form_data as FormData}
          requestId={req.id}
          organizationId={req.organization_id}
          disabled
        />
      </CardContent>
    </Card>
  );
}
