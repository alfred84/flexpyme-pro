import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { employeeFormSchema, type EmployeeFormValues } from "@/features/employees/employee.schema";

export interface EmployeeFormProps {
  defaultValues?: Partial<EmployeeFormValues>;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
  isSubmitting?: boolean;
}

const ROLE_OPTIONS = [
  { value: "laminador", label: "Laminador" },
  { value: "enmarcador", label: "Enmarcador" },
  { value: "impresor", label: "Impresor" },
  { value: "otro", label: "Otro" },
];

/**
 * Formulario compartido de empleado (alta/edición) con RHF + Zod.
 *
 * @param props - Valores iniciales, handlers y estado de envío.
 * @returns Formulario de empleado.
 */
export function EmployeeForm(props: EmployeeFormProps) {
  const { defaultValues, onSubmit, onCancel, submitLabel, isSubmitting } = props;
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      role: defaultValues?.role ?? "",
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
          disabled={isSubmitting}
          {...form.register("role")}
        >
          <option value="">Sin especificar</option>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
