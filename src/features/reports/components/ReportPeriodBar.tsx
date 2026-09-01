import type { ReportPeriodKind, ReportPeriodState } from "@/features/reports/lib/report-period";

const PERIOD_OPTIONS: { id: ReportPeriodKind; label: string }[] = [
  { id: "dia", label: "Día" },
  { id: "mes", label: "Mes" },
  { id: "total", label: "Total" },
  { id: "rango", label: "Rango" },
];

interface ReportPeriodBarProps {
  value: ReportPeriodState;
  onChange: (next: ReportPeriodState) => void;
}

/**
 * Barra de periodo compartida: Día, Mes, Total o Rango con inputs ISO.
 *
 * @param props - Estado y callback de cambio.
 * @returns Controles de filtro.
 */
export function ReportPeriodBar(props: ReportPeriodBarProps) {
  const { value, onChange } = props;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="join" role="group" aria-label="Periodo del reporte">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`btn btn-sm join-item ${value.kind === opt.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => onChange({ ...value, kind: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value.kind === "dia" ? (
        <label className="form-control">
          <span className="label-text text-xs">Fecha</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={value.day}
            onChange={(e) => onChange({ ...value, day: e.target.value })}
          />
        </label>
      ) : null}

      {value.kind === "mes" ? (
        <label className="form-control">
          <span className="label-text text-xs">Mes</span>
          <input
            type="month"
            className="input input-bordered input-sm"
            value={value.month}
            onChange={(e) => onChange({ ...value, month: e.target.value || value.month })}
          />
        </label>
      ) : null}

      {value.kind === "rango" ? (
        <>
          <label className="form-control">
            <span className="label-text text-xs">Desde</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={value.rangeFrom}
              onChange={(e) => onChange({ ...value, rangeFrom: e.target.value })}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Hasta</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={value.rangeTo}
              onChange={(e) => onChange({ ...value, rangeTo: e.target.value })}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
