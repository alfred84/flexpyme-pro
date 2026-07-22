import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, RotateCcw, Settings2, X } from "lucide-react";
import { useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  createExpenseType,
  deactivateExpenseType,
  fetchExpenseTypes,
  reactivateExpenseType,
  updateExpenseType,
} from "@/db/queries/expense-types";

interface ExpenseTypesConfigModalProps {
  /** Cierra el modal. */
  onClose: () => void;
}

/**
 * Modal para gestionar los tipos del select «Tipo» en Otros gastos
 * (alta, renombre, activar/desactivar).
 *
 * @param props - Callback de cierre.
 * @returns Diálogo de configuración de tipos.
 */
export function ExpenseTypesConfigModal(props: ExpenseTypesConfigModalProps) {
  const { onClose } = props;
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const typesQuery = useQuery({
    queryKey: ["expense-types", "manage"],
    queryFn: () => fetchExpenseTypes(false),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["expense-types"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("El nombre del tipo es obligatorio.");
      }
      if (editingId) {
        return updateExpenseType(editingId, { name: trimmed });
      }
      return createExpenseType({ name: trimmed });
    },
    onSuccess: async (_result, _vars, _ctx) => {
      const wasEdit = editingId !== null;
      setFormOpen(false);
      setEditingId(null);
      setName("");
      setError(null);
      setFeedback(wasEdit ? "Tipo actualizado." : "Tipo creado.");
      await invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateExpenseType,
    onSuccess: async () => {
      setFeedback("Tipo desactivado (ya no aparece en el select).");
      setError(null);
      await invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateExpenseType,
    onSuccess: async () => {
      setFeedback("Tipo reactivado.");
      setError(null);
      await invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setError(null);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEdit = (id: number, currentName: string) => {
    setEditingId(id);
    setName(currentName);
    setError(null);
    setFeedback(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setError(null);
  };

  const busy =
    saveMutation.isPending || deactivateMutation.isPending || reactivateMutation.isPending;

  return (
    <ModalPortal>
      <dialog className="modal modal-open" aria-labelledby="expense-types-title">
      <div className="modal-box flex max-h-[85vh] w-full max-w-lg flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="expense-types-title" className="flex items-center gap-2 text-lg font-bold">
              <Settings2 className="h-5 w-5" />
              Configurar tipos de gasto
            </h3>
            <p className="mt-1 text-sm text-base-content/70">
              Estos nombres aparecen en el select «Tipo» al registrar un gasto. Los gastos ya
              guardados conservan el nombre que tenían al crearse.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {feedback && (
          <div className="alert alert-success py-2" role="status">
            <span className="text-sm">{feedback}</span>
          </div>
        )}
        {error && !formOpen && (
          <div className="alert alert-error py-2">
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn btn-primary btn-sm gap-1" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo tipo
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-base-300">
          {typesQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-sm" />
              Cargando tipos…
            </div>
          )}
          {typesQuery.isError && (
            <p className="p-4 text-sm text-error">No se pudieron cargar los tipos de gasto.</p>
          )}
          {typesQuery.isSuccess && (typesQuery.data?.length ?? 0) === 0 && (
            <p className="p-8 text-center text-sm text-base-content/60">
              Aún no hay tipos. Crea el primero con «Nuevo tipo».
            </p>
          )}
          {(typesQuery.data?.length ?? 0) > 0 && (
            <table className="table table-sm">
              <thead className="sticky top-0 z-10 bg-base-200">
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(typesQuery.data ?? []).map((tipo) => (
                  <tr key={tipo.id} className={tipo.isActive ? undefined : "opacity-60"}>
                    <td className="font-medium">{tipo.name}</td>
                    <td>
                      <span
                        className={`badge badge-sm ${tipo.isActive ? "badge-success" : "badge-ghost"}`}
                      >
                        {tipo.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          title="Renombrar"
                          disabled={busy}
                          onClick={() => openEdit(tipo.id, tipo.name)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {tipo.isActive ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-warning"
                            title="Desactivar"
                            disabled={busy}
                            onClick={() => void deactivateMutation.mutateAsync(tipo.id)}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-success"
                            title="Activar"
                            disabled={busy}
                            onClick={() => void reactivateMutation.mutateAsync(tipo.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-action mt-0">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={onClose}>
          cerrar
        </button>
      </form>

      {formOpen && (
        <ModalPortal>
          <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h4 className="text-base font-bold">
              {editingId ? "Renombrar tipo" : "Nuevo tipo de gasto"}
            </h4>
            <label className="form-control mt-4">
              <span className="label-text">Nombre</span>
              <input
                className="input input-bordered input-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej.: Almuerzo, Transporte…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveMutation.mutateAsync();
                  }
                }}
              />
            </label>
            {error && <p className="mt-2 text-sm text-error">{error}</p>}
            <div className="modal-action">
              <button type="button" className="btn btn-sm" onClick={closeForm} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || !name.trim()}
                onClick={() => void saveMutation.mutateAsync()}
              >
                {saveMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="submit" onClick={closeForm}>
              cerrar
            </button>
          </form>
          </dialog>
        </ModalPortal>
      )}
      </dialog>
    </ModalPortal>
  );
}
