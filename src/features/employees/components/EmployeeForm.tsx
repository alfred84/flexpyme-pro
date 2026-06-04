import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { employeeFormSchema, type EmployeeFormValues } from "@/features/employees/employee.schema";
import { fetchEmployeeRoles } from "@/db/queries/employee-roles";

export interface EmployeeFormProps {
  defaultValues?: Partial<EmployeeFormValues>;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
  isSubmitting?: boolean;
}

/**
 * Formulario compartido de empleado (alta/edición) con RHF + Zod.
 *
 * @param props - Valores iniciales, handlers y estado de envío.
 * @returns Formulario de empleado.
 */
export function EmployeeForm(props: EmployeeFormProps) {
  const { defaultValues, onSubmit, onCancel, submitLabel, isSubmitting } = props;
  const rolesQuery = useQuery({
    queryKey: ["employee-roles", "active"],
    queryFn: () => fetchEmployeeRoles(true),
  });

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      roleId: defaultValues?.roleId ?? 0,
      phone: defaultValues?.phone ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form
      className="mx-auto max-w-xl space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <div className="form-control w-full">
        <label className="label" htmlFor="employee-name">
          <span className="label-text">Nombre</span>
        </label>
        <input
          id="employee-name"
          type="text"
          className="input input-bordered w-full"
          autoComplete="off"
          disabled={isSubmitting}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <span className="label-text-alt text-error">{form.formState.errors.name.message}</span>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label" htmlFor="employee-role">
          <span className="label-text">Rol</span>
        </label>
        <select
          id="employee-role"
          className="select select-bordered w-full"
          disabled={isSubmitting || rolesQuery.isLoading}
          {...form.register("roleId", { valueAsNumber: true })}
        >
          <option value={0}>Selecciona un rol</option>
          {(rolesQuery.data ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
        {form.formState.errors.roleId && (
          <span className="label-text-alt text-error">{form.formState.errors.roleId.message}</span>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label" htmlFor="employee-phone">
          <span className="label-text">Teléfono</span>
        </label>
        <input
          id="employee-phone"
          type="text"
          className="input input-bordered w-full"
          autoComplete="tel"
          disabled={isSubmitting}
          {...form.register("phone")}
        />
      </div>

      <div className="form-control w-full">
        <label className="label" htmlFor="employee-notes">
          <span className="label-text">Notas</span>
        </label>
        <textarea
          id="employee-notes"
          className="textarea textarea-bordered w-full"
          rows={3}
          disabled={isSubmitting}
          {...form.register("notes")}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
