import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Power, RotateCcw } from "lucide-react";
import {
  createEmployeeRole,
  deactivateEmployeeRole,
  fetchEmployeeRoles,
  reactivateEmployeeRole,
  updateEmployeeRole,
} from "@/db/queries/employee-roles";
import { ModalPortal } from "@/components/common/ModalPortal";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Tab de configuración para CRUD de roles de empleados.
 *
 * @returns Tabla y formulario de roles.
 */
export function EmployeeRolesTab() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["employee-roles"], queryFn: () => fetchEmployeeRoles(false) });
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return updateEmployeeRole(editingId, { name, description: description || null });
      }
      return createEmployeeRole({ name, description: description || null });
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditingId(null);
      setName("");
      setDescription("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["employee-roles"] });
      pushFlashMessage({ kind: "success", text: "Rol guardado." });
    },
    onError: (e: Error) => setError(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateEmployeeRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee-roles"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateEmployeeRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee-roles"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setError(null);
    setShowModal(true);
  };

  const openEdit = (id: number, roleName: string, desc: string | null) => {
    setEditingId(id);
    setName(roleName);
    setDescription(desc ?? "");
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Roles de empleados</h2>
        <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
          <Plus size={14} /> Nuevo rol
        </button>
      </div>

      {error && !showModal && <p className="text-error text-sm">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(rolesQuery.data ?? []).map((role) => (
              <tr key={role.id}>
                <td>
                  <div>{role.name}</div>
                  {role.description && (
                    <div className="text-xs text-base-content/60">{role.description}</div>
                  )}
                </td>
                <td>
                  <span className={`badge badge-sm ${role.isActive ? "badge-success" : "badge-ghost"}`}>
                    {role.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Editar"
                      onClick={() => openEdit(role.id, role.name, role.description)}
                    >
                      <Pencil size={14} />
                    </button>
                    {role.isActive ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-warning"
                        title="Desactivar"
                        onClick={() => void deactivateMutation.mutateAsync(role.id)}
                      >
                        <Power size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-success"
                        title="Activar"
                        onClick={() => void reactivateMutation.mutateAsync(role.id)}
                      >
                        <RotateCcw size={14} />
                      </button>
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
            <h3 className="font-bold text-lg">{editingId ? "Editar rol" : "Nuevo rol"}</h3>
            <div className="mt-4 space-y-3">
              <input
                className="input input-bordered input-sm w-full"
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="input input-bordered input-sm w-full"
                placeholder="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {error && <p className="text-error text-sm">{error}</p>}
            </div>
            <div className="modal-action">
              <button type="button" className="btn" onClick={closeModal}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saveMutation.isPending || name.trim().length === 0}
                onClick={() => void saveMutation.mutateAsync()}
              >
                Guardar
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={closeModal} />
          </dialog>
        </ModalPortal>
      )}
    </div>
  );
}
