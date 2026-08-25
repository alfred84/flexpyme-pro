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
import { ArrowLeft, Plus, Settings2 } from "lucide-react";
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
import { CategoryConfigModal } from "@/features/settings/components/CategoryConfigModal";
import { CategoryFormModal } from "@/features/settings/components/CategoryFormModal";
import { useAppSettings } from "@/hooks/use-app-settings";
import { categoryMosaicTone, resolveCategoryIcon } from "@/lib/category-icons";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { isSinFormatoLabel, SIN_FORMATO_LABEL } from "@/lib/formats";
import type { CategoryWorkTypeDto, ProductCategoryDto } from "@/types/category";

/**
 * Formatea un importe o muestra guión si no hay valor.
 *
 * @param value - Importe o nulo.
 * @returns Texto formateado.
 */
function formatCell(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return formatAmount(value);
}

/**
 * Celda de precio por moneda: valor con etiqueta CUP/USD e indicador si está off.
 *
 * @param value - Importe o nulo.
 * @param active - Si la moneda está ofertada.
 * @param suffix - Moneda del importe.
 * @returns Nodo de celda.
 */
function PriceCurrencyCell(props: {
  value: number | null | undefined;
  active: boolean;
  suffix: "CUP" | "USD";
}) {
  const { value, active } = props;
  const hasValue = value !== null && value !== undefined && Number.isFinite(value) && value > 0;
  return (
    <span className={active ? undefined : "text-base-content/45"}>
      {hasValue ? formatAmount(value) : "—"}
      {!active && hasValue ? (
        <span className="ml-1 badge badge-ghost badge-xs">off</span>
      ) : null}
    </span>
  );
}

/**
 * Parsea un campo decimal del formulario (coma o punto).
 *
 * @param raw - Texto del input.
 * @returns Número finito o `NaN`.
 */
function parseDecimal(raw: string): number {
  return Number.parseFloat(raw.trim().replace(",", "."));
}

/** Orden inicial de la tabla: acabado y, dentro de cada acabado, formato. */
const DEFAULT_PRICE_TABLE_SORTING: SortingState = [
  { id: "finish", desc: false },
  { id: "formatLabel", desc: false },
];

/**
 * Precios: mosaico por categoría → tipos de trabajo → tabla.
 * El precio de venta CUP/USD es único por formato y acabado (producto terminado);
 * la tarifa de pago es por tipo de trabajo.
 * La categoría activa vive en `?categoria=` para que el sidebar vuelva siempre al mosaico.
 * Desde el mosaico se puede dar de alta una categoría; desde el detalle se abre el mismo
 * modal de Configuración para tipos, formatos y acabados.
 * Por defecto las filas nuevas ofertan USD; CUP es opcional.
 *
 * @returns Pantalla de administración de precios.
 */
