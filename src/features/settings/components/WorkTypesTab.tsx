import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Pencil, Plus, Power, RotateCcw } from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";

interface WorkTypeDto {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
}

/**
 * Tab de gestión de tipos de trabajo (alta, edición, baja/reactivación).
 *
 * @returns Tabla CRUD de tipos de trabajo.
 */
export function WorkTypesTab() {
  const queryClient = useQueryClient();
  const typesQuery = useQuery({
    queryKey: ["work-types"],
    queryFn: () => invoke<WorkTypeDto[]>("get_work_types", { activeOnly: false }),
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WorkTypeDto | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("El nombre es obligatorio");
      }
      if (editing) {
        return invoke<WorkTypeDto>("update_work_type", {
          id: editing.id,
          data: {
            name: trimmed,
            description: description.trim() || null,
          },
        });
      }
      return invoke<WorkTypeDto>("create_work_type", {
        name: trimmed,
        description: description.trim() || null,
      });
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditing(null);
      setName("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["work-types"] });
      await queryClient.invalidateQueries({ queryKey: ["category-work-types"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => invoke("deactivate_work_type", { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-types"] });
      await queryClient.invalidateQueries({ queryKey: ["category-work-types"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => invoke<WorkTypeDto>("reactivate_work_type", { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-types"] });
      await queryClient.invalidateQueries({ queryKey: ["category-work-types"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setShowModal(true);
  };

  /**
   * Abre el modal con los datos del tipo a editar.
   *
   * @param workType - Tipo de trabajo seleccionado.
   */
  const openEdit = (workType: WorkTypeDto) => {
    setEditing(workType);
    setName(workType.name);
    setDescription(workType.description ?? "");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    saveMutation.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Tipos de trabajo</h2>
        <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo tipo
        </button>
      </div>
      <p className="text-xs text-base-content/60">
        Puedes editar el nombre y la descripción de cualquier tipo. Los desactivados no aparecen en
        nuevas asociaciones de categoría ni en pedidos; el historial se conserva.
      </p>
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(typesQuery.data ?? []).map((wt) => (
              <tr key={wt.id} className={wt.isActive ? "" : "opacity-60"}>
                <td className="font-medium">{wt.name}</td>
                <td className="font-mono text-xs">{wt.code}</td>
                <td className="text-xs text-base-content/70">{wt.description ?? "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1">
                    {wt.isSystem && <span className="badge badge-sm badge-neutral">Base</span>}
                    <span
                      className={`badge badge-sm ${wt.isActive ? "badge-success" : "badge-ghost"}`}
                    >
                      {wt.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Editar"
                      onClick={() => openEdit(wt)}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {wt.isActive ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-warning"
                        title="Desactivar"
                        disabled={deactivateMutation.isPending}
                        onClick={() => void deactivateMutation.mutateAsync(wt.id)}
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-success"
                        title="Reactivar"
                        disabled={reactivateMutation.isPending}
                        onClick={() => void reactivateMutation.mutateAsync(wt.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(typesQuery.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-base-content/60">
                  No hay tipos de trabajo definidos.
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
            <h3 className="text-lg font-bold">
              {editing ? "Editar tipo de trabajo" : "Nuevo tipo de trabajo"}
            </h3>
            <p className="mt-1 text-sm text-base-content/60">
              Ejemplos: Impresión, Laminado, Enmarcado. El código interno no cambia al editar.
            </p>
            <div className="mt-4 space-y-3">
              <label className="form-control">
                <span className="label-text">Nombre *</span>
                <input
                  className="input input-bordered"
                  value={name}
                  autoComplete="off"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Laminado"
                />
              </label>
              {editing && (
                <label className="form-control">
                  <span className="label-text">Código</span>
                  <input className="input input-bordered font-mono" value={editing.code} disabled />
                </label>
              )}
              <label className="form-control">
                <span className="label-text">Descripción</span>
                <input
                  className="input input-bordered"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>
            {saveMutation.isError && (
              <p className="mt-2 text-sm text-error">
                {(saveMutation.error as Error)?.message ?? "No se pudo guardar el tipo de trabajo."}
              </p>
            )}
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={closeModal}
                disabled={saveMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saveMutation.isPending}
                onClick={() => void saveMutation.mutateAsync()}
              >
                {saveMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : editing ? (
                  "Guardar cambios"
                ) : (
                  "Crear tipo"
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop bg-transparent"
            aria-label="Cerrar"
            onClick={closeModal}
          />
          </dialog>
        </ModalPortal>
      )}
    </div>
  );
}
