import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Power, RotateCcw, Settings2 } from "lucide-react";
import { deactivateCategory, fetchCategories, reactivateCategory } from "@/db/queries/categories";
import type { ProductCategoryDto } from "@/types/category";
import { CategoryConfigModal } from "@/features/settings/components/CategoryConfigModal";
import { CategoryFormModal } from "@/features/settings/components/CategoryFormModal";
import { resolveCategoryIcon } from "@/lib/category-icons";

/**
 * Tab de gestión de categorías de productos.
 *
 * @returns Tabla CRUD con protección de categorías sistema.
 */
export function CategoriesTab() {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ["categories", "manage"],
    queryFn: () => fetchCategories(false),
  });
  const [showForm, setShowForm] = useState(false);
  const [configuring, setConfiguring] = useState<ProductCategoryDto | null>(null);
  const [editing, setEditing] = useState<ProductCategoryDto | null>(null);

  const deactivateMutation = useMutation({
    mutationFn: deactivateCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const rows = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (row: ProductCategoryDto) => {
    setEditing(row);
    setShowForm(true);
  };

  const renderIcon = (iconName: string | null) => {
    const Icon = resolveCategoryIcon(iconName);
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Categorías de productos</h2>
        <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva categoría
        </button>
      </div>
      <p className="text-sm text-base-content/60">
        Las categorías base del sistema no pueden modificarse. Las inactivas no aparecen en nuevos pedidos.
      </p>
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="flex items-center gap-2">
                  {renderIcon(row.icon)}
                  {row.name}
                </td>
                <td className="font-mono text-xs">{row.code}</td>
                <td>
                  {row.isSystem ? (
                    <span className="badge badge-sm badge-neutral">Base</span>
                  ) : row.isActive ? (
                    <span className="badge badge-sm badge-success">Activa</span>
                  ) : (
                    <span className="badge badge-sm">Inactiva</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Configurar tipos de trabajo, formatos y acabados"
                      onClick={() => setConfiguring(row)}
                    >
                      <Settings2 className="h-3 w-3" />
                    </button>
                    {!row.isSystem && (
                      <>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => openEdit(row)}>
                          <Pencil className="h-3 w-3" />
                        </button>
                        {row.isActive ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-warning"
                            onClick={() => void deactivateMutation.mutateAsync(row.id)}
                          >
                            <Power className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-success"
                            onClick={() => void reactivateMutation.mutateAsync(row.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CategoryFormModal category={editing} onClose={() => setShowForm(false)} />
      )}

      {configuring && (
        <CategoryConfigModal category={configuring} onClose={() => setConfiguring(null)} />
      )}
    </div>
  );
}
