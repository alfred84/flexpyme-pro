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
import {
  clientBalanceStatusBadgeClass,
  clientBalanceStatusLabel,
  formatClientBalanceDisplay,
  resolveDualClientBalanceStatus,
} from "@/features/clients/lib/client-balance";
import { fetchClients, fetchDeletedClients } from "@/db/queries/clients";
import { useAppSettings } from "@/hooks/use-app-settings";
import type { ClientDto } from "@/types/client";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";

/**
 * Columnas de la tabla de clientes (balances duales por cobro y estado neto).
 *
 * @param usdExchangeRate - Tasa USD→CUP vigente (solo para el estado).
 * @returns Definición de columnas para TanStack Table.
 */
function useClientColumns(usdExchangeRate: number): ColumnDef<ClientDto>[] {
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
        id: "balanceUsd",
        header: moneyHeading("Balance", "USD"),
        accessorFn: (row) => row.balanceUsd ?? 0,
        cell: ({ row }) => {
          const display = formatClientBalanceDisplay(row.original.balanceUsd ?? 0, 0);
          return (
            <span className={display.className} title={clientBalanceStatusLabel(display.status)}>
              {display.text}
            </span>
          );
        },
      },
      {
        id: "balanceCup",
        header: moneyHeading("Balance", "CUP"),
        accessorFn: (row) => (row.balanceCup ?? 0) - (row.creditBalance ?? 0),
        cell: ({ row }) => {
          const display = formatClientBalanceDisplay(
            row.original.balanceCup ?? 0,
            row.original.creditBalance ?? 0,
          );
          return (
            <span className={display.className} title={clientBalanceStatusLabel(display.status)}>
              {display.text}
            </span>
          );
        },
      },
      {
        id: "totalHistoricalUsd",
        header: moneyHeading("Total histórico", "USD"),
        accessorFn: (row) => row.totalHistoricalUsd ?? 0,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatAmount(row.original.totalHistoricalUsd ?? 0)}
          </span>
        ),
      },
      {
        id: "totalHistoricalCup",
        header: moneyHeading("Total histórico", "CUP"),
        accessorFn: (row) => row.totalHistoricalCup ?? 0,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatAmount(row.original.totalHistoricalCup ?? 0)}
          </span>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        accessorFn: (row) =>
          resolveDualClientBalanceStatus(
            row.balanceUsd ?? 0,
            row.balanceCup ?? 0,
            row.creditBalance ?? 0,
            usdExchangeRate,
          ),
        cell: ({ row }) => {
          const status = resolveDualClientBalanceStatus(
            row.original.balanceUsd ?? 0,
            row.original.balanceCup ?? 0,
            row.original.creditBalance ?? 0,
            usdExchangeRate,
          );
          return (
            <span className={clientBalanceStatusBadgeClass(status)}>
              {clientBalanceStatusLabel(status)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Link
              className="btn btn-xs btn-outline"
              to="/clientes/$clientId"
              params={{ clientId: String(row.original.id) }}
            >
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
    [usdExchangeRate],
  );
}

/**
 * Lista de clientes activos con búsqueda, balance dual y estado neto.
 *
 * @returns Página de tabla de clientes.
 */
export function ClientsListPage() {
  const { usdExchangeRate } = useAppSettings();
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const columns = useClientColumns(usdExchangeRate);
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
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-base-content/70">
            Balance USD y CUP según cobros de pedidos (no por conversión). El estado netea ambas
            monedas con la tasa vigente: saldo a favor en verde y deuda en rojo.
          </p>
        </div>
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
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
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
