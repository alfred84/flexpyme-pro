import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { fetchPrices, updatePrice } from "@/db/queries/prices";
import { formatMoney } from "@/lib/format-money";
import type { PriceRowDto } from "@/types/price";

function formatCell(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return formatMoney(value);
}

/**
 * Price list management: browse rows, filter, and edit price/cost/active in a modal.
 *
 * @returns Prices administration page.
 */
export function PricesListPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<PriceRowDto | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const pricesQuery = useQuery({
    queryKey: ["prices", "list", includeInactive],
    queryFn: () => fetchPrices(includeInactive),
  });

  const updateMutation = useMutation({
    mutationFn: updatePrice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
      setEditing(null);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    },
  });

  const openEdit = useCallback((row: PriceRowDto) => {
    setEditing(row);
    setEditPrice(String(row.price));
    setEditCost(row.cost === null || row.cost === undefined ? "" : String(row.cost));
    setEditActive(row.isActive);
    setFormError(null);
  }, []);

  const columns = useMemo<ColumnDef<PriceRowDto>[]>(
    () => [
      { accessorKey: "categoryName", header: "Categoría" },
      {
        accessorKey: "formatLabel",
        header: "Formato",
        cell: (info) => info.getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "service",
        header: "Servicio",
        cell: (info) => info.getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "finish",
        header: "Acabado",
        cell: (info) => info.getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "price",
        header: "Precio",
        cell: (info) => formatCell(info.getValue<number>()),
      },
      {
        accessorKey: "cost",
        header: "Costo",
        cell: (info) => formatCell(info.getValue<number | null>()),
      },
      {
        accessorKey: "isActive",
        header: "Activo",
        cell: (info) => (info.getValue<boolean>() ? "Sí" : "No"),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button type="button" className="btn btn-xs btn-outline" onClick={() => openEdit(row.original)}>
            Editar
          </button>
        ),
      },
    ],
    [openEdit],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is intentionally imperative
  const table = useReactTable({
    data: pricesQuery.data ?? [],
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  const handleSaveEdit = () => {
    if (!editing) {
      return;
    }
    const price = Number.parseFloat(editPrice.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      setFormError("Introduce un precio válido mayor que cero.");
      return;
    }
    let cost: number | null = null;
    const costTrim = editCost.trim();
    if (costTrim !== "") {
      const c = Number.parseFloat(costTrim.replace(",", "."));
      if (!Number.isFinite(c) || c < 0) {
        setFormError("Introduce un costo válido o déjalo vacío.");
        return;
      }
      cost = c;
      if (c > price) {
        setFormError("El costo no puede ser mayor que el precio.");
        return;
      }
    }
    setFormError(null);
    void updateMutation.mutateAsync({
      id: editing.id,
      price,
      cost,
      isActive: editActive,
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lista de precios</h1>
          <p className="text-sm text-base-content/70">Precios de venta y costos internos por categoría y formato.</p>
        </div>
        <label className="label cursor-pointer justify-start gap-3 sm:justify-end">
          <span className="label-text">Mostrar inactivos</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
        </label>
      </div>

      {pricesQuery.isLoading && <p>Cargando precios...</p>}
      {pricesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los precios.</span>
        </div>
      )}

      {pricesQuery.data && (
        <>
          <input
            type="search"
            className="input input-bordered w-full max-w-md"
            placeholder="Buscar en la tabla..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            aria-label="Filtrar precios"
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
                      No hay filas.
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

      {editing && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-lg font-bold">Editar precio</h3>
            <p className="py-1 text-sm text-base-content/70">
              {editing.categoryName}
              {editing.formatLabel ? ` · ${editing.formatLabel}` : ""}
              {editing.service ? ` · ${editing.service}` : ""}
              {editing.finish ? ` · ${editing.finish}` : ""}
            </p>
            <div className="form-control py-2">
              <label className="label" htmlFor="edit-price">
                <span className="label-text">Precio de venta</span>
              </label>
              <input
                id="edit-price"
                type="text"
                inputMode="decimal"
                className="input input-bordered"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            <div className="form-control py-2">
              <label className="label" htmlFor="edit-cost">
                <span className="label-text">Costo (opcional)</span>
              </label>
              <input
                id="edit-cost"
                type="text"
                inputMode="decimal"
                className="input input-bordered"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                placeholder="Vacío = sin costo"
              />
            </div>
            <label className="label cursor-pointer justify-start gap-3 py-2">
              <span className="label-text">Activo</span>
              <input type="checkbox" className="toggle toggle-primary" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
            </label>
            {formError && <p className="text-error text-sm">{formError}</p>}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cerrar
              </button>
              <button type="button" className="btn btn-primary" disabled={updateMutation.isPending} onClick={handleSaveEdit}>
                {updateMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar"}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={() => setEditing(null)} />
        </dialog>
      )}
    </section>
  );
}
