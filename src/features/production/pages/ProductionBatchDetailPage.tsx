import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchProductionBatchDetail } from "@/db/queries/production";
import { buildCsvLine, downloadTextFile } from "@/lib/csv";
import { formatDate } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";

const productionBatchRouteApi = getRouteApi("/produccion/$batchId");

function parseBatchIdFromPath(pathname: string): number | null {
  const m = /^\/produccion\/(\d+)\/?$/.exec(pathname);
  return m ? Number(m[1]) : null;
}

export function ProductionBatchDetailPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { batchId: batchIdParam } = productionBatchRouteApi.useParams({
    structuralSharing: false,
  });
  const batchId = useMemo(() => {
    const fromParams = Number(batchIdParam);
    if (Number.isFinite(fromParams) && fromParams > 0) {
      return fromParams;
    }
    return parseBatchIdFromPath(pathname) ?? Number.NaN;
  }, [batchIdParam, pathname]);
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());

  const detailQuery = useQuery({
    queryKey: ["production", "detail", batchId],
    queryFn: ({ queryKey }) => {
      const id = queryKey[2];
      if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
        throw new Error("ID de lote inválido");
      }
      return fetchProductionBatchDetail(id);
    },
    enabled: Number.isFinite(batchId) && batchId > 0,
    staleTime: 0,
    retry: 2,
    retryDelay: (attempt) => Math.min(250 * 2 ** attempt, 2000),
  });

  const exportLinesCsv = () => {
    const data = detailQuery.data;
    if (!data) return;
    const b = data.batch;
    const lines: string[] = [];
    lines.push(buildCsvLine(["Lote ID", b.id]));
    lines.push(buildCsvLine(["Tipo", b.type]));
    lines.push(buildCsvLine(["Fecha", b.date]));
    lines.push(buildCsvLine(["Operario", b.workerName ?? ""]));
    lines.push(buildCsvLine(["Notas", b.notes ?? ""]));
    lines.push(buildCsvLine(["Costo total", b.totalCost]));
    lines.push(buildCsvLine(["Pagado", b.paid]));
    lines.push(buildCsvLine(["Pendiente", b.pending]));
    lines.push("");
    lines.push(
      buildCsvLine([
        "Linea ID",
        "Cliente codigo",
        "Cliente nombre",
        "Formato",
        "Categoria",
        "Cantidad",
        "Costo unitario",
        "Subtotal",
      ]),
    );
    for (const row of data.items) {
      lines.push(
        buildCsvLine([
          row.id,
          row.clientCode,
          row.clientName,
          row.formatLabel ?? "",
          row.category,
          row.quantity,
          row.unitCost,
          row.subtotal,
        ]),
      );
    }
    downloadTextFile(`produccion-lote-${b.id}.csv`, lines.join("\r\n"));
  };

  if (!Number.isFinite(batchId) || batchId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de lote no válido.</span>
      </div>
    );
  }

  const b = detailQuery.data?.batch;
  const items = detailQuery.data?.items ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Lote de producción</h1>
          {b && <p className="text-sm text-base-content/70">#{b.id} · {b.type}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {b && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => exportLinesCsv()} disabled={detailQuery.isLoading}>
              Exportar CSV
            </button>
          )}
          <Link to="/produccion" className="btn btn-ghost btn-sm">
            Volver al listado
          </Link>
        </div>
      </div>

      {detailQuery.isLoading && <p>Cargando...</p>}
      {detailQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el lote.</span>
          <p className="mt-1 text-xs opacity-90">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : String(detailQuery.error ?? "")}
          </p>
        </div>
      )}
      {flash && (
        <div className={flash.kind === "success" ? "alert alert-success" : "alert alert-info"}>
          <span>{flash.text}</span>
        </div>
      )}

      {b && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title text-base">Encabezado</h2>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-base-content/60">Fecha</dt>
                    <dd>{formatDate(b.date)}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">Operario</dt>
                    <dd>{b.workerName ?? "—"}</dd>
                  </div>
                  {b.notes && (
                    <div>
                      <dt className="text-base-content/60">Notas</dt>
                      <dd className="whitespace-pre-wrap">{b.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title text-base">Importes</h2>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt>{moneyHeading("Costo total")}</dt>
                    <dd>{formatAmount(b.totalCost)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{moneyHeading("Pagado")}</dt>
                    <dd>{formatAmount(b.paid)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>{moneyHeading("Pendiente")}</dt>
                    <dd>{formatAmount(b.pending)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Formato</th>
                  <th>Categoría</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">{moneyHeading("C. unit.")}</th>
                  <th className="text-right">{moneyHeading("Subtotal")}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/60">
                      Sin líneas.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.clientCode} — {row.clientName}
                      </td>
                      <td>{row.formatLabel ?? "—"}</td>
                      <td>{row.category}</td>
                      <td className="text-right">{row.quantity}</td>
                      <td className="text-right">{formatAmount(row.unitCost)}</td>
                      <td className="text-right">{formatAmount(row.subtotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
