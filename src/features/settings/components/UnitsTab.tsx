import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Power, RotateCcw } from "lucide-react";
import { createUnit, deactivateUnit, fetchUnits, reactivateUnit, updateUnit } from "@/db/queries/units";
import type { UnitDto, UnitType } from "@/types/unit";

const UNIT_TYPES: { value: UnitType | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "cantidad", label: "Cantidad" },
  { value: "peso", label: "Peso" },
  { value: "volumen", label: "Volumen" },
  { value: "longitud", label: "Longitud" },
  { value: "area", label: "Área" },
];

const TYPE_LABELS: Record<string, string> = {
  cantidad: "Cantidad",
  peso: "Peso",
  volumen: "Volumen",
  longitud: "Longitud",
  area: "Área",
};

/**
 * Tab de gestión de unidades de medida.
 *
 * @returns Tabla CRUD con filtro por tipo.
 */
export function UnitsTab() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<UnitType | "todas">("todas");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UnitDto | null>(null);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("cantidad");

  const unitsQuery = useQuery({
    queryKey: ["units", "manage", typeFilter],
    queryFn: () => fetchUnits(false, typeFilter === "todas" ? null : typeFilter),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateUnit(editing.id, { name: name.trim(), abbreviation: abbreviation.trim() });
      }
      return createUnit({ name: name.trim(), abbreviation: abbreviation.trim(), unitType });
    },
    onSuccess: async () => {
      setShowModal(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUnit,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateUnit,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });

  const rows = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setAbbreviation("");
    setUnitType("cantidad");
    setShowModal(true);
  };

  const openEdit = (row: UnitDto) => {
    setEditing(row);
    setName(row.name);
    setAbbreviation(row.abbreviation);
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Unidades de medida</h2>
        <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva unidad
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {UNIT_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`btn btn-xs ${typeFilter === t.value ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTypeFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Abr.</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono text-xs">{row.abbreviation}</td>
                <td>{TYPE_LABELS[row.unitType] ?? row.unitType}</td>
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
                  {!row.isSystem && row.isActive && (
                    <div className="flex gap-1">
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => openEdit(row)}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-warning"
                        onClick={() => void deactivateMutation.mutateAsync(row.id)}
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {!row.isSystem && !row.isActive && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-success"
                      title="Activar"
                      onClick={() => void reactivateMutation.mutateAsync(row.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{editing ? "Editar unidad" : "Nueva unidad"}</h3>
            <div className="mt-4 space-y-3">
              <label className="form-control">
                <span className="label-text">Nombre *</span>
                <input className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="form-control">
                <span className="label-text">Abreviatura *</span>
                <input className="input input-bordered" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} />
              </label>
              {!editing && (
                <label className="form-control">
                  <span className="label-text">Tipo *</span>
                  <select
                    className="select select-bordered"
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value as UnitType)}
                  >
                    {UNIT_TYPES.filter((t) => t.value !== "todas").map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {saveMutation.isError && <p className="mt-2 text-sm text-error">{(saveMutation.error as Error).message}</p>}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void saveMutation.mutateAsync()}>
                Guardar unidad
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={() => setShowModal(false)} />
        </dialog>
      )}
    </div>
  );
}
