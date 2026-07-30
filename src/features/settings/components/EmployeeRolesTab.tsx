import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Pencil, Plus, Power, RotateCcw } from "lucide-react";
import {
  createEmployeeRole,
  deactivateEmployeeRole,
  fetchEmployeeRoles,
  reactivateEmployeeRole,
  updateEmployeeRole,
  type EmployeeRoleDto,
} from "@/db/queries/employee-roles";
import { ModalPortal } from "@/components/common/ModalPortal";
import { pushFlashMessage } from "@/lib/flash-message";

interface WorkTypeOption {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
}

/**
 * Tab de configuración para CRUD de roles de empleados y tipos de trabajo asociados.
 *
 * @returns Tabla y formulario de roles.
 */
export function EmployeeRolesTab() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({
    queryKey: ["employee-roles"],
    queryFn: () => fetchEmployeeRoles(false),
  });
  const workTypesQuery = useQuery({
    queryKey: ["work-types", "active"],
    queryFn: () => invoke<WorkTypeOption[]>("get_work_types", { activeOnly: true }),
  });

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workTypeIds, setWorkTypeIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return updateEmployeeRole(editingId, {
          name,
          description: description || null,
          workTypeIds,
        });
      }
      return createEmployeeRole({
        name,
        description: description || null,
        workTypeIds,
      });
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditingId(null);
      setName("");
      setDescription("");
      setWorkTypeIds([]);
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
    setWorkTypeIds([]);
    setError(null);
    setShowModal(true);
  };

  /**
   * Abre el modal de edición con los datos del rol.
   *
   * @param role - Rol a editar.
   */
  const openEdit = (role: EmployeeRoleDto) => {
    setEditingId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
    setWorkTypeIds(role.workTypeIds ?? []);
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setWorkTypeIds([]);
    setError(null);
  };

  /**
   * Alterna un tipo de trabajo en la selección del rol.
   *
   * @param id - Id del tipo de trabajo.
   */
  const toggleWorkType = (id: number) => {
    setWorkTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const workTypeNameById = new Map(
    (workTypesQuery.data ?? []).map((wt) => [wt.id, wt.name] as const),
  );

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
              <th>Tipos de trabajo</th>
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
                  <div className="flex flex-wrap gap-1">
                    {(role.workTypeIds ?? []).length === 0 ? (
                      <span className="text-xs text-base-content/50">Sin asociar</span>
                    ) : (
                      (role.workTypeIds ?? []).map((wtId) => (
                        <span key={wtId} className="badge badge-ghost badge-sm">
                          {workTypeNameById.get(wtId) ?? `#${wtId}`}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td>
                  <span
                    className={`badge badge-sm ${role.isActive ? "badge-success" : "badge-ghost"}`}
                  >
                    {role.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Editar"
                      onClick={() => openEdit(role)}
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
            <div className="modal-box max-w-lg">
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
                <fieldset className="rounded-lg border border-base-300 p-3">
                  <legend className="px-1 text-sm font-medium">Tipos de trabajo</legend>
                  <p className="mb-2 text-xs text-base-content/60">
                    Define qué trabajos pueden realizar los empleados con este rol.
                  </p>
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {(workTypesQuery.data ?? []).map((wt) => (
                      <label key={wt.id} className="label cursor-pointer justify-start gap-2 py-1">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={workTypeIds.includes(wt.id)}
                          onChange={() => toggleWorkType(wt.id)}
                        />
                        <span className="label-text text-sm">{wt.name}</span>
                      </label>
                    ))}
                    {(workTypesQuery.data ?? []).length === 0 && (
                      <p className="text-xs text-base-content/50">
                        No hay tipos de trabajo activos.
                      </p>
                    )}
                  </div>
                </fieldset>
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
