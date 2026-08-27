import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatsForItemSelect,
  isSinFormatoLabel,
  resolveFormatSelection,
  SIN_FORMATO_LABEL,
} from "@/lib/formats";

interface FormatCatalogRow {
  id: number;
  label: string;
  isActive: boolean;
  isSystem: boolean;
}

interface FormatSelectProps {
  id?: string;
  value: number | null;
  onChange: (formatId: number) => void;
  /** En alta: ignora un valor previo y deja «Sin formato» hasta que el usuario elija. */
  preferDefault?: boolean;
  /** Se llama solo cuando el usuario cambia el select (no el valor por defecto). */
  onUserSelect?: () => void;
  /** Formato actual aunque no esté en el catálogo activo (edición). */
  fallback?: { id: number; label: string } | null;
}

/**
 * Selector de formatos del catálogo de Configuración.
 * Incluye siempre «Sin formato» y lo deja seleccionado si no hay valor.
 *
 * @param props - Valor, callback y formato de respaldo.
 * @returns Select de formatos.
 */
export function FormatSelect(props: FormatSelectProps) {
  const { id = "format-select", value, onChange, preferDefault = false, onUserSelect, fallback } =
    props;
  const formatsQuery = useQuery({
    queryKey: ["formats", "item-select"],
    queryFn: () => invoke<FormatCatalogRow[]>("get_formats", { activeOnly: false }),
  });

  const options = useMemo(() => {
    const list = formatsForItemSelect(formatsQuery.data ?? []);
    if (fallback && !list.some((formato) => formato.id === fallback.id)) {
      return [
        { id: fallback.id, label: `${fallback.label} (inactivo)`, isActive: false, isSystem: false },
        ...list,
      ];
    }
    return list;
  }, [formatsQuery.data, fallback]);

  const selectedId = resolveFormatSelection(options, preferDefault ? null : value);
  const selectValue = selectedId != null ? String(selectedId) : "";

  useEffect(() => {
    if (selectedId != null && selectedId !== value) {
      onChange(selectedId);
    }
  }, [onChange, selectedId, value]);

  return (
    <select
      id={id}
      className="select select-bordered w-full"
      value={selectValue}
      onChange={(e) => {
        const idNum = Number.parseInt(e.target.value, 10);
        if (Number.isFinite(idNum) && idNum > 0) {
          onChange(idNum);
          onUserSelect?.();
        }
      }}
    >
      {options.length === 0 && <option value="">{SIN_FORMATO_LABEL}</option>}
      {options.map((formato) => (
        <option key={formato.id} value={String(formato.id)}>
          {isSinFormatoLabel(formato.label) ? SIN_FORMATO_LABEL : formato.label}
        </option>
      ))}
    </select>
  );
}
