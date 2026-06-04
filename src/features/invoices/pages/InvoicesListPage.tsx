import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchInvoices } from "@/db/queries/invoices";
import { formatMoney } from "@/lib/format-money";
import type { InvoiceListDto } from "@/types/invoice";

function statusLabel(status: string): string {
  if (status === "paid") {
    return "Pagado";
  }
  if (status === "partial") {
    return "Parcial";
  }
  return "Pendiente";
}

/**
 * Lists invoices with quick filters and links to detail.
 *
 * @returns Invoices list page.
 */
export function InvoicesListPage() {
  const [globalFilter, setGlobalFilter] = useState("");
  const invoicesQuery = useQuery({
    queryKey: ["invoices", "list"],
    queryFn: fetchInvoices,
  });

  const columns = useMemo<ColumnDef<InvoiceListDto>[]>(
    () => [
      { accessorKey: "invoiceNumber", header: "Número" },
      { accessorKey: "clientName", header: "Cliente" },
      { accessorKey: "date", header: "Fecha" },
      {
        accessorKey: "total",
        header: "Total",
        cell: (info) => formatMoney(info.getValue<number>()),
      },
      {
        accessorKey: "balance",
        header: "Pendiente",
        cell: (info) => formatMoney(info.getValue<number>()),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (info) => statusLabel(info.getValue<string>()),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link className="btn btn-xs btn-outline" to="/pedidos/$invoiceId" params={{ invoiceId: String(row.original.id) }}>
            Ver
          </Link>
        ),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is intentionally imperative
  const table = useReactTable({
    data: invoicesQuery.data ?? [],
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Link to="/pedidos/nuevo" className="btn btn-primary btn-sm sm:btn-md">
          Nuevo pedido
        </Link>
      </div>

      {invoicesQuery.isLoading && <p>Cargando pedidos...</p>}
      {invoicesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los pedidos.</span>
        </div>
      )}

      {invoicesQuery.data && (
        <>
          <input
            type="search"
            className="input input-bordered w-full max-w-md"
            placeholder="Buscar número, cliente, fecha..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            aria-label="Filtrar pedidos"
          />
          <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
            <table className="table table-zebra table-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center text-base-content/60">
                      No hay pedidos.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
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
