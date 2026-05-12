// Dispatcher de módulos.
// Dado un ModuleConfig y los datos de la página, renderiza el componente correcto.
// Es un Server Component: puede recibir datos pre-fetched y renderizar sin fetch extra.

import { MODULE_CATALOG_MAP } from "@/lib/modules/catalog";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

import { StatusTimelineModule } from "./StatusTimelineModule";
import { MessagesModule } from "./MessagesModule";
import { SubmittedDataModule } from "./SubmittedDataModule";
import { ClientFilesModule } from "./ClientFilesModule";
import { DeliverablesModule } from "./DeliverablesModule";
import { DocumentsModule } from "./DocumentsModule";
import { PaymentStatusModule } from "./PaymentStatusModule";
import { MilestonesModule } from "./MilestonesModule";
import { PendingDecisionsModule } from "./PendingDecisionsModule";
import { IncidentsModule } from "./IncidentsModule";
import { RisksModule } from "./RisksModule";
import { ConstructionDashboardModule } from "./ConstructionDashboardModule";
import { SiteVisitsModule } from "./SiteVisitsModule";
import { SitePhotosModule } from "./SitePhotosModule";
import { MeetingMinutesModule } from "./MeetingMinutesModule";
import { EconomicSummaryModule } from "./EconomicSummaryModule";
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
    // ── Módulos base (Fase 1) ────────────────────────────────────────────────

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

    // ── Gestión de proyecto (Fase 2) ─────────────────────────────────────────

    case "milestones":
      return <MilestonesModule module={module} data={data} />;

    case "pending_decisions":
      return (
        <PendingDecisionsModule
          module={module}
          data={data}
          currentRole={currentRole}
        />
      );

    case "incidents":
      return <IncidentsModule module={module} data={data} />;

    case "risks":
      return <RisksModule module={module} data={data} />;

    // ── Dirección de obra (Fase 2) ───────────────────────────────────────────

    case "construction_dashboard":
      return <ConstructionDashboardModule module={module} data={data} />;

    case "site_visits":
      return <SiteVisitsModule module={module} data={data} />;

    case "site_photos":
      return <SitePhotosModule module={module} data={data} />;

    case "meeting_minutes":
      return <MeetingMinutesModule module={module} data={data} />;

    case "economic_summary":
      return <EconomicSummaryModule module={module} data={data} />;

    default:
      // Módulo desconocido: silencio en cliente, aviso en admin
      if (isAdmin) {
        return (
          <ComingSoonModule
            module={{
              ...module,
              label: `${module.label} (módulo desconocido: ${module.key})`,
            }}
            isAdmin
          />
        );
      }
      return null;
  }
}
