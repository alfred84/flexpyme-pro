import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Plus, Power } from "lucide-react";

interface WorkTypeDto {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
}

/**
 * Tab de gestión de tipos de trabajo.
 *
 * @returns Tabla CRUD de tipos de trabajo.
 */
export function WorkTypesTab() {
  const queryClient = useQueryClient();
  const typesQuery = useQuery({
    queryKey: ["work-types"],
    queryFn: () => invoke<WorkTypeDto[]>("get_work_types", { activeOnly: false }),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async () =>
      invoke<WorkTypeDto>("create_work_type", { name, description: description || null }),
    onSuccess: async () => {
      setName("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["work-types"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => invoke("deactivate_work_type", { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-types"] });
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tipos de trabajo</h2>
      <div className="card bg-base-200 max-w-lg">
        <div className="card-body gap-2">
          <h3 className="font-medium flex items-center gap-2">
            <Plus size={14} /> Nuevo tipo
          </h3>
          <input className="input input-sm input-bordered" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input input-sm input-bordered" placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="button" className="btn btn-sm btn-primary w-fit" onClick={() => void createMutation.mutateAsync()}>
            Guardar tipo
          </button>
        </div>
      </div>
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
            {(typesQuery.data ?? []).map((wt) => (
              <tr key={wt.id}>
                <td>{wt.name}</td>
                <td className="text-xs text-base-content/70">{wt.description ?? "—"}</td>
                <td>
                  <span className={`badge badge-sm ${wt.isActive ? "badge-success" : "badge-ghost"}`}>
                    {wt.isSystem ? "Base" : wt.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right">
                  {!wt.isSystem && wt.isActive && (
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => void deactivateMutation.mutateAsync(wt.id)}>
                      <Power size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
