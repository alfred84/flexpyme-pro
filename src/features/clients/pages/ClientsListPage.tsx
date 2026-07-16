import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { RestoreClientsModal } from "@/features/clients/components/RestoreClientsModal";
import { fetchClients, fetchDeletedClients } from "@/db/queries/clients";
import type { ClientDto } from "@/types/client";
import { formatMoney } from "@/lib/format-money";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";

function useClientColumns(): ColumnDef<ClientDto>[] {
  return useMemo(
    () => [
      { accessorKey: "code", header: "Código", cell: (info) => info.getValue<string>() },
      { accessorKey: "name", header: "Cliente", cell: (info) => info.getValue<string>() },
      {
        accessorKey: "phone",
        header: "Teléfono",
        cell: (info) => info.getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: (info) => formatMoney(info.getValue<number>()),
      },
      {
        accessorKey: "totalHistorical",
        header: "Total histórico",
        cell: (info) => <span className="tabular-nums">{formatMoney(info.getValue<number>())}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Link className="btn btn-xs btn-outline" to="/clientes/$clientId" params={{ clientId: String(row.original.id) }}>
              Ver
            </Link>
            <Link
              className="btn btn-xs btn-ghost"
              to="/clientes/$clientId/editar"
              params={{ clientId: String(row.original.id) }}
            >
              Editar
            </Link>
          </div>
        ),
      },
    ],
    [],
  );
}

/**
 * Lists all active clients with search and navigation to detail routes.
 *
 * @returns Clients table page.
 */
export function ClientsListPage() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const columns = useClientColumns();
  const clientsQuery = useQuery({
    queryKey: ["clients", "list"],
    queryFn: fetchClients,
  });
  const deletedQuery = useQuery({
    queryKey: ["clients", "deleted"],
    queryFn: fetchDeletedClients,
  });

  const hasDeletedClients = (deletedQuery.data?.length ?? 0) > 0;

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is intentionally imperative
  const table = useReactTable({
    data: clientsQuery.data ?? [],
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex flex-wrap items-center gap-2">
          {hasDeletedClients && (
            <button
              type="button"
              className="btn btn-outline btn-sm sm:btn-md gap-1"
              onClick={() => setShowRestoreModal(true)}
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar clientes
              <span className="badge badge-sm badge-ghost">{deletedQuery.data?.length}</span>
            </button>
          )}
          <Link to="/clientes/nuevo" className="btn btn-primary btn-sm sm:btn-md">
            Nuevo cliente
          </Link>
        </div>
      </div>

      {clientsQuery.isLoading && <p>Cargando clientes...</p>}
      {clientsQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los clientes. Comprueba la base de datos.</span>
        </div>
      )}
      {flash && (
        <div className={flash.kind === "success" ? "alert alert-success" : "alert alert-info"}>
          <span>{flash.text}</span>
        </div>
      )}

      {clientsQuery.data && (
        <>
          <input
            type="search"
            className="input input-bordered w-full max-w-md"
            placeholder="Buscar por código, nombre o teléfono..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            aria-label="Filtrar clientes"
          />

          <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
            <table className="table table-zebra table-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:underline"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: "↑",
                              desc: "↓",
                            }[header.column.getIsSorted() as string] ?? "↕"}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center text-base-content/60">
                      No hay resultados.
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

      {showRestoreModal && <RestoreClientsModal onClose={() => setShowRestoreModal(false)} />}
    </section>
  );
}
