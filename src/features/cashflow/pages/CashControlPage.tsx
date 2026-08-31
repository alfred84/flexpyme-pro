import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Banknote, ClipboardList } from "lucide-react";
import { fetchCashControlSummary } from "@/db/queries/cashflow";
import { CashDayNavigator } from "@/features/cashflow/components/CashDayNavigator";
import { CashMonitorTable } from "@/features/cashflow/components/CashMonitorTable";
import { CashOpeningModal } from "@/features/cashflow/components/CashOpeningModal";
import { CashOpeningTable } from "@/features/cashflow/components/CashOpeningTable";
import { CashScopeKpis } from "@/features/cashflow/components/CashScopeKpis";
import {
  clampIsoToMonth,
  currentMonthYm,
  formatDate,
  formatDateTime,
  monthEndIso,
  monthStartIso,
  todayIso,
} from "@/lib/format-date";
import type { DenominationCurrency } from "@/types/cashier";

const LEDGER_GAP_EPS = 1;

type MonitorMode = "mes" | "dia";

/**
 * Control de efectivo: saldo inicial y monitoreo por mes o por día, CUP y USD.
 *
 * @returns Página de control de efectivo.
 */
export function CashControlPage() {
  const [month, setMonth] = useState(() => currentMonthYm());
  const [day, setDay] = useState(() => clampIsoToMonth(todayIso(), currentMonthYm()));
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("mes");
  const [currency, setCurrency] = useState<DenominationCurrency>("CUP");
  const [modalOpen, setModalOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["cashflow", "control", month, day],
    queryFn: () => fetchCashControlSummary(month, day),
  });

  const summary = summaryQuery.data;
  const isDay = monitorMode === "dia";
  const periodLabel = isDay
    ? formatDate(day)
    : `${formatDate(monthStartIso(`${month}-01`))} – ${formatDate(monthEndIso(`${month}-01`))}`;
  const isCurrentMonth = month === currentMonthYm();
  const dayCup = summary?.dayCup;
  const dayUsd = summary?.dayUsd;
  const cup = isDay ? dayCup ?? summary?.cup : summary?.cup;
  const usd = isDay ? dayUsd ?? summary?.usd : summary?.usd;
  const active = currency === "USD" ? usd : cup;
  const hasOpening = Boolean(cup?.hasOpening);
  const openingStamp = isDay ? summary?.dayOpeningUpdatedAt : summary?.openingUpdatedAt;
  const openingNotes = isDay ? summary?.dayNotes : summary?.notes;

  const showsGapWarning = useMemo(() => {
    if (!summary || isDay || !isCurrentMonth || !summary.cup.hasOpening) {
      return false;
    }
    const cupGap = Math.abs(summary.cup.estimatedTotal - summary.cup.ledgerBalance);
    const usdGap = Math.abs(summary.usd.estimatedTotal - summary.usd.ledgerBalance);
    return cupGap > LEDGER_GAP_EPS || usdGap > LEDGER_GAP_EPS;
  }, [summary, isDay, isCurrentMonth]);

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

  /**
   * Cambia el día y sincroniza el mes.
   *
   * @param nextDay - Día `YYYY-MM-DD`.
   */
  const handleDayChange = (nextDay: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDay)) {
      return;
    }
    const nextMonth = nextDay.slice(0, 7);
    setMonth(nextMonth);
    setDay(clampIsoToMonth(nextDay, nextMonth));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Banknote className="h-6 w-6" /> Control de efectivo
          </h1>
          <p className="text-sm text-base-content/70">
            {isDay ? "Control del día" : "Control del mes"} · {periodLabel}
          </p>
        </div>
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
          {isDay ? (
            <input
              type="date"
              className="input input-bordered input-sm"
              value={day}
              onChange={(e) => handleDayChange(e.target.value)}
              aria-label="Día"
            />
          ) : (
            <input
              type="month"
              className="input input-bordered input-sm"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              aria-label="Mes"
            />
          )}
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={() => setModalOpen(true)}>
            <ClipboardList className="h-4 w-4" />
            {hasOpening ? "Editar saldo inicial" : "Registrar saldo inicial"}
          </button>
          <Link to="/caja" className="btn btn-ghost btn-sm gap-1">
            <ArrowLeft className="h-4 w-4" /> Caja
          </Link>
        </div>
      </div>

      {savedNotice ? (
        <div className="alert alert-success py-2 text-sm">
          <span>{savedNotice}</span>
        </div>
      ) : null}

      {summaryQuery.isError ? (
        <div className="alert alert-error py-2 text-sm">
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

      {summary && cup && usd ? (
        <>
          {isDay ? (
            <CashDayNavigator
              month={month}
              selectedDay={day}
              days={summary.days}
              onSelectDay={handleDayChange}
            />
          ) : null}

          <CashScopeKpis cup={cup} usd={usd} scope={monitorMode} />

          {!hasOpening ? (
            <p className="text-sm text-warning">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              {isDay
                ? "Este día no tiene saldo inicial registrado. El inicial se estima desde el mes. "
                : "Este mes no tiene saldo inicial registrado. "}
              <button type="button" className="link link-hover font-medium" onClick={() => setModalOpen(true)}>
                Registrar conteo
              </button>
            </p>
          ) : openingStamp ? (
            <p className="text-xs text-base-content/50">
              Saldo inicial actualizado {formatDateTime(openingStamp)}
              {openingNotes ? ` · ${openingNotes}` : ""}
            </p>
          ) : null}

          {showsGapWarning ? (
            <p className="text-xs text-base-content/50">
              El estimado de billetes puede diferir del libro: las transferencias y el efectivo sin
              desglose no entran en este conteo.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Por denominación</h2>
            <div className="join">
              <button
                type="button"
                className={`btn btn-xs join-item ${currency === "CUP" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCurrency("CUP")}
              >
                CUP
              </button>
              <button
                type="button"
                className={`btn btn-xs join-item ${currency === "USD" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCurrency("USD")}
              >
                USD
              </button>
            </div>
          </div>

          {active ? <CashMonitorTable data={active} scope={monitorMode} /> : null}

          {active ? (
            <details className="rounded-lg border border-base-300 bg-base-100">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Desglose del saldo inicial ({currency})
              </summary>
              <div className="border-t border-base-300 p-2">
                <CashOpeningTable data={active} />
              </div>
            </details>
          ) : null}
        </>
      ) : null}

      {modalOpen ? (
        <CashOpeningModal
          scope={monitorMode}
          month={month}
          day={day}
          summary={summary}
          onClose={() => setModalOpen(false)}
          onSaved={() =>
            setSavedNotice(
              isDay ? "Saldo inicial del día guardado." : "Saldo inicial del mes guardado.",
            )
          }
        />
      ) : null}
    </section>
  );
}
