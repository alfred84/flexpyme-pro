import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserCog, UserPlus } from "lucide-react";
import { deactivateEmployee, fetchEmployees, reactivateEmployee } from "@/db/queries/employees";

/**
 * Listado de empleados con alta y baja (soft delete).
 *
 * @returns Página de empleados.
 */
export function EmployeesListPage() {
  const queryClient = useQueryClient();
  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const handleDeactivate = (id: number, name: string) => {
    if (window.confirm(`¿Dar de baja a ${name}? Su historial se conserva.`)) {
      deactivateMutation.mutate(id);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserCog className="h-6 w-6" /> Empleados
        </h1>
        <Link to="/empleados/nuevo" className="btn btn-primary btn-sm gap-1">
          <UserPlus className="h-4 w-4" /> Nuevo empleado
        </Link>
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
                  <td colSpan={5} className="py-6 text-center text-base-content/60">
                    No hay empleados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