export function PricesListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/precios" });
  const { categoria: selectedCategoryId } = useSearch({ from: "/precios" });
  const { usdExchangeRate } = useAppSettings();

  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<number | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [configuring, setConfiguring] = useState<ProductCategoryDto | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_PRICE_TABLE_SORTING);
  const [editing, setEditing] = useState<PriceTableRow | null>(null);
  const [editPriceCup, setEditPriceCup] = useState("");
  const [editPriceUsd, setEditPriceUsd] = useState("");
  const [editCupActive, setEditCupActive] = useState(false);
  const [editUsdActive, setEditUsdActive] = useState(true);
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
      priceCup: number | null;
      priceUsd: number | null;
      isCupActive: boolean;
      isUsdActive: boolean;
      cost: number;
      isActive: boolean;
    }) => {
      if (input.draft.isDraft) {
        return createPrice({
          categoryId: input.draft.categoryId,
          formatId: input.draft.formatId,
          finish: input.draft.finish,
          service: input.draft.service ?? "",
          priceCup: input.priceCup,
          priceUsd: input.priceUsd,
          isCupActive: input.isCupActive,
          isUsdActive: input.isUsdActive,
          cost: input.cost,
          isActive: input.isActive,
        });
      }
      return updatePrice({
        id: input.draft.id,
        priceCup: input.priceCup,
        priceUsd: input.priceUsd,
        isCupActive: input.isCupActive,
        isUsdActive: input.isUsdActive,
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
    const cup = row.priceCup ?? (row.price > 0 ? row.price : null);
    setEditPriceCup(cup != null && cup > 0 ? String(cup) : "");
    setEditPriceUsd(row.priceUsd != null && row.priceUsd > 0 ? String(row.priceUsd) : "");
    setEditCupActive(row.isCupActive);
    setEditUsdActive(row.isUsdActive);
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
        sortingFn: (rowA, rowB, columnId) => {
          const a = (rowA.getValue<string | null>(columnId) ?? "").trim();
          const b = (rowB.getValue<string | null>(columnId) ?? "").trim();
          return a.localeCompare(b, "es", { sensitivity: "base" });
        },
        cell: (info) => info.getValue<string | null>() ?? "—",
      },
      {
        id: "priceUsd",
        accessorFn: (row) => row.priceUsd,
        header: "Precio USD",
        cell: ({ row }) => (
          <PriceCurrencyCell
            value={row.original.priceUsd}
            active={row.original.isUsdActive}
            suffix="USD"
          />
        ),
      },
      {
        id: "priceCup",
        accessorFn: (row) => row.priceCup ?? row.price,
        header: "Precio CUP",
        cell: ({ row }) => (
          <PriceCurrencyCell
            value={row.original.priceCup ?? (row.original.price > 0 ? row.original.price : null)}
            active={row.original.isCupActive}
            suffix="CUP"
          />
        ),
      },
      {
        accessorKey: "cost",
        header: moneyHeading("Tarifa de pago"),
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
    setSorting(DEFAULT_PRICE_TABLE_SORTING);
    void navigate({ search: { categoria: category.id } });
  };

  const handleBackToMosaic = () => {
    setSelectedWorkTypeId(null);
    setConfiguring(null);
    setGlobalFilter("");
    setEditing(null);
    void navigate({ search: { categoria: undefined } });
  };

  /**
   * Cierra el modal de configuración de categoría y refresca precios
   * para que aparezcan filas pendientes de formatos o tipos nuevos.
   */
  const handleCloseCategoryConfig = () => {
    setConfiguring(null);
    void queryClient.invalidateQueries({ queryKey: ["prices"] });
  };

  /**
   * Calcula USD a partir de CUP con la tasa vigente de la app.
   */
  const applyRateToUsd = () => {
    if (!(usdExchangeRate > 0)) {
      setFormError("Configura la tasa de cambio USD→CUP antes de aplicarla.");
      return;
    }
    const cup = parseDecimal(editPriceCup);
    if (!Number.isFinite(cup) || cup <= 0) {
      setFormError("Introduce un precio CUP válido para convertir a USD.");
      return;
    }
    setFormError(null);
    setEditPriceUsd((cup / usdExchangeRate).toFixed(2));
    if (!editUsdActive) {
      setEditUsdActive(true);
    }
  };

  /**
   * Calcula CUP a partir de USD con la tasa vigente de la app.
   */
  const applyRateToCup = () => {
    if (!(usdExchangeRate > 0)) {
      setFormError("Configura la tasa de cambio USD→CUP antes de aplicarla.");
      return;
    }
    const usd = parseDecimal(editPriceUsd);
    if (!Number.isFinite(usd) || usd <= 0) {
      setFormError("Introduce un precio USD válido para convertir a CUP.");
      return;
    }
    setFormError(null);
    setEditPriceCup((usd * usdExchangeRate).toFixed(2));
    if (!editCupActive) {
      setEditCupActive(true);
    }
  };

  const handleSaveEdit = () => {
    if (!editing) {
      return;
    }
    if (editActive && !editCupActive && !editUsdActive) {
      setFormError("Activa al menos una moneda (CUP o USD) para el precio.");
      return;
    }

    const cupRaw = editPriceCup.trim();
    const usdRaw = editPriceUsd.trim();
    const cupParsed = cupRaw === "" ? null : parseDecimal(cupRaw);
    const usdParsed = usdRaw === "" ? null : parseDecimal(usdRaw);

    if (editCupActive) {
      if (cupParsed === null || !Number.isFinite(cupParsed) || cupParsed <= 0) {
        setFormError("El precio CUP debe ser mayor que cero cuando CUP está activo.");
        return;
      }
    } else if (cupParsed !== null && (!Number.isFinite(cupParsed) || cupParsed < 0)) {
      setFormError("El precio CUP no es válido.");
      return;
    }

    if (editUsdActive) {
      if (usdParsed === null || !Number.isFinite(usdParsed) || usdParsed <= 0) {
        setFormError("El precio USD debe ser mayor que cero cuando USD está activo.");
        return;
      }
    } else if (usdParsed !== null && (!Number.isFinite(usdParsed) || usdParsed < 0)) {
      setFormError("El precio USD no es válido.");
      return;
    }

    const tarifa = parseDecimal(editTarifa);
    if (!Number.isFinite(tarifa) || tarifa < 0) {
      setFormError("Introduce una tarifa de pago válida (0 o mayor).");
      return;
    }

    const saleCupForTarifa = editCupActive
      ? (cupParsed ?? 0)
      : editUsdActive && usdExchangeRate > 0
        ? (usdParsed ?? 0) * usdExchangeRate
        : 0;
    if (saleCupForTarifa > 0 && tarifa > saleCupForTarifa) {
      setFormError("La tarifa de pago no puede ser mayor que el precio de venta (en CUP).");
      return;
    }

    setFormError(null);
    void saveMutation.mutateAsync({
      draft: editing,
      priceCup: cupParsed,
      priceUsd: usdParsed,
      isCupActive: editCupActive,
      isUsdActive: editUsdActive,
      cost: tarifa,
      isActive: editActive,
    });
  };

  if (selectedCategory == null) {
    return (
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Precios</h1>
            <p className="text-sm text-base-content/70">
              Elige una categoría para gestionar precios de venta (CUP y/o USD) y tarifas de pago a
              trabajadores.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            onClick={() => setCreatingCategory(true)}
          >
            <Plus className="h-4 w-4" />
            Nueva categoría
          </button>
        </div>

        {categoriesQuery.isLoading && <p>Cargando categorías...</p>}
        {categoriesQuery.isError && (
          <div className="alert alert-error">
            <span>No se pudieron cargar las categorías.</span>
          </div>
        )}

        {!categoriesQuery.isLoading && !categoriesQuery.isError && (
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
            <button
              type="button"
              className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-base-300 bg-base-200/40 p-4 text-center text-base-content/70 transition hover:border-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => setCreatingCategory(true)}
            >
              <Plus className="h-8 w-8" aria-hidden />
              <span className="text-sm font-semibold leading-tight">Nueva categoría</span>
            </button>
          </div>
        )}

        {creatingCategory && (
          <CategoryFormModal
            category={null}
            onClose={() => setCreatingCategory(false)}
            onSaved={handleSelectCategory}
          />
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
              Precio de venta único por formato y acabado (producto terminado); se muestra en
              cada tipo de trabajo como referencia. La tarifa de pago sí es por tipo. Las filas
              pendientes aparecen en 0 hasta que las definas.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1 self-start sm:self-end"
            title="Configurar tipos de trabajo, formatos y acabados"
            onClick={() => setConfiguring(selectedCategory)}
          >
            <Settings2 className="h-4 w-4" />
            Configurar
          </button>
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
            Esta categoría no tiene tipos de trabajo asociados. Usa{" "}
            <button
              type="button"
              className="link font-semibold"
              onClick={() => setConfiguring(selectedCategory)}
            >
              Configurar
            </button>{" "}
            para asociarlos.
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
          <div className="modal-box max-w-xl">
            <h3 className="text-lg font-bold">
              {editing.isDraft ? "Definir precio" : "Editar precio"}
            </h3>
            <p className="py-1 text-sm text-base-content/70">
              {selectedCategory.name}
              {selectedWorkType ? ` · ${selectedWorkType.workTypeName}` : ""}
              {` · ${editing.formatLabel ?? SIN_FORMATO_LABEL}`}
              {editing.finish ? ` · ${editing.finish}` : ""}
            </p>
            <p className="mb-2 text-xs text-base-content/60">
              Tasa vigente:{" "}
              {usdExchangeRate > 0
                ? `1 USD = ${formatAmount(usdExchangeRate)} CUP`
                : "no configurada"}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-base-300 p-3">
                <label className="label cursor-pointer justify-start gap-3 py-0">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={editUsdActive}
                    onChange={(e) => setEditUsdActive(e.target.checked)}
                  />
                  <span className="label-text font-medium">Precio USD</span>
                  <span className="badge badge-ghost badge-xs">default</span>
                </label>
                <input
                  id="edit-price-usd"
                  type="text"
                  inputMode="decimal"
                  className="input input-bordered input-sm mt-2 w-full"
                  value={editPriceUsd}
                  onChange={(e) => setEditPriceUsd(e.target.value)}
                  placeholder="0.00"
                  aria-label="Precio en USD"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs mt-2"
                  onClick={applyRateToUsd}
                  disabled={!(usdExchangeRate > 0)}
                >
                  Aplicar tasa desde CUP
                </button>
              </div>

              <div className="rounded-lg border border-base-300 p-3">
                <label className="label cursor-pointer justify-start gap-3 py-0">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={editCupActive}
                    onChange={(e) => setEditCupActive(e.target.checked)}
                  />
                  <span className="label-text font-medium">Precio CUP</span>
                </label>
                <input
                  id="edit-price-cup"
                  type="text"
                  inputMode="decimal"
                  className="input input-bordered input-sm mt-2 w-full"
                  value={editPriceCup}
                  onChange={(e) => setEditPriceCup(e.target.value)}
                  placeholder="0.00"
                  aria-label="Precio en CUP"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs mt-2"
                  onClick={applyRateToCup}
                  disabled={!(usdExchangeRate > 0)}
                >
                  Aplicar tasa desde USD
                </button>
              </div>
            </div>

            <div className="form-control py-2">
              <label className="label" htmlFor="edit-tarifa">
                <span className="label-text">Tarifa de Pago (CUP)</span>
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
                  Importe unitario al trabajador en CUP (por defecto 0). Se compara con el precio de
                  venta en CUP (o USD×tasa si solo USD está activo).
                </span>
              </label>
            </div>
            <label className="label cursor-pointer justify-start gap-3 py-2">
              <span className="label-text">Fila activa</span>
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

      {configuring && (
        <CategoryConfigModal category={configuring} onClose={handleCloseCategoryConfig} />
      )}
    </section>
  );
}
