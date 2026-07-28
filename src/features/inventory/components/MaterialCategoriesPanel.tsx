import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  createMaterialCategory,
  deactivateMaterialCategory,
  fetchMaterialCategories,
  reactivateMaterialCategory,
  updateMaterialCategory,
} from "@/db/queries/inventory";
import type { MaterialCategoryDto } from "@/types/inventory";

interface MaterialCategoriesPanelProps {
  /** Si true, oculta el título externo (p. ej. dentro de un modal). */
  embedded?: boolean;
}

/**
 * CRUD de categorías de materiales de inventario.
 *
 * @param props - Opciones de presentación.
 * @returns Panel de gestión de categorías.
 */
export function MaterialCategoriesPanel(props: MaterialCategoriesPanelProps = {}) {
  const { embedded = false } = props;
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ["inventory", "material-categories"],
    queryFn: () => fetchMaterialCategories(false),
  });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MaterialCategoryDto | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("10");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("El nombre es obligatorio");
      }
      const order = Number.parseInt(sortOrder, 10) || 10;
      if (editing) {
        return updateMaterialCategory(editing.id, {
          name: trimmed,
          description: description.trim() || null,
          sortOrder: order,
        });
      }
      return createMaterialCategory({
        name: trimmed,
        description: description.trim() || null,
        sortOrder: order,
      });
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "material-categories"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateMaterialCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory", "material-categories"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateMaterialCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory", "material-categories"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSortOrder("10");
    setShowModal(true);
  };

  const openEdit = (row: MaterialCategoryDto) => {
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
    setSortOrder(String(row.sortOrder));
    setShowModal(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          {!embedded && <h2 className="text-lg font-semibold">Categorías de materiales</h2>}
          <p className="text-xs text-base-content/60">
            Debes crear al menos una categoría activa antes de dar de alta ítems.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm gap-1" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva categoría
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(categoriesQuery.data ?? []).map((row) => (
              <tr key={row.id} className={row.isActive ? "" : "opacity-60"}>
                <td className="font-medium">{row.name}</td>
                <td className="text-xs text-base-content/70">{row.description ?? "—"}</td>
                <td>
                  <span className={`badge badge-sm ${row.isActive ? "badge-success" : "badge-ghost"}`}>
                    {row.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn btn-ghost btn-xs" title="Editar" onClick={() => openEdit(row)}>
                      <Pencil className="h-3 w-3" />
                    </button>
                    {row.isActive ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-warning"
                        title="Desactivar"
                        onClick={() => void deactivateMutation.mutateAsync(row.id)}
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-success"
                        title="Reactivar"
                        onClick={() => void reactivateMutation.mutateAsync(row.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(categoriesQuery.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-base-content/60">
                  No hay categorías. Crea una para poder agregar ítems.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ModalPortal>
          <dialog className="modal modal-open">
            <div className="modal-box max-w-md">
              <h3 className="text-lg font-bold">{editing ? "Editar categoría" : "Nueva categoría"}</h3>
              <div className="mt-4 space-y-3">
                <label className="form-control">
                  <span className="label-text">Nombre *</span>
                  <input className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="form-control">
                  <span className="label-text">Descripción</span>
                  <input
                    className="input input-bordered"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
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
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saveMutation.isPending}
                  onClick={() => void saveMutation.mutateAsync()}
                >
                  Guardar
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-backdrop bg-transparent"
              aria-label="Cerrar"
              onClick={() => setShowModal(false)}
            />
          </dialog>
        </ModalPortal>
      )}
    </div>
  );
}
