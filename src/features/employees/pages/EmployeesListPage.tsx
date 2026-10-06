import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, UserCog, UserPlus } from "lucide-react";
import {
  deactivateEmployee,
  fetchDestajoPendingForDate,
  fetchEmployees,
  fetchFixedDailyStatusForDate,
  fetchMonthlySalaryStatusForDate,
  reactivateEmployee,
  scheduleFixedDailySalary,
  scheduleMonthlySalary,
  setDestajoDailySalary,
} from "@/db/queries/employees";
import { DestajoDefineModal } from "@/features/employees/components/DestajoDefineModal";
import { FixedDailyEnableModal } from "@/features/employees/components/FixedDailyEnableModal";
import { MonthlyEnableModal } from "@/features/employees/components/MonthlyEnableModal";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import type { EmployeePayMode } from "@/types/employee";

/** Empleado seleccionado para habilitar el salario fijo diario. */
interface FixedDailyTarget {
  employeeId: number;
  employeeName: string;
}

/** Empleado seleccionado para habilitar el salario mensual. */
interface MonthlyTarget {
  employeeId: number;
  employeeName: string;
  scheduledDate: string | null;
}

/** Empleado seleccionado para definir destajo del día. */
interface DestajoTarget {
  employeeId: number;
  employeeName: string;
  currentAmountCup: number | null;
}

/**
 * Listado de empleados con alta y baja (soft delete).
 * La nómina diaria y el historial viven en pantallas propias.
 *
 * @returns Página de empleados.
 */
