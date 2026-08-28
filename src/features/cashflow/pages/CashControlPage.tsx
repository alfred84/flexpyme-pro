import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Banknote, ClipboardList } from "lucide-react";
import { fetchCashControlSummary } from "@/db/queries/cashflow";
import { CashDailyTable } from "@/features/cashflow/components/CashDailyTable";
import { CashMonitorTable } from "@/features/cashflow/components/CashMonitorTable";
import { CashOpeningModal } from "@/features/cashflow/components/CashOpeningModal";
import { CashOpeningTable } from "@/features/cashflow/components/CashOpeningTable";
import {
  clampIsoToMonth,
  currentMonthYm,
  formatDate,
  formatDateTime,
  monthEndIso,
  monthStartIso,
  todayIso,
} from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";

const LEDGER_GAP_EPS = 1;

type MonitorMode = "mes" | "dia";

/**
 * Control de efectivo: saldo inicial del mes y monitoreo por denominación (mes o día).
 *
 * @returns Página de control de efectivo.
 */
export function CashControlPage() {
  const [month, setMonth] = useState(() => currentMonthYm());
  const [day, setDay] = useState(() => clampIsoToMonth(todayIso(), currentMonthYm()));
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("mes");
  const [modalOpen, setModalOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const queryDay = monitorMode === "dia" ? day : null;
  const summaryQuery = useQuery({
    queryKey: ["cashflow", "control", month, queryDay],
    queryFn: () => fetchCashControlSummary(month, queryDay),
  });

  const summary = summaryQuery.data;
  const periodLabel = `${formatDate(monthStartIso(`${month}-01`))} – ${formatDate(monthEndIso(`${month}-01`))}`;
  const isCurrentMonth = month === currentMonthYm();
  const dayCup = summary?.dayCup;
  const dayUsd = summary?.dayUsd;

  const cupGap = useMemo(() => {
    if (!summary || !isCurrentMonth) {
      return 0;
    }
    return Math.abs(summary.cup.estimatedTotal - summary.cup.ledgerBalance);
  }, [summary, isCurrentMonth]);

  const usdGap = useMemo(() => {
    if (!summary || !isCurrentMonth) {
      return 0;
    }
    return Math.abs(summary.usd.estimatedTotal - summary.usd.ledgerBalance);
  }, [summary, isCurrentMonth]);

  const showsGapWarning =
    monitorMode === "mes" &&
    Boolean(summary?.cup.hasOpening) &&
    (cupGap > LEDGER_GAP_EPS || usdGap > LEDGER_GAP_EPS);

  /**
   * Cambia el mes y mantiene el día dentro de ese mes.
   *
   * @param nextMonth - Mes `YYYY-MM`.
   */
  const handleMonthChange = (nextMonth: string) => {
    if (!/^\d{4}-\d{2}$/.test(nextMonth)) {
      return;
    }
    setMonth(nextMonth);
    setDay((current) => clampIsoToMonth(current, nextMonth));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Banknote className="h-6 w-6" /> Control de efectivo
          </h1>
          <p className="text-sm text-base-content/70">
            Conteo físico por denominación del sistema. Periodo {periodLabel}
            {monitorMode === "dia" ? ` · Día ${formatDate(day)}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="form-control">
            <span className="sr-only">Mes</span>
            <input
              type="month"
              className="input input-bordered input-sm"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={() => setModalOpen(true)}>
            <ClipboardList className="h-4 w-4" />
            {summary?.cup.hasOpening ? "Editar saldo inicial" : "Registrar saldo inicial"}
          </button>
          <Link to="/caja" className="btn btn-ghost btn-sm gap-1">
            <ArrowLeft className="h-4 w-4" /> Flujo de caja
          </Link>
        </div>
      </div>

      {savedNotice ? (
        <div className="alert alert-success text-sm">
          <span>Saldo inicial del mes guardado.</span>
        </div>
      ) : null}

      {summaryQuery.isError ? (
        <div className="alert alert-error">
          <span>
            {summaryQuery.error instanceof Error
              ? summaryQuery.error.message
              : "No se pudo cargar el control de efectivo."}
          </span>
        </div>
      ) : null}

      {summaryQuery.isLoading ? (
        <p className="text-sm text-base-content/60">Cargando control de efectivo…</p>
      ) : null}

      {summary ? (
        <>
          {summary.openingUpdatedAt ? (
            <p className="text-xs text-base-content/60">
              Última actualización del saldo inicial: {formatDateTime(summary.openingUpdatedAt)}
              {summary.notes ? ` · ${summary.notes}` : ""}
            </p>
          ) : (
            <div className="alert alert-warning text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Todavía no hay un saldo inicial registrado para este mes. Cuenta los billetes al
                empezar el periodo para poder estimar el efectivo restante.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-base-300 bg-base-100 p-4">
              <p className="text-xs uppercase text-base-content/60">
                {moneyHeading(monitorMode === "dia" ? "Estimado al cierre" : "Estimado físico", "CUP")}
              </p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatAmount(
                  monitorMode === "dia" ? (dayCup?.estimatedTotal ?? 0) : summary.cup.estimatedTotal,
                )}
              </p>
              {monitorMode === "dia" && dayCup ? (
                <p className="mt-1 text-xs text-base-content/50">
                  Entradas {formatAmount(dayCup.inTotal)} · Salidas {formatAmount(dayCup.outTotal)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-base-content/50">
                  Libro (todos los métodos): {formatAmount(summary.cup.ledgerBalance)}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-base-300 bg-base-100 p-4">
              <p className="text-xs uppercase text-base-content/60">
                {moneyHeading(monitorMode === "dia" ? "Estimado al cierre" : "Estimado físico", "USD")}
              </p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatAmount(
                  monitorMode === "dia" ? (dayUsd?.estimatedTotal ?? 0) : summary.usd.estimatedTotal,
                )}
              </p>
              {monitorMode === "dia" && dayUsd ? (
                <p className="mt-1 text-xs text-base-content/50">
                  Entradas {formatAmount(dayUsd.inTotal)} · Salidas {formatAmount(dayUsd.outTotal)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-base-content/50">
                  Libro (todos los métodos): {formatAmount(summary.usd.ledgerBalance)}
                </p>
              )}
            </div>
          </div>

          {showsGapWarning ? (
            <div className="alert text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                El estimado de billetes puede diferir del saldo en libro: las transferencias y los
                movimientos en efectivo sin desglose no aparecen en el conteo por denominación.
              </span>
            </div>
          ) : null}

          <div>
            <h2 className="mb-3 text-lg font-semibold">Saldo inicial del mes</h2>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CashOpeningTable data={summary.cup} />
              <CashOpeningTable data={summary.usd} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Monitoreo</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="join">
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${monitorMode === "mes" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setMonitorMode("mes")}
                  >
                    Mes
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${monitorMode === "dia" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setMonitorMode("dia")}
                  >
                    Día
                  </button>
                </div>
                {monitorMode === "dia" ? (
                  <label className="form-control">
                    <span className="sr-only">Día</span>
                    <input
                      type="date"
                      className="input input-bordered input-sm"
                      value={day}
                      min={monthStartIso(`${month}-01`)}
                      max={monthEndIso(`${month}-01`)}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (/^\d{4}-\d{2}-\d{2}$/.test(next)) {
                          setDay(clampIsoToMonth(next, month));
                        }
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {monitorMode === "mes" ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <CashMonitorTable data={summary.cup} scope="mes" />
                <CashMonitorTable data={summary.usd} scope="mes" />
              </div>
            ) : dayCup && dayUsd ? (
              <>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <CashMonitorTable data={dayCup} scope="dia" />
                  <CashMonitorTable data={dayUsd} scope="dia" />
                </div>
                <CashDailyTable days={summary.days} selectedDay={day} onSelectDay={setDay} />
              </>
            ) : (
              <p className="text-sm text-base-content/60">Cargando movimiento del día…</p>
            )}
          </div>
        </>
      ) : null}

      {modalOpen ? (
        <CashOpeningModal
          month={month}
          summary={summary}
          onClose={() => setModalOpen(false)}
          onSaved={() => setSavedNotice(true)}
        />
      ) : null}
    </section>
  );
}
