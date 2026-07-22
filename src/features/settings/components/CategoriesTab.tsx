import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Power, RotateCcw, Settings2 } from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  createCategory,
  deactivateCategory,
  fetchCategories,
  reactivateCategory,
  updateCategory,
} from "@/db/queries/categories";
import type { ProductCategoryDto } from "@/types/category";
import { CategoryConfigModal } from "@/features/settings/components/CategoryConfigModal";
import { CATEGORY_ICON_MAP, resolveCategoryIcon } from "@/lib/category-icons";
import { slugify } from "@/lib/slugify";

const ICON_OPTIONS = Object.keys(CATEGORY_ICON_MAP);

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
  const [showModal, setShowModal] = useState(false);
  const [configuring, setConfiguring] = useState<ProductCategoryDto | null>(null);
  const [editing, setEditing] = useState<ProductCategoryDto | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Tag");
  const [sortOrder, setSortOrder] = useState("10");
  const [codeTouched, setCodeTouched] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        code: code.trim() || slugify(name),
        description: description.trim() || null,
        icon,
        sortOrder: Number.parseInt(sortOrder, 10) || 10,
      };
      if (editing) {
        return updateCategory(editing.id, payload);
      }
      return createCategory(payload);
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

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
    setName("");
    setCode("");
    setDescription("");
    setIcon("Tag");
    setSortOrder("10");
    setCodeTouched(false);
    setShowModal(true);
  };

  const openEdit = (row: ProductCategoryDto) => {
    setEditing(row);
    setName(row.name);
    setCode(row.code);
    setDescription(row.description ?? "");
    setIcon(row.icon ?? "Tag");
    setSortOrder(String(row.sortOrder));
    setCodeTouched(true);
    setShowModal(true);
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

      {showModal && (
        <ModalPortal>
          <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{editing ? "Editar categoría" : "Nueva categoría"}</h3>
            <div className="mt-4 space-y-3">
              <label className="form-control">
                <span className="label-text">Nombre *</span>
                <input
                  className="input input-bordered"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!codeTouched) {
                      setCode(slugify(e.target.value));
                    }
                  }}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Código *</span>
                <input
                  className="input input-bordered font-mono"
                  value={code}
                  onChange={(e) => {
                    setCodeTouched(true);
                    setCode(e.target.value);
                  }}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Descripción</span>
                <input className="input input-bordered" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="form-control">
                <span className="label-text">Icono</span>
                <select className="select select-bordered" value={icon} onChange={(e) => setIcon(e.target.value)}>
                  {ICON_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">Orden</span>
                <input className="input input-bordered" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </label>
            </div>
            {saveMutation.isError && (
              <p className="mt-2 text-sm text-error">{(saveMutation.error as Error).message}</p>
            )}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void saveMutation.mutateAsync()}>
                Guardar categoría
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={() => setShowModal(false)} />
          </dialog>
        </ModalPortal>
      )}

      {configuring && (
        <CategoryConfigModal category={configuring} onClose={() => setConfiguring(null)} />
      )}
    </div>
  );
}
