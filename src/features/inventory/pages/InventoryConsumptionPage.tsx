import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, PackageSearch } from "lucide-react";
import { fetchInventoryConsumptionSummary } from "@/db/queries/inventory";
import {
  formatConsumptionQty,
  groupConsumptionByCategory,
  type InventoryConsumptionTotals,
} from "@/features/inventory/lib/consumption-summary";
import type { InventoryConsumptionPeriod, InventoryConsumptionRowDto } from "@/types/inventory";

const PERIOD_OPTIONS: { id: InventoryConsumptionPeriod; label: string }[] = [
  { id: "hoy", label: "Día actual" },
  { id: "mes", label: "Mes actual" },
  { id: "todos", label: "Total" },
];

const EPS = 1e-9;

/**
 * Cabecera de columna numérica en dos líneas para la tabla ancha.
 */
interface QtyHeaderProps {
  top: string;
  bottom: string;
  hint: string;
}

/**
 * Encabezado compacto de columna cuantitativa.
 *
 * @param props - Texto, subtítulo y tooltip.
 * @returns Celda `th` alineada a la derecha.
 */
function QtyHeader(props: QtyHeaderProps) {
  return (
    <th className="text-right whitespace-nowrap" title={props.hint}>
      <span className="block leading-tight">{props.top}</span>
      <span className="block text-[10px] font-normal text-base-content/60 leading-tight">
        {props.bottom}
      </span>
    </th>
  );
}

/**
 * Celda numérica; destaca déficit y mermas.
 *
 * @param props - Valor, énfasis opcional y unidad en title.
 * @returns Celda de tabla.
 */
function QtyCell(props: {
  value: number;
  unit: string;
  tone?: "warning" | "error" | "success" | "muted";
}) {
  const { value, unit, tone } = props;
  const className =
    tone === "error"
      ? "text-right font-semibold text-error"
      : tone === "warning"
        ? "text-right text-warning"
        : tone === "success"
          ? "text-right text-success"
          : tone === "muted"
            ? "text-right text-base-content/50"
            : "text-right";
  return (
    <td className={className} title={`${formatConsumptionQty(value)} ${unit}`}>
      {formatConsumptionQty(value)}
    </td>
  );
}

/**
 * Fila de totales de un tipo de material.
 *
 * @param props - Totales del grupo.
 * @returns Fila `tr` de pie.
 */
function TotalsRow(props: { totals: InventoryConsumptionTotals }) {
  const { totals } = props;
  return (
    <tr className="font-semibold bg-base-200/80">
      <td>Total</td>
      <QtyCell value={totals.existenciaInicial} unit="" />
      <QtyCell value={totals.entradas} unit="" tone="success" />
      <QtyCell value={totals.salidas} unit="" />
      <QtyCell value={totals.solicitados} unit="" />
      <QtyCell value={totals.mermas} unit="" tone="warning" />
      <QtyCell value={totals.ventas} unit="" />
      <QtyCell value={totals.existenciaFinal} unit="" />
      <QtyCell value={totals.demanda} unit="" />
      <QtyCell value={totals.deficit} unit="" tone={totals.deficit > EPS ? "error" : undefined} />
      <QtyCell value={totals.disponible} unit="" />
    </tr>
  );
}

/**
 * Tabla de consumo de un tipo de material (p. ej. Marcos).
 *
 * @param props - Filas y totales del grupo.
 * @returns Tabla con columnas de kardex y demanda.
 */
