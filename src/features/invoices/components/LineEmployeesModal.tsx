import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  fetchEmployeesForWorkTypeName,
  type EmployeeForWorkTypeDto,
} from "@/db/queries/employee-roles";
import type { DraftServiceAssignment } from "@/features/invoices/lib/order-draft";

interface LineEmployeesModalProps {
  open: boolean;
  /** Nombre del tipo de trabajo (p.ej. Laminado). */
  workTypeName: string;
  /** Cantidad de la línea (= máximo de empleados). */
  quantity: number;
  initial: DraftServiceAssignment[];
  onClose: () => void;
  onSave: (assignments: DraftServiceAssignment[]) => void;
}

/**
 * Modal para seleccionar empleados elegibles de un tipo de trabajo y tarifa opcional.
 *
 * @param props - Props del modal.
 */
export function LineEmployeesModal(props: LineEmployeesModalProps) {
  const { open, workTypeName, quantity, initial, onClose, onSave } = props;
  const [selected, setSelected] = useState<DraftServiceAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["employees-for-work-type", workTypeName],
    queryFn: () => fetchEmployeesForWorkTypeName(workTypeName),
    enabled: open && workTypeName.trim().length > 0,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(initial.map((a) => ({ ...a })));
    setError(null);
  }, [open, initial]);

  if (!open) {
    return null;
  }

  const maxEmployees = Math.max(1, quantity);
  const byId = new Map(selected.map((a) => [a.employeeId, a]));

  /**
   * Alterna la selección de un empleado respetando el tope de cantidad.
   *
   * @param emp - Empleado elegible.
   * @param checked - Si se selecciona.
   */
  const toggleEmployee = (emp: EmployeeForWorkTypeDto, checked: boolean) => {
    setError(null);
    if (checked) {
      if (selected.length >= maxEmployees) {
        setError(
          `Solo se pueden asignar hasta ${maxEmployees} empleado(s) (uno por unidad).`,
        );
        return;
      }
      if (byId.has(emp.id)) {
        return;
      }
      setSelected((prev) => [
        ...prev,
        {
          employeeId: emp.id,
          employeeName: emp.name,
          customUnitCost: "",
        },
      ]);
      return;
    }
    setSelected((prev) => prev.filter((a) => a.employeeId !== emp.id));
  };

  /**
   * Actualiza la tarifa personalizada de un empleado.
   *
   * @param employeeId - Id del empleado.
   * @param value - Tarifa como texto.
   */
  const setTariff = (employeeId: number, value: string) => {
    setSelected((prev) =>
      prev.map((a) =>
        a.employeeId === employeeId ? { ...a, customUnitCost: value } : a,
      ),
    );
  };

  const handleSave = () => {
    if (selected.length > maxEmployees) {
      setError(
        `Solo se pueden asignar hasta ${maxEmployees} empleado(s) (uno por unidad).`,
      );
      return;
    }
    for (const a of selected) {
      const raw = a.customUnitCost.trim().replace(",", ".");
      if (raw === "") {
        continue;
      }
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        setError("La tarifa personalizada debe ser un número ≥ 0.");
        return;
      }
    }
    onSave(selected);
    onClose();
  };

  const employees = employeesQuery.data ?? [];

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-lg">Empleados — {workTypeName}</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Máximo {maxEmployees} empleado(s) según la cantidad de la línea. Solo aparecen
            trabajadores cuyo rol (principal o secundario) tiene este tipo de trabajo.
          </p>

          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {employeesQuery.isLoading && (
              <p className="text-sm text-base-content/60">Cargando empleados…</p>
            )}
            {!employeesQuery.isLoading && employees.length === 0 && (
              <p className="text-sm text-warning">
                No hay empleados elegibles. Asocia este tipo de trabajo a un rol en
                Configuración → Roles.
              </p>
            )}
            {employees.map((emp) => {
              const row = byId.get(emp.id);
              const checked = Boolean(row);
              return (
                <div
                  key={emp.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-base-300 p-2"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={checked}
                      onChange={(e) => toggleEmployee(emp, e.target.checked)}
                    />
                    <span>
                      {emp.name}
                      {emp.role ? (
                        <span className="ml-1 text-xs text-base-content/50">({emp.role})</span>
                      ) : null}
                    </span>
                  </label>
                  <label className="form-control w-28">
                    <span className="label-text text-[10px]">Tarifa CUP (opc.)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input input-bordered input-xs"
                      placeholder="Default"
                      disabled={!checked}
                      value={row?.customUnitCost ?? ""}
                      onChange={(e) => setTariff(emp.id, e.target.value)}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {error && <p className="mt-2 text-error text-sm">{error}</p>}

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Guardar
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop bg-transparent"
          aria-label="Cerrar"
          onClick={onClose}
        />
      </dialog>
    </ModalPortal>
  );
}
