import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Power, RotateCcw, Sparkles } from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  createFinish,
  deactivateFinish,
  fetchFinishes,
  reactivateFinish,
  updateFinish,
} from "@/db/queries/finishes";
import type { FinishDto } from "@/types/finish";

/**
 * Tab de gestión del catálogo global de acabados.
 *
 * @returns Tabla CRUD de acabados.
 */
export function FinishesTab() {
  const queryClient = useQueryClient();
  const finishesQuery = useQuery({
    queryKey: ["finishes", "manage"],
    queryFn: () => fetchFinishes(false),
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FinishDto | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("El nombre es obligatorio");
      }
      if (editing) {
        return updateFinish(editing.id, {
          name: trimmed,
          description: description.trim() || null,
        });
      }
      return createFinish(trimmed, description.trim() || null);
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditing(null);
      setName("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["finishes"] });
      await queryClient.invalidateQueries({ queryKey: ["category-finishes"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateFinish,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finishes"] });
      await queryClient.invalidateQueries({ queryKey: ["category-finishes"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateFinish,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finishes"] });
      await queryClient.invalidateQueries({ queryKey: ["category-finishes"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setShowModal(true);
  };

  /**
   * Abre el modal con los datos del acabado a editar.
   *
   * @param finish - Acabado seleccionado.
   */
  const openEdit = (finish: FinishDto) => {
    setEditing(finish);
    setName(finish.name);
    setDescription(finish.description ?? "");
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
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5" /> Acabados
        </h2>
        <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo acabado
        </button>
      </div>
      <p className="text-xs text-base-content/60">
        Catálogo global. Al configurar una categoría podrás asociar uno o más de estos acabados
        (opcionales en el pedido). Los desactivados no aparecen en nuevas asociaciones ni en
        pedidos; el historial se conserva.
      </p>
      <div className="overflow-x-auto rounded-lg border border-base-300">
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
            {(finishesQuery.data ?? []).map((f) => (
              <tr key={f.id} className={f.isActive ? "" : "opacity-60"}>
                <td className="font-medium">{f.name}</td>
                <td className="text-xs text-base-content/70">{f.description ?? "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1">
                    {f.isSystem && <span className="badge badge-sm badge-neutral">Base</span>}
                    <span className={`badge badge-sm ${f.isActive ? "badge-success" : "badge-ghost"}`}>
                      {f.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Editar"
                      onClick={() => openEdit(f)}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {f.isActive ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-warning"
                        title="Desactivar"
                        disabled={deactivateMutation.isPending}
                        onClick={() => void deactivateMutation.mutateAsync(f.id)}
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-success"
                        title="Reactivar"
                        disabled={reactivateMutation.isPending}
                        onClick={() => void reactivateMutation.mutateAsync(f.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(finishesQuery.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-base-content/60">
                  No hay acabados definidos.
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
            <h3 className="text-lg font-bold">{editing ? "Editar acabado" : "Nuevo acabado"}</h3>
            <p className="mt-1 text-sm text-base-content/60">
              Ejemplos: Brillo, 3D, Diamantado, Cuero Acrílico.
            </p>
            <div className="mt-4 space-y-3">
              <label className="form-control">
                <span className="label-text">Nombre *</span>
                <input
                  className="input input-bordered"
                  value={name}
                  autoComplete="off"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Brillo"
                />
              </label>
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
                {(saveMutation.error as Error)?.message ?? "No se pudo guardar el acabado."}
              </p>
            )}
            <div className="modal-action">
              <button type="button" className="btn" onClick={closeModal} disabled={saveMutation.isPending}>
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
                  "Crear acabado"
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