export function EmployeesListPage() {
  const queryClient = useQueryClient();
  const [destajoTarget, setDestajoTarget] = useState<DestajoTarget | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
  const [fixedDailyTarget, setFixedDailyTarget] = useState<FixedDailyTarget | null>(null);
  const today = todayIso();

  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const destajoTodayQuery = useQuery({
    queryKey: ["employees", "destajo-today", today],
    queryFn: () => fetchDestajoPendingForDate(today),
  });

  const monthlyStatusQuery = useQuery({
    queryKey: ["employees", "monthly-status", today.slice(0, 7)],
    queryFn: () => fetchMonthlySalaryStatusForDate(today),
  });

  const fixedDailyStatusQuery = useQuery({
    queryKey: ["employees", "fixed-daily-status", today.slice(0, 7)],
    queryFn: () => fetchFixedDailyStatusForDate(today),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const setDestajoMutation = useMutation({
    mutationFn: setDestajoDailySalary,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
      pushFlashMessage({ kind: "success", text: "Destajo del día registrado." });
    },
  });

  const scheduleMonthlyMutation = useMutation({
    mutationFn: scheduleMonthlySalary,
    onSuccess: async (_id, variables) => {
      const date = variables.date ?? today;
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
      pushFlashMessage({
        kind: "success",
        text: `Salario mensual habilitado para el ${formatDate(date)}.`,
      });
    },
  });

  const scheduleFixedDailyMutation = useMutation({
    mutationFn: scheduleFixedDailySalary,
    onSuccess: async (_id, variables) => {
      const date = variables.date ?? today;
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
      pushFlashMessage({
        kind: "success",
        text: `Salario diario habilitado para el ${formatDate(date)}.`,
      });
    },
  });

  const destajoTodayByEmployee = useMemo(() => {
    const map = new Map<number, { amount: number; isPaid: boolean }>();
    for (const row of destajoTodayQuery.data ?? []) {
      if (row.currentAmountCup != null && row.currentAmountCup > 1e-9) {
        map.set(row.employeeId, {
          amount: row.currentAmountCup,
          isPaid: row.isPaid,
        });
      }
    }
    return map;
  }, [destajoTodayQuery.data]);

  const monthlyByEmployee = useMemo(() => {
    const map = new Map<
      number,
      { scheduledDate: string | null; isPaid: boolean }
    >();
    for (const row of monthlyStatusQuery.data ?? []) {
      map.set(row.employeeId, {
        scheduledDate: row.scheduledDate,
        isPaid: row.isPaid,
      });
    }
    return map;
  }, [monthlyStatusQuery.data]);

  const fixedDailyByEmployee = useMemo(() => {
    const map = new Map<number, { pendingDates: string[]; paidDates: string[] }>();
    for (const row of fixedDailyStatusQuery.data ?? []) {
      map.set(row.employeeId, {
        pendingDates: row.days.filter((day) => !day.isPaid).map((day) => day.date.slice(0, 10)),
        paidDates: row.days.filter((day) => day.isPaid).map((day) => day.date.slice(0, 10)),
      });
    }
    return map;
  }, [fixedDailyStatusQuery.data]);

  const handleDeactivate = (id: number, name: string) => {
    if (window.confirm(`¿Dar de baja a ${name}? Su historial se conserva.`)) {
      deactivateMutation.mutate(id);
    }
  };

  /**
   * Celda de salario según modo y destajo del día.
   *
   * @param payMode - Modo de pago.
   * @param fixedCup - Importe fijo o de referencia.
   * @param employeeId - Id del empleado.
   * @param employeeName - Nombre del empleado.
   * @param isActive - Si el empleado está activo.
   */
  const renderSalaryCell = (
    payMode: EmployeePayMode | undefined,
    fixedCup: number,
    employeeId: number,
    employeeName: string,
    isActive: boolean,
  ) => {
    if (payMode === "fixed") {
      const status = fixedDailyByEmployee.get(employeeId);
      const payrollDay = today.slice(0, 10);
      const paidThatDay = Boolean(status?.paidDates.includes(payrollDay));
      const pendingThatDay = Boolean(status?.pendingDates.includes(payrollDay));
      return (
        <div className="flex flex-wrap items-center gap-1">
          <span className="badge badge-info badge-sm">
            Fijo {formatMoney(fixedCup)}/día
          </span>
          {paidThatDay ? (
            <span className="badge badge-success badge-sm">
              Pagado {formatDate(payrollDay)}
            </span>
          ) : pendingThatDay ? (
            <span className="badge badge-info badge-sm">
              En nómina {formatDate(payrollDay)}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-outline btn-xs"
            disabled={!isActive || scheduleFixedDailyMutation.isPending}
            title="Habilitar un día trabajado en la nómina"
            onClick={() =>
              setFixedDailyTarget({
                employeeId,
                employeeName,
              })
            }
          >
            Habilitar
          </button>
        </div>
      );
    }
    if (payMode === "monthly") {
      const monthly = monthlyByEmployee.get(employeeId);
      const scheduledDate = monthly?.scheduledDate ?? null;
      const paidThisMonth = Boolean(monthly?.isPaid);
      const openMonthlyModal = () =>
        setMonthlyTarget({
          employeeId,
          employeeName,
          scheduledDate,
        });
      return (
        <div className="flex flex-wrap items-center gap-1">
          <span className="badge badge-accent badge-sm">
            Fijo {formatMoney(fixedCup)}/mes
          </span>
          {paidThisMonth ? (
            <span className="badge badge-success badge-sm">
              Pagado{scheduledDate ? ` ${formatDate(scheduledDate)}` : ""}
            </span>
          ) : scheduledDate ? (
            <button
              type="button"
              className="badge badge-info badge-sm cursor-pointer"
              disabled={!isActive}
              title="Cambiar el día en la nómina"
              onClick={openMonthlyModal}
            >
              En nómina {formatDate(scheduledDate)}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              disabled={!isActive || scheduleMonthlyMutation.isPending}
              title="Elegir el día del mes para pagar"
              onClick={openMonthlyModal}
            >
              Habilitar
            </button>
          )}
        </div>
      );
    }
    if (payMode === "destajo") {
      const todayDestajo = destajoTodayByEmployee.get(employeeId);
      return (
        <div className="flex flex-wrap items-center gap-1">
          <span className="badge badge-warning badge-sm">Destajo diario</span>
          {todayDestajo != null ? (
            <button
              type="button"
              className={`badge badge-sm cursor-pointer ${
                todayDestajo.isPaid ? "badge-success" : "badge-info"
              }`}
              title={
                todayDestajo.isPaid
                  ? "Destajo pagado (clic para ver)"
                  : "Editar destajo del día"
              }
              disabled={!isActive || todayDestajo.isPaid}
              onClick={() =>
                setDestajoTarget({
                  employeeId,
                  employeeName,
                  currentAmountCup: todayDestajo.amount,
                })
              }
            >
              {formatMoney(todayDestajo.amount)}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              disabled={!isActive}
              onClick={() =>
                setDestajoTarget({
                  employeeId,
                  employeeName,
                  currentAmountCup: fixedCup > 0 ? fixedCup : null,
                })
              }
            >
              Definir
            </button>
          )}
        </div>
      );
    }
    return <span className="text-base-content/50">Por producción</span>;
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserCog className="h-6 w-6" /> Empleados
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/empleados/nomina-diaria" className="btn btn-outline btn-sm gap-1">
            <CalendarDays className="h-4 w-4" /> Nómina diaria
          </Link>
          <Link to="/empleados/historial-nomina" className="btn btn-outline btn-sm gap-1">
            <ClipboardList className="h-4 w-4" /> Historial de nómina
          </Link>
          <Link to="/empleados/nuevo" className="btn btn-primary btn-sm gap-1">
            <UserPlus className="h-4 w-4" /> Nuevo empleado
          </Link>
        </div>
      </div>

      {employeesQuery.isLoading && <p>Cargando empleados...</p>}
      {employeesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los empleados.</span>
        </div>
      )}

      {employeesQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Roles adicionales</th>
                <th>Salario</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.data.map((emp) => (
                <tr key={emp.id} className={emp.isActive ? "" : "opacity-50"}>
                  <td className="font-medium">{emp.name}</td>
                  <td className="capitalize">{emp.role ?? "—"}</td>
                  <td>
                    {(emp.extraRoles ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {emp.extraRoles.map((role) => (
                          <span key={role} className="badge badge-ghost badge-sm capitalize">
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )}
                  </td>
                  <td className="text-xs">
                    {renderSalaryCell(
                      emp.payMode,
                      emp.payMode === "monthly"
                        ? emp.fixedMonthlySalaryCup
                        : emp.fixedDailySalaryCup,
                      emp.id,
                      emp.name,
                      emp.isActive,
                    )}
                  </td>
                  <td>{emp.phone ?? "—"}</td>
                  <td>
                    <span className={`badge badge-sm ${emp.isActive ? "badge-success" : "badge-ghost"}`}>
                      {emp.isActive ? "Activo" : "Baja"}
                    </span>
                  </td>
                  <td className="flex flex-wrap justify-end gap-1">
                    <Link
                      className="btn btn-xs btn-outline"
                      to="/empleados/$employeeId"
                      params={{ employeeId: String(emp.id) }}
                    >
                      Ver
                    </Link>
                    <Link
                      className="btn btn-xs btn-ghost"
                      to="/empleados/$employeeId/editar"
                      params={{ employeeId: String(emp.id) }}
                    >
                      Editar
                    </Link>
                    {!emp.isActive && (
                      <button
                        type="button"
                        className="btn btn-xs btn-success btn-outline"
                        disabled={reactivateMutation.isPending}
                        onClick={() => void reactivateMutation.mutateAsync(emp.id)}
                      >
                        Reactivar
                      </button>
                    )}
                    {emp.isActive && (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => handleDeactivate(emp.id, emp.name)}
                      >
                        Dar de baja
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employeesQuery.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-base-content/60">
                    No hay empleados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <MonthlyEnableModal
        open={monthlyTarget !== null}
        employeeName={monthlyTarget?.employeeName ?? ""}
        scheduledDate={monthlyTarget?.scheduledDate ?? null}
        isSubmitting={scheduleMonthlyMutation.isPending}
        onClose={() => setMonthlyTarget(null)}
        onConfirm={async (dateIso) => {
          if (!monthlyTarget) {
            return;
          }
          await scheduleMonthlyMutation.mutateAsync({
            employeeId: monthlyTarget.employeeId,
            date: dateIso,
          });
        }}
      />

      <FixedDailyEnableModal
        open={fixedDailyTarget !== null}
        employeeName={fixedDailyTarget?.employeeName ?? ""}
        referenceDate={today}
        pendingDates={
          fixedDailyTarget
            ? (fixedDailyByEmployee.get(fixedDailyTarget.employeeId)?.pendingDates ?? [])
            : []
        }
        paidDates={
          fixedDailyTarget
            ? (fixedDailyByEmployee.get(fixedDailyTarget.employeeId)?.paidDates ?? [])
            : []
        }
        isSubmitting={scheduleFixedDailyMutation.isPending}
        onClose={() => setFixedDailyTarget(null)}
        onConfirm={async (dateIso) => {
          if (!fixedDailyTarget) {
            return;
          }
          await scheduleFixedDailyMutation.mutateAsync({
            employeeId: fixedDailyTarget.employeeId,
            date: dateIso,
          });
        }}
      />

      <DestajoDefineModal
        open={destajoTarget !== null}
        employeeName={destajoTarget?.employeeName ?? ""}
        currentAmountCup={destajoTarget?.currentAmountCup ?? null}
        isSubmitting={setDestajoMutation.isPending}
        onClose={() => setDestajoTarget(null)}
        onConfirm={async (amountCup) => {
          if (!destajoTarget) {
            return;
          }
          await setDestajoMutation.mutateAsync({
            employeeId: destajoTarget.employeeId,
            date: today,
            amountCup,
          });
        }}
      />
    </section>
  );
}
