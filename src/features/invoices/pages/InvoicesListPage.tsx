import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { PaymentStatusBadge, ProductionStatusBadge } from "@/components/invoices/InvoiceStatusBadges";
import {
  cancelInvoice,
  fetchInvoices,
  markInvoiceAllListo,
} from "@/db/queries/invoices";
import { todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import type { InvoiceListDto } from "@/types/invoice";

type ListFilter = "todos" | "en_produccion" | "listos" | "pendiente_cobro" | "cobrados" | "completados";

const VALID_FILTERS: ListFilter[] = [
  "todos",
  "en_produccion",
  "listos",
  "pendiente_cobro",
  "cobrados",
  "completados",
];

function parseFilter(value: string | undefined): ListFilter {
  if (value && VALID_FILTERS.includes(value as ListFilter)) {
    return value as ListFilter;
  }
  return "todos";
}

function matchesFilter(row: InvoiceListDto, filter: ListFilter): boolean {
  if (filter === "todos") return true;
  if (filter === "en_produccion") return row.productionStatus === "en_produccion";
  if (filter === "listos") return row.productionStatus === "listo";
  if (filter === "pendiente_cobro") return row.paymentStatus === "pendiente";
  if (filter === "cobrados") return row.paymentStatus === "cobrado";
  return row.productionStatus === "listo" && row.paymentStatus === "cobrado";
}

/**
 * Lista pedidos con badges de producción/cobro, filtros y acciones rápidas.
 *
 * @returns Página de listado de pedidos.
 */
export function InvoicesListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { filter: searchFilter } = useSearch({ from: "/pedidos" });
  const filter = parseFilter(searchFilter);
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<InvoiceListDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const invoicesQuery = useQuery({
    queryKey: ["invoices", "list"],
    queryFn: fetchInvoices,
  });

  const markReadyMutation = useMutation({
    mutationFn: (id: number) => markInvoiceAllListo(id, todayIso()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
      ]);
      pushFlashMessage({ kind: "success", text: "Pedido marcado como listo." });
    },
    onError: (e: Error) => {
      pushFlashMessage({ kind: "error", text: e.message });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!cancelTarget) {
        return Promise.reject(new Error("Pedido no seleccionado"));
      }
      return cancelInvoice(cancelTarget.id, cancelReason);
    },
    onSuccess: async () => {
      setCancelTarget(null);
      setCancelReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      pushFlashMessage({ kind: "success", text: "Pedido anulado." });
    },
  });

  const filteredData = useMemo(() => {
    const rows = invoicesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!q) return true;
      return (
        row.invoiceNumber.toLowerCase().includes(q) ||
        row.clientName.toLowerCase().includes(q) ||
        row.date.includes(q)
      );
    });
  }, [invoicesQuery.data, filter, search]);

  const columns = useMemo<ColumnDef<InvoiceListDto>[]>(
    () => [
      { accessorKey: "invoiceNumber", header: "Nº Pedido" },
      { accessorKey: "clientName", header: "Cliente" },
      {
        accessorKey: "total",
        header: "Total",
        cell: (info) => formatMoney(info.getValue<number>()),
      },
      {
        id: "production",
        header: "Producción",
        cell: ({ row }) => <ProductionStatusBadge status={row.original.productionStatus} />,
      },
      {
        id: "payment",
        header: "Cobro",
        cell: ({ row }) => <PaymentStatusBadge status={row.original.paymentStatus} />,
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex flex-wrap gap-1">
              {inv.productionStatus === "en_produccion" && (
                <button
                  type="button"
                  className="btn btn-xs btn-warning btn-outline"
                  disabled={markReadyMutation.isPending}
                  onClick={() => void markReadyMutation.mutateAsync(inv.id)}
                >
                  Marcar listo
                </button>
              )}
              {inv.paymentStatus === "pendiente" && inv.balance > 1e-6 && (
                <Link
                  className="btn btn-xs btn-primary"
                  to="/pedidos/$invoiceId/caja"
                  params={{ invoiceId: String(inv.id) }}
                >
                  Cobrar
                </Link>
              )}
              {inv.canEdit && (
                <Link
                  className="btn btn-xs btn-outline"
                  to="/pedidos/$invoiceId/editar"
                  params={{ invoiceId: String(inv.id) }}
                >
                  Editar
                </Link>
              )}
              {inv.canCancel && (
                <button
                  type="button"
                  className="btn btn-xs btn-error btn-outline"
                  onClick={() => {
                    setCancelReason("");
                    setCancelTarget(inv);
                  }}
                >
                  Anular
                </button>
              )}
              <Link
                className="btn btn-xs btn-ghost"
                to="/pedidos/$invoiceId"
                params={{ invoiceId: String(inv.id) }}
              >
                Ver
              </Link>
            </div>
          );
        },
      },
    ],
    [markReadyMutation.isPending],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const FILTERS: { key: ListFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "en_produccion", label: "En Producción" },
    { key: "listos", label: "Listos" },
    { key: "pendiente_cobro", label: "Pendiente Cobro" },
    { key: "cobrados", label: "Cobrados" },
    { key: "completados", label: "Completados" },
  ];

  const setListFilter = (next: ListFilter) => {
    void navigate({
      to: "/pedidos",
      search: next === "todos" ? { filter: undefined } : { filter: next },
    });
  };

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
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`btn btn-xs ${filter === f.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setListFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="input input-bordered w-full max-w-md"
            placeholder="Buscar número, cliente, fecha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filtrar pedidos"
          />
          <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
            <table className="table table-zebra table-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center text-base-content/60">
                      No hay pedidos con este filtro.
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

      {cancelTarget && (
        <ModalPortal>
          <dialog className="modal modal-open">
            <div className="modal-box">
              <h3 className="text-lg font-bold">Anular pedido {cancelTarget.invoiceNumber}</h3>
              <p className="py-2 text-sm text-base-content/70">
                Se revertirán los cobros en caja y las salidas de inventario asociadas. El motivo es
                obligatorio.
              </p>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo de anulación"
              />
              {cancelMutation.isError && (
                <p className="mt-2 text-sm text-error">
                  {(cancelMutation.error as Error).message}
                </p>
              )}
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setCancelTarget(null);
                    setCancelReason("");
                  }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn btn-error"
                  disabled={cancelMutation.isPending || !cancelReason.trim()}
                  onClick={() => void cancelMutation.mutateAsync()}
                >
                  {cancelMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Confirmar anulación"
                  )}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-backdrop bg-transparent"
              aria-label="Cerrar"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
              }}
            />
          </dialog>
        </ModalPortal>
      )}
    </section>
  );
}
