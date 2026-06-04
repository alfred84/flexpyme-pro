import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Plus, Power } from "lucide-react";

interface FormatDto {
  id: number;
  label: string;
  widthInches: number | null;
  heightInches: number | null;
  isActive: boolean;
  isSystem: boolean;
}

/**
 * Tab de gestión de formatos de impresión.
 *
 * @returns Tabla CRUD de formatos.
 */
export function FormatsTab() {
  const queryClient = useQueryClient();
  const formatsQuery = useQuery({
    queryKey: ["formats", "manage"],
    queryFn: () => invoke<FormatDto[]>("get_formats", { activeOnly: false }),
  });
  const [label, setLabel] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const createMutation = useMutation({
    mutationFn: async () =>
      invoke<FormatDto>("create_format", {
        label,
        width: Number(width),
        height: Number(height),
      }),
    onSuccess: async () => {
      setLabel("");
      setWidth("");
      setHeight("");
      await queryClient.invalidateQueries({ queryKey: ["formats"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => invoke("deactivate_format", { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["formats"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Formatos de impresión</h2>
      </div>
      <div className="card bg-base-200 max-w-lg">
        <div className="card-body gap-2">
          <h3 className="font-medium flex items-center gap-2">
            <Plus size={14} /> Nuevo formato
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <input className="input input-sm input-bordered" placeholder="Etiqueta" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className="input input-sm input-bordered" placeholder="Ancho" value={width} onChange={(e) => setWidth(e.target.value)} />
            <input className="input input-sm input-bordered" placeholder="Alto" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <button type="button" className="btn btn-sm btn-primary w-fit" onClick={() => void createMutation.mutateAsync()}>
            Guardar formato
          </button>
        </div>
      </div>
      <p className="text-xs text-base-content/60">
        Los formatos desactivados no aparecen en nuevos pedidos pero se conservan en el historial.
      </p>
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Formato</th>
              <th>Pulgadas</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(formatsQuery.data ?? []).map((f) => (
              <tr key={f.id}>
                <td>{f.label}</td>
                <td>
                  {f.widthInches ?? "—"}&quot; × {f.heightInches ?? "—"}&quot;
                </td>
                <td>
                  <span className={`badge badge-sm ${f.isActive ? "badge-success" : "badge-ghost"}`}>
                    {f.isSystem ? "Base" : f.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="text-right">
                  {!f.isSystem && f.isActive && (
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => void deactivateMutation.mutateAsync(f.id)}>
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
