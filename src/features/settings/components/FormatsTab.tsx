import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Pencil, Plus, Power, RotateCcw } from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { isSinFormatoLabel } from "@/lib/formats";

interface FormatDto {
  id: number;
  label: string;
  widthInches: number | null;
  heightInches: number | null;
  isActive: boolean;
  isSystem: boolean;
}

/**
 * Tab de gestión de formatos de impresión (alta, edición, baja/reactivación).
 *
 * @returns Tabla CRUD de formatos.
 */
export function FormatsTab() {
  const queryClient = useQueryClient();
  const formatsQuery = useQuery({
    queryKey: ["formats", "manage"],
    queryFn: () => invoke<FormatDto[]>("get_formats", { activeOnly: false }),
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FormatDto | null>(null);
  const [label, setLabel] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const widthInches = Number(width.replace(",", "."));
      const heightInches = Number(height.replace(",", "."));
      if (!label.trim()) {
        throw new Error("La etiqueta es obligatoria");
      }
      if (!Number.isFinite(widthInches) || widthInches < 0) {
        throw new Error("El ancho debe ser un número mayor o igual que cero");
      }
      if (!Number.isFinite(heightInches) || heightInches < 0) {
        throw new Error("El alto debe ser un número mayor o igual que cero");
      }
      const editingSinFormato = editing != null && isSinFormatoLabel(editing.label);
      if (!editingSinFormato && (widthInches <= 0 || heightInches <= 0)) {
        throw new Error("El ancho y el alto deben ser mayores que cero");
      }
      if (editing) {
        return invoke<FormatDto>("update_format", {
          id: editing.id,
          data: {
            label: label.trim(),
            widthInches,
            heightInches,
          },
        });
      }
      return invoke<FormatDto>("create_format", {
        label: label.trim(),
        width: widthInches,
        height: heightInches,
      });
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditing(null);
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

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => invoke<FormatDto>("reactivate_format", { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["formats"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setLabel("");
    setWidth("");
    setHeight("");
    setShowModal(true);
  };

  /**
   * Abre el modal con los datos del formato a editar.
   *
   * @param format - Formato seleccionado.
   */
  const openEdit = (format: FormatDto) => {
    setEditing(format);
    setLabel(format.label);
    setWidth(format.widthInches != null ? String(format.widthInches) : "");
    setHeight(format.heightInches != null ? String(format.heightInches) : "");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    saveMutation.reset();
  };

  const editingSinFormato = editing != null && isSinFormatoLabel(editing.label);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Formatos de impresión</h2>
        <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo formato
        </button>
      </div>
      <p className="text-xs text-base-content/60">
        Incluye el formato base «Sin formato» (0×0) para categorías sin medidas. Los formatos
        desactivados no aparecen en nuevos pedidos; el historial conserva la etiqueta guardada.
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
              <tr key={f.id} className={f.isActive ? "" : "opacity-60"}>
                <td className="font-medium">{f.label}</td>
                <td>
                  {f.widthInches ?? "—"}&quot; × {f.heightInches ?? "—"}&quot;
                </td>
                <td>
                  {f.isSystem ? (
                    <span className="badge badge-sm badge-neutral">Base</span>
                  ) : (
                    <span className={`badge badge-sm ${f.isActive ? "badge-success" : "badge-ghost"}`}>
                      {f.isActive ? "Activo" : "Inactivo"}
                    </span>
                  )}
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
                    {!f.isSystem && f.isActive && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-warning"
                        title="Desactivar"
                        onClick={() => void deactivateMutation.mutateAsync(f.id)}
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    )}
                    {!f.isSystem && !f.isActive && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-success"
                        title="Activar"
                        onClick={() => void reactivateMutation.mutateAsync(f.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(formatsQuery.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-base-content/60">
                  No hay formatos definidos.
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
            <h3 className="text-lg font-bold">{editing ? "Editar formato" : "Nuevo formato"}</h3>
            <p className="mt-1 text-sm text-base-content/60">
              {editingSinFormato
                ? "Formato base para categorías sin medidas. La etiqueta no se puede cambiar."
                : "Indica la etiqueta (ej. 8x10) y las dimensiones en pulgadas."}
            </p>
            <div className="mt-4 space-y-3">
              <label className="form-control">
                <span className="label-text">Etiqueta *</span>
                <input
                  className="input input-bordered"
                  value={label}
                  autoComplete="off"
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej. 8x10"
                  disabled={editingSinFormato}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="label-text">Ancho (pulgadas) *</span>
                  <input
                    className="input input-bordered"
                    inputMode="decimal"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder={editingSinFormato ? "0" : "8"}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Alto (pulgadas) *</span>
                  <input
                    className="input input-bordered"
                    inputMode="decimal"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder={editingSinFormato ? "0" : "10"}
                  />
                </label>
              </div>
            </div>
            {saveMutation.isError && (
              <p className="mt-2 text-sm text-error">
                {(saveMutation.error as Error)?.message ?? "No se pudo guardar el formato."}
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
                  "Crear formato"
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
