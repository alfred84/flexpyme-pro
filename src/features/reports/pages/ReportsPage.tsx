import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchReportsSummary, fetchTopDebtors } from "@/db/queries/reports";

const money = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" });

export function ReportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["reports", "summary", dateFrom, dateTo],
    queryFn: () =>
      fetchReportsSummary({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      }),
  });

  const debtorsQuery = useQuery({
    queryKey: ["reports", "top-debtors"],
    queryFn: () => fetchTopDebtors(10),
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-base-content/70">Métricas de ventas/cobros y cuentas por cobrar.</p>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Filtro de fechas (facturas y producción)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text">Desde</span>
              <input type="date" className="input input-bordered" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text">Hasta</span>
              <input type="date" className="input input-bordered" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
        </div>
      </div>

      {summaryQuery.isLoading && <p>Cargando resumen...</p>}
      {summaryQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el resumen.</span>
        </div>
      )}
      {summaryQuery.data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Facturas</div>
            <div className="stat-value text-2xl">{summaryQuery.data.invoicesCount}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Total facturado</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.totalBilled)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Total cobrado</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.totalPaid)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Pendiente por cobrar</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.totalPending)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Costo producción</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.productionTotalCost)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Pagado producción</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.productionPaid)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow md:col-span-2">
            <div className="stat-title">Pendiente producción</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.productionPending)}</div>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Top clientes deudores</h2>
          {debtorsQuery.isLoading && <p className="text-sm">Cargando...</p>}
          {debtorsQuery.isError && <p className="text-error text-sm">No se pudo cargar la lista.</p>}
          {debtorsQuery.data && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {debtorsQuery.data.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-base-content/60">
                        No hay balances pendientes.
                      </td>
                    </tr>
                  ) : (
                    debtorsQuery.data.map((row) => (
                      <tr key={row.clientId}>
                        <td>{row.clientCode}</td>
                        <td>{row.clientName}</td>
                        <td className="text-right">{money.format(row.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
