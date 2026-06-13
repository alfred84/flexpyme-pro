import { useQuery } from "@tanstack/react-query";
import { fetchUnits } from "@/db/queries/units";
import type { UnitType } from "@/types/unit";

const TYPE_LABELS: Record<UnitType, string> = {
  cantidad: "Cantidad",
  peso: "Peso",
  volumen: "Volumen",
  longitud: "Longitud",
  area: "Área",
};

interface UnitSelectProps {
  value: number | null;
  onChange: (unitId: number) => void;
  id?: string;
}

/**
 * Selector de unidades activas agrupadas por tipo.
 *
 * @param props - Valor seleccionado y callback de cambio.
 * @returns Elemento select con optgroups.
 */
export function UnitSelect(props: UnitSelectProps) {
  const { value, onChange, id = "unit-select" } = props;
  const unitsQuery = useQuery({
    queryKey: ["units", "active"],
    queryFn: () => fetchUnits(true, null),
  });
  const units = unitsQuery.data ?? [];
  const grouped = (["cantidad", "peso", "volumen", "longitud", "area"] as UnitType[]).map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: units.filter((u) => u.unitType === type),
  }));

  return (
    <select
      id={id}
      className="select select-bordered w-full"
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="" disabled>
        Selecciona unidad
      </option>
      {grouped.map(
        (group) =>
          group.items.length > 0 && (
            <optgroup key={group.type} label={group.label}>
              {group.items.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.abbreviation})
                </option>
              ))}
            </optgroup>
          ),
      )}
    </select>
  );
}
