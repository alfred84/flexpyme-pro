import type { ReportTableSection } from "@/lib/report-export";

/** Props comunes de un informe del hub (carga condicional + secciones de exporte). */
export interface OperationalReportViewProps {
  dateFrom: string | null;
  dateTo: string | null;
  enabled: boolean;
  periodLabel: string;
  onSectionsChange: (sections: ReportTableSection[] | null) => void;
}