function ConsumptionTable(props: {
  rows: InventoryConsumptionRowDto[];
  totals: InventoryConsumptionTotals;
}) {
  const { rows, totals } = props;
  return (
    <div className="overflow-x-auto rounded-lg border border-base-300">
      <table className="table table-sm table-pin-cols">
        <thead>
          <tr>
            <th className="min-w-[9rem]">Formato</th>
            <QtyHeader
              top="Existencia"
              bottom="inicial"
              hint="Stock al inicio del periodo (reconstruido desde el stock actual y los movimientos)"
            />
            <QtyHeader top="Entradas" bottom="periodo" hint="Compras y demás entradas del periodo" />
            <QtyHeader
              top="Salidas"
              bottom="periodo"
              hint="Todas las salidas del periodo (producción, merma, venta y manuales)"
            />
            <QtyHeader
              top="Solicitados"
              bottom="pedidos"
              hint="Material asignado a pedidos con fecha en el periodo"
            />
            <QtyHeader top="Mermas" bottom="periodo" hint="Salidas clasificadas como merma" />
            <QtyHeader top="Ventas" bottom="periodo" hint="Salidas por venta de material" />
            <QtyHeader top="Existencia" bottom="final" hint="Stock actual (cierre del periodo a hoy)" />
            <QtyHeader
              top="Demanda"
              bottom="pendiente"
              hint="Material aún pendiente de pedidos del periodo (líneas no Listo)"
            />
            <QtyHeader
              top="Déficit"
              bottom="periodo"
              hint="Demanda que no cubre la existencia final de este formato"
            />
            <QtyHeader
              top="Disponible"
              bottom="neto"
              hint="Existencia final menos demanda (no se cruza entre formatos)"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className={row.deficit > EPS ? "bg-error/10" : undefined}>
              <td className="whitespace-nowrap">
                <Link
                  to="/inventario/$itemId"
                  params={{ itemId: String(row.itemId) }}
                  className="link link-hover font-medium"
                >
                  {row.formato}
                </Link>
                {row.unit ? (
                  <span className="ml-1 text-[10px] text-base-content/50">{row.unit}</span>
                ) : null}
              </td>
              <QtyCell value={row.existenciaInicial} unit={row.unit} />
              <QtyCell
                value={row.entradas}
                unit={row.unit}
                tone={row.entradas > EPS ? "success" : "muted"}
              />
              <QtyCell value={row.salidas} unit={row.unit} tone={row.salidas > EPS ? undefined : "muted"} />
              <QtyCell
                value={row.solicitados}
                unit={row.unit}
                tone={row.solicitados > EPS ? undefined : "muted"}
              />
              <QtyCell
                value={row.mermas}
                unit={row.unit}
                tone={row.mermas > EPS ? "warning" : "muted"}
              />
              <QtyCell
                value={row.ventas}
                unit={row.unit}
                tone={row.ventas > EPS ? "success" : "muted"}
              />
              <QtyCell value={row.existenciaFinal} unit={row.unit} />
              <QtyCell
                value={row.demanda}
                unit={row.unit}
                tone={row.demanda > EPS ? undefined : "muted"}
              />
              <QtyCell
                value={row.deficit}
                unit={row.unit}
                tone={row.deficit > EPS ? "error" : "muted"}
              />
              <QtyCell
                value={row.disponible}
                unit={row.unit}
                tone={row.disponible > EPS ? undefined : "muted"}
              />
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={11} className="py-6 text-center text-base-content/60">
                No hay materiales en este tipo.
              </td>
            </tr>
          ) : (
            <TotalsRow totals={totals} />
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Vista de resumen de consumo de materiales agrupada por tipo (categoría).
 * Periodos: día actual, mes en curso o total histórico.
 *
 * @returns Página de resumen de inventario.
 */
export function InventoryConsumptionPage() {
  const [period, setPeriod] = useState<InventoryConsumptionPeriod>("mes");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");

  const summaryQuery = useQuery({
    queryKey: ["inventory", "consumption-summary", period],
    queryFn: () => fetchInventoryConsumptionSummary(period),
  });

  const groups = useMemo(
    () => groupConsumptionByCategory(summaryQuery.data ?? []),
    [summaryQuery.data],
  );

  const visibleGroups = useMemo(() => {
    if (categoryFilter === "todas") {
      return groups;
    }
    return groups.filter((g) =>
      g.materialCategoryId == null
        ? categoryFilter === "none"
        : String(g.materialCategoryId) === categoryFilter,
    );
  }, [groups, categoryFilter]);

  const global = useMemo(() => {
    let deficitItems = 0;
    let mermas = 0;
    let ventas = 0;
    let entradas = 0;
    for (const row of summaryQuery.data ?? []) {
      if (row.deficit > EPS) {
        deficitItems += 1;
      }
      mermas += row.mermas;
      ventas += row.ventas;
      entradas += row.entradas;
    }
    return { deficitItems, mermas, ventas, entradas };
  }, [summaryQuery.data]);

  const periodLabel =
    PERIOD_OPTIONS.find((opt) => opt.id === period)?.label.toLowerCase() ?? "periodo";

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <Link to="/inventario" className="btn btn-ghost btn-sm gap-2 px-0">
            <ArrowLeft className="h-4 w-4" />
            Inventario
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PackageSearch className="h-6 w-6" /> Resumen de consumo
          </h1>
          <p className="max-w-3xl text-sm text-base-content/70">
            Kardex por tipo de material. La existencia inicial se reconstruye con el stock actual y
            los movimientos del {periodLabel}. Solicitados y demanda usan pedidos con fecha en ese
            mismo periodo. El déficit no se compensa entre formatos.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="form-control">
            <span className="label-text text-xs">Tipo de material</span>
            <select
              className="select select-bordered select-sm min-w-[10rem]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="todas">Todos</option>
              {groups.map((g) => (
                <option
                  key={g.materialCategoryId ?? "none"}
                  value={g.materialCategoryId == null ? "none" : String(g.materialCategoryId)}
                >
                  {g.materialCategoryName}
                </option>
              ))}
            </select>
          </label>
          <div className="join" role="group" aria-label="Periodo del resumen">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`btn btn-sm join-item ${period === opt.id ? "btn-primary" : "btn-ghost"}`}
                aria-pressed={period === opt.id}
                onClick={() => setPeriod(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">Entradas</p>
          <p className="text-lg font-semibold text-success">{formatConsumptionQty(global.entradas)}</p>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">Mermas</p>
          <p className="text-lg font-semibold text-warning">{formatConsumptionQty(global.mermas)}</p>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">Ventas</p>
          <p className="text-lg font-semibold">{formatConsumptionQty(global.ventas)}</p>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">Ítems con déficit</p>
          <p className={`text-lg font-semibold ${global.deficitItems > 0 ? "text-error" : ""}`}>
            {global.deficitItems}
          </p>
        </div>
      </div>

      {summaryQuery.isLoading && (
        <div className="h-40 animate-pulse rounded-lg bg-base-200" />
      )}
      {summaryQuery.isError && (
        <div className="alert alert-error">
          <AlertTriangle className="h-5 w-5" />
          <span>No se pudo cargar el resumen de consumo.</span>
        </div>
      )}

      {summaryQuery.isSuccess && visibleGroups.length === 0 && (
        <p className="py-10 text-center text-sm text-base-content/60">
          No hay materiales para mostrar en este filtro.
        </p>
      )}

      <div className="space-y-4">
        {visibleGroups.map((group) => (
          <article
            key={group.materialCategoryId ?? "none"}
            className="rounded-xl border border-base-300 bg-base-100 shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200 px-4 py-3">
              <h2 className="text-base font-semibold">{group.materialCategoryName}</h2>
              <div className="flex flex-wrap gap-3 text-xs text-base-content/70">
                <span>
                  {group.rows.length} formato{group.rows.length === 1 ? "" : "s"}
                </span>
                <span>
                  Stock: <b>{formatConsumptionQty(group.totals.existenciaFinal)}</b>
                </span>
                <span>
                  Demanda: <b>{formatConsumptionQty(group.totals.demanda)}</b>
                </span>
                {group.totals.deficit > EPS ? (
                  <span className="text-error">
                    Déficit: <b>{formatConsumptionQty(group.totals.deficit)}</b>
                  </span>
                ) : null}
              </div>
            </header>
            <div className="p-3">
              <ConsumptionTable rows={group.rows} totals={group.totals} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
