import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { createEmployee } from "@/db/queries/employees";
import { pushFlashMessage } from "@/lib/flash-message";
import { EmployeeForm } from "@/features/employees/components/EmployeeForm";

/**
 * Alta de empleado.
 *
 * @returns Página de creación de empleado.
 */
export function EmployeeNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      pushFlashMessage({ kind: "success", text: "Empleado creado correctamente." });
      await navigate({ to: "/empleados" });
    },
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nuevo empleado</h1>
        <Link to="/empleados" className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>
      {mutation.isError && (
        <div className="alert alert-error">
          <span>{(mutation.error as Error)?.message ?? "No se pudo crear el empleado."}</span>
        </div>
      )}
      <EmployeeForm
        submitLabel="Crear empleado"
        isSubmitting={mutation.isPending}
        onCancel={() => navigate({ to: "/empleados" })}
        onSubmit={async (values) => {
          await mutation.mutateAsync({
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
    </section>
  );
}
