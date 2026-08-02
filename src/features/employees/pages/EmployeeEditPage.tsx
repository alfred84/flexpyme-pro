import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { fetchEmployeeById, updateEmployee } from "@/db/queries/employees";
import { pushFlashMessage } from "@/lib/flash-message";
import { EmployeeForm } from "@/features/employees/components/EmployeeForm";

/**
 * Edición de un empleado existente.
 *
 * @returns Página de edición de empleado.
 */
export function EmployeeEditPage() {
  const params = useParams({ strict: false }) as { employeeId?: string };
  const employeeId = Number(params.employeeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const employeeQuery = useQuery({
    queryKey: ["employees", "detail", employeeId],
    queryFn: () => fetchEmployeeById(employeeId),
    enabled: Number.isFinite(employeeId),
  });

  const mutation = useMutation({
    mutationFn: updateEmployee,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      pushFlashMessage({ kind: "success", text: "Empleado actualizado." });
      await navigate({ to: "/empleados" });
    },
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar empleado</h1>
        <Link to="/empleados" className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>
      {employeeQuery.isLoading && <p>Cargando...</p>}
      {employeeQuery.data && (
        <EmployeeForm
          submitLabel="Guardar cambios"
          isSubmitting={mutation.isPending}
          defaultValues={{
            name: employeeQuery.data.name,
            roleId: employeeQuery.data.roleId ?? 0,
            phone: employeeQuery.data.phone ?? "",
            notes: employeeQuery.data.notes ?? "",
            extraRoleIds: employeeQuery.data.extraRoleIds ?? [],
            hasFixedDailySalary: employeeQuery.data.hasFixedDailySalary,
            fixedDailySalaryCup: employeeQuery.data.fixedDailySalaryCup,
          }}
          onCancel={() => navigate({ to: "/empleados" })}
          onSubmit={async (values) => {
            await mutation.mutateAsync({
              id: employeeId,
              name: values.name,
              roleId: values.roleId,
              phone: values.phone || null,
              notes: values.notes || null,
              extraRoleIds: values.extraRoleIds,
              hasFixedDailySalary: values.hasFixedDailySalary,
              fixedDailySalaryCup: values.hasFixedDailySalary
                ? values.fixedDailySalaryCup
                : 0,
            });
          }}
        />
      )}
    </section>
  );
}
