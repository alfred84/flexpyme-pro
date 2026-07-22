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
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  fetchAllCategoryFormats,
  fetchAllCategoryWorkTypes,
  fetchCategories,
  fetchCategoryFinishes,
} from "@/db/queries/categories";
import { createPrice, fetchFormats, fetchPrices, updatePrice } from "@/db/queries/prices";
import {
  buildPriceTableRows,
  type PriceTableRow,
} from "@/features/products/lib/price-table-rows";
import { categoryMosaicTone, resolveCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/format-money";
import { isSinFormatoLabel, SIN_FORMATO_LABEL } from "@/lib/formats";
import type { CategoryWorkTypeDto, ProductCategoryDto } from "@/types/category";

/**
 * Formatea un importe CUP o muestra guión si no hay valor.
 *
 * @param value - Importe o nulo.
 * @returns Texto formateado.
 */
function formatCell(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return formatMoney(value);
}

/**
 * Precios: mosaico por categoría → tipos de trabajo → tabla con precio y tarifa de pago.
 * La categoría activa vive en `?categoria=` para que el sidebar vuelva siempre al mosaico.
 *
 * @returns Pantalla de administración de precios.
 */
export function PricesListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/precios" });
  const { categoria: selectedCategoryId } = useSearch({ from: "/precios" });

  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<number | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<PriceTableRow | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editTarifa, setEditTarifa] = useState("0");
  const [editActive, setEditActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => fetchCategories(true),
  });

  const workTypesQuery = useQuery({
    queryKey: ["category-work-types", "all"],
    queryFn: fetchAllCategoryWorkTypes,
  });

  const categoryFormatsQuery = useQuery({
    queryKey: ["category-formats", "all"],
    queryFn: fetchAllCategoryFormats,
    enabled: selectedCategoryId != null,
  });

  const categoryFinishesQuery = useQuery({
    queryKey: ["category-finishes", "all"],
    queryFn: fetchCategoryFinishes,
    enabled: selectedCategoryId != null,
  });

  const formatsQuery = useQuery({
    queryKey: ["formats", "active"],
    queryFn: fetchFormats,
    enabled: selectedCategoryId != null,
  });

  const pricesQuery = useQuery({
    queryKey: ["prices", "list", includeInactive],
    queryFn: () => fetchPrices(includeInactive),
    enabled: selectedCategoryId != null,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: {
      draft: PriceTableRow;
      price: number;
      cost: number;
      isActive: boolean;
    }) => {
      if (input.draft.isDraft) {
        return createPrice({
          categoryId: input.draft.categoryId,
          formatId: input.draft.formatId,
          finish: input.draft.finish,
          service: input.draft.service ?? "",
          price: input.price,
          cost: input.cost,
          isActive: input.isActive,
        });
      }
      return updatePrice({
        id: input.draft.id,
        price: input.price,
        cost: input.cost,
        isActive: input.isActive,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prices"] }),
        queryClient.invalidateQueries({ queryKey: ["costs"] }),
      ]);
      setEditing(null);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    },
  });

  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => c.isActive),
    [categoriesQuery.data],
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const categoryWorkTypes = useMemo(() => {
    if (selectedCategoryId == null) {
      return [] as CategoryWorkTypeDto[];
    }
    return (workTypesQuery.data ?? []).filter(
      (wt) => wt.categoryId === selectedCategoryId && wt.workTypeActive,
    );
  }, [selectedCategoryId, workTypesQuery.data]);

  const selectedWorkType = useMemo(
    () => categoryWorkTypes.find((wt) => wt.workTypeId === selectedWorkTypeId) ?? null,
    [categoryWorkTypes, selectedWorkTypeId],
  );

  const sinFormato = useMemo(() => {
    const found = (formatsQuery.data ?? []).find((f) => isSinFormatoLabel(f.label));
    return found ? { id: found.id, label: found.label } : null;
  }, [formatsQuery.data]);

  useEffect(() => {
    if (categoryWorkTypes.length === 0) {
      setSelectedWorkTypeId(null);
      return;
    }
    setSelectedWorkTypeId((prev) => {
      if (prev != null && categoryWorkTypes.some((wt) => wt.workTypeId === prev)) {
        return prev;
      }
      return categoryWorkTypes[0]?.workTypeId ?? null;
    });
  }, [categoryWorkTypes]);

  const tableRows = useMemo(() => {
    if (!selectedCategory || !selectedWorkType) {
      return [] as PriceTableRow[];
    }
    return buildPriceTableRows({
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      workType: selectedWorkType,
      categoryFormats: categoryFormatsQuery.data ?? [],
      categoryFinishes: categoryFinishesQuery.data ?? [],
      prices: pricesQuery.data ?? [],
      sinFormato,
    });
  }, [
    selectedCategory,
    selectedWorkType,
    categoryFormatsQuery.data,
    categoryFinishesQuery.data,
    pricesQuery.data,
    sinFormato,
  ]);

  const openEdit = useCallback((row: PriceTableRow) => {
    setEditing(row);
    setEditPrice(String(row.price));
    setEditTarifa(row.cost === null || row.cost === undefined ? "0" : String(row.cost));
    setEditActive(row.isActive);
    setFormError(null);
  }, []);

  const columns = useMemo<ColumnDef<PriceTableRow>[]>(
    () => [
      {
        accessorKey: "formatLabel",
        header: "Formato",
        cell: (info) => info.getValue<string | null>() ?? SIN_FORMATO_LABEL,
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
        header: "Tarifa de Pago",
        cell: (info) => formatCell(info.getValue<number | null>() ?? 0),
      },
      {
        accessorKey: "isActive",
        header: "Activo",
        cell: ({ row }) =>
          row.original.isDraft ? (
            <span className="badge badge-ghost badge-sm">Pendiente</span>
          ) : row.original.isActive ? (
            "Sí"
          ) : (
            "No"
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button type="button" className="btn btn-xs btn-outline" onClick={() => openEdit(row.original)}>
            {row.original.isDraft ? "Definir" : "Editar"}
          </button>
        ),
      },
    ],
    [openEdit],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is intentionally imperative
  const table = useReactTable({
    data: tableRows,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  const handleSelectCategory = (category: ProductCategoryDto) => {
    setSelectedWorkTypeId(null);
    setGlobalFilter("");
    setSorting([]);
    void navigate({ search: { categoria: category.id } });
  };

  const handleBackToMosaic = () => {
    setSelectedWorkTypeId(null);
    setGlobalFilter("");
    setEditing(null);
    void navigate({ search: { categoria: undefined } });
  };

  const handleSaveEdit = () => {
    if (!editing) {
      return;
    }
    const price = Number.parseFloat(editPrice.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      setFormError("Introduce un precio válido mayor que cero.");
      return;
    }
    const tarifa = Number.parseFloat(editTarifa.replace(",", "."));
    if (!Number.isFinite(tarifa) || tarifa < 0) {
      setFormError("Introduce una tarifa de pago válida (0 o mayor).");
      return;
    }
    if (tarifa > price) {
      setFormError("La tarifa de pago no puede ser mayor que el precio.");
      return;
    }
    setFormError(null);
    void saveMutation.mutateAsync({
      draft: editing,
      price,
      cost: tarifa,
      isActive: editActive,
    });
  };

  if (selectedCategory == null) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Precios</h1>
          <p className="text-sm text-base-content/70">
            Elige una categoría para gestionar precios de venta y tarifas de pago a trabajadores.
          </p>
        </div>

        {categoriesQuery.isLoading && <p>Cargando categorías...</p>}
        {categoriesQuery.isError && (
          <div className="alert alert-error">
            <span>No se pudieron cargar las categorías.</span>
          </div>
        )}

        {categoriesQuery.data && categories.length === 0 && (
          <p className="text-sm text-base-content/60">No hay categorías activas.</p>
        )}

        {categories.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category, index) => {
              const Icon = resolveCategoryIcon(category.icon);
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border p-4 text-center transition ${categoryMosaicTone(index)}`}
                  onClick={() => handleSelectCategory(category)}
                >
                  <Icon className="h-8 w-8 opacity-90" aria-hidden />
                  <span className="text-sm font-semibold leading-tight">{category.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  const catalogLoading =
    pricesQuery.isLoading ||
    categoryFormatsQuery.isLoading ||
    categoryFinishesQuery.isLoading ||
    formatsQuery.isLoading;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <button type="button" className="btn btn-ghost btn-sm gap-2 px-0" onClick={handleBackToMosaic}>
            <ArrowLeft className="h-4 w-4" />
            Todas las categorías
          </button>
          <div>
            <h1 className="text-2xl font-bold">{selectedCategory.name}</h1>
            <p className="text-sm text-base-content/70">
              Precio de venta y tarifa de pago por formato según el tipo de trabajo. Las filas
              pendientes aparecen en 0 hasta que las definas.
            </p>
          </div>
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

      {workTypesQuery.isLoading && <p className="text-sm">Cargando tipos de trabajo...</p>}
      {workTypesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los tipos de trabajo.</span>
        </div>
      )}

      {!workTypesQuery.isLoading && categoryWorkTypes.length === 0 && (
        <div className="alert alert-warning">
          <span>
            Esta categoría no tiene tipos de trabajo asociados. Configúralos en Configuración →
            Categorías.
          </span>
        </div>
      )}

      {categoryWorkTypes.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipos de trabajo">
          {categoryWorkTypes.map((wt) => {
            const active = wt.workTypeId === selectedWorkTypeId;
            return (
              <button
                key={wt.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`btn btn-sm ${active ? "btn-primary" : "btn-outline"}`}
                onClick={() => {
                  setSelectedWorkTypeId(wt.workTypeId);
                  setGlobalFilter("");
                }}
              >
                {wt.workTypeName}
              </button>
            );
          })}
        </div>
      )}

      {selectedWorkType && (
        <>
          {catalogLoading && <p>Cargando precios...</p>}
          {(pricesQuery.isError ||
            categoryFormatsQuery.isError ||
            categoryFinishesQuery.isError ||
            formatsQuery.isError) && (
            <div className="alert alert-error">
              <span>No se pudieron cargar los precios o la configuración de la categoría.</span>
            </div>
          )}

          {!catalogLoading && pricesQuery.data && (
            <>
              <input
                type="search"
                className="input input-bordered w-full max-w-md"
                placeholder="Buscar formato o acabado..."
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
                          No hay precios para {selectedWorkType.workTypeName} en esta categoría.
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className={row.original.isDraft ? "opacity-80" : undefined}>
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
        </>
      )}

      {editing && (
        <ModalPortal>
          <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-lg font-bold">
              {editing.isDraft ? "Definir precio" : "Editar precio"}
            </h3>
            <p className="py-1 text-sm text-base-content/70">
              {selectedCategory.name}
              {selectedWorkType ? ` · ${selectedWorkType.workTypeName}` : ""}
              {` · ${editing.formatLabel ?? SIN_FORMATO_LABEL}`}
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
              <label className="label" htmlFor="edit-tarifa">
                <span className="label-text">Tarifa de Pago</span>
              </label>
              <input
                id="edit-tarifa"
                type="text"
                inputMode="decimal"
                className="input input-bordered"
                value={editTarifa}
                onChange={(e) => setEditTarifa(e.target.value)}
                required
              />
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  Importe unitario que se paga al trabajador (por defecto 0).
                </span>
              </label>
            </div>
            <label className="label cursor-pointer justify-start gap-3 py-2">
              <span className="label-text">Activo</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
            </label>
            {formError && <p className="text-error text-sm">{formError}</p>}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saveMutation.isPending}
                onClick={handleSaveEdit}
              >
                {saveMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar"}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop bg-transparent"
            aria-label="Cerrar"
            onClick={() => setEditing(null)}
          />
          </dialog>
        </ModalPortal>
      )}
    </section>
  );
}
