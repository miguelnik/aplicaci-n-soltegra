// Dispatcher de módulos.
// Dado un ModuleConfig y los datos de la página, renderiza el componente correcto.
// Es un Server Component: puede recibir datos pre-fetched y renderizar sin fetch extra.
// Los módulos no implementados se muestran solo al admin como "Próximamente".

import { MODULE_CATALOG_MAP } from "@/lib/modules/catalog";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

import { StatusTimelineModule } from "./StatusTimelineModule";
import { MessagesModule } from "./MessagesModule";
import { SubmittedDataModule } from "./SubmittedDataModule";
import { ClientFilesModule } from "./ClientFilesModule";
import { DeliverablesModule } from "./DeliverablesModule";
import { DocumentsModule } from "./DocumentsModule";
import { PaymentStatusModule } from "./PaymentStatusModule";
import { ComingSoonModule } from "./ComingSoonModule";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

export function ModuleSwitch({ module, data, currentRole }: Props) {
  const isAdmin = currentRole === "admin";
  const meta = MODULE_CATALOG_MAP.get(module.key);

  // Si el módulo no está implementado, mostrar placeholder solo al admin
  if (meta && !meta.implemented) {
    return <ComingSoonModule module={module} isAdmin={isAdmin} />;
  }

  switch (module.key) {
    case "status_timeline":
      return <StatusTimelineModule module={module} data={data} />;

    case "messages":
      return (
        <MessagesModule module={module} data={data} currentRole={currentRole} />
      );

    case "submitted_data":
      return <SubmittedDataModule module={module} data={data} />;

    case "client_files":
      return <ClientFilesModule module={module} data={data} />;

    case "deliverables":
      return <DeliverablesModule module={module} data={data} />;

    case "documents":
      return <DocumentsModule module={module} data={data} isAdmin={isAdmin} />;

    case "payment":
      return (
        <PaymentStatusModule module={module} data={data} isAdmin={isAdmin} />
      );

    // Módulos futuros: caen en ComingSoon
    case "milestones":
    case "pending_decisions":
    case "incidents":
    case "risks":
    case "construction_dashboard":
    case "site_visits":
    case "site_photos":
    case "meeting_minutes":
    case "economic_summary":
      return <ComingSoonModule module={module} isAdmin={isAdmin} />;

    default:
      // Módulo desconocido: silencio en cliente, aviso en admin
      if (isAdmin) {
        return (
          <ComingSoonModule
            module={{ ...module, label: `${module.label} (módulo desconocido: ${module.key})` }}
            isAdmin
          />
        );
      }
      return null;
  }
}
