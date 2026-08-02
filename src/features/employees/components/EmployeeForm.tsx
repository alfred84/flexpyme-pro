import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
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
      extraRoleIds: defaultValues?.extraRoleIds ?? [],
      payMode: defaultValues?.payMode ?? "production",
      fixedDailySalaryCup: defaultValues?.fixedDailySalaryCup ?? 0,
    },
  });

  const roleId = useWatch({ control: form.control, name: "roleId" });
  const payMode = useWatch({ control: form.control, name: "payMode" });
  const roles = rolesQuery.data ?? [];
  const extraRoleOptions = roles.filter((r) => r.id !== roleId);

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
          <span className="label-text">Rol principal</span>
        </label>
        <select
          id="employee-role"
          className="select select-bordered w-full"
          disabled={isSubmitting || rolesQuery.isLoading}
          {...form.register("roleId", {
            valueAsNumber: true,
            onChange: (event) => {
              const nextRoleId = Number(event.target.value);
              const currentExtras = form.getValues("extraRoleIds");
              form.setValue(
                "extraRoleIds",
                currentExtras.filter((id) => id !== nextRoleId),
                { shouldValidate: true },
              );
            },
          })}
        >
          <option value={0}>Selecciona un rol</option>
          {roles.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
        {form.formState.errors.roleId && (
          <span className="label-text-alt text-error">{form.formState.errors.roleId.message}</span>
        )}
      </div>

      <fieldset className="form-control w-full">
        <legend className="label px-0">
          <span className="label-text">Roles adicionales</span>
        </legend>
        <p className="mb-2 text-xs text-base-content/60">
          Marca los roles que este empleado puede cubrir además del principal (opcional).
        </p>
        {rolesQuery.isLoading && <p className="text-sm text-base-content/50">Cargando roles…</p>}
        {!rolesQuery.isLoading && extraRoleOptions.length === 0 && (
          <p className="text-sm text-base-content/50">
            {roleId
              ? "No hay otros roles activos para asignar."
              : "Selecciona primero el rol principal."}
          </p>
        )}
        <Controller
          control={form.control}
          name="extraRoleIds"
          render={({ field }) => (
            <div className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-100 p-3">
              {extraRoleOptions.map((opt) => {
                const checked = field.value.includes(opt.id);
                return (
                  <label key={opt.id} className="label cursor-pointer justify-start gap-3 py-1">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      disabled={isSubmitting}
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          field.onChange([...field.value, opt.id]);
                        } else {
                          field.onChange(field.value.filter((id) => id !== opt.id));
                        }
                      }}
                    />
                    <span className="label-text capitalize">{opt.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        />
        {form.formState.errors.extraRoleIds && (
          <span className="label-text-alt text-error">
            {form.formState.errors.extraRoleIds.message}
          </span>
        )}
      </fieldset>

      <fieldset className="rounded-lg border border-base-300 bg-base-100 p-3 space-y-3">
        <legend className="label px-0 pb-0">
          <span className="label-text font-medium">Forma de salario</span>
        </legend>
        <p className="text-xs text-base-content/60">
          Elige cómo se calcula el pago diario. Las opciones son excluyentes.
        </p>
        <Controller
          control={form.control}
          name="payMode"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <label className="label cursor-pointer justify-start gap-3 py-1">
                <input
                  type="radio"
                  className="radio radio-sm radio-primary"
                  disabled={isSubmitting}
                  checked={field.value === "production"}
                  onChange={() => {
                    field.onChange("production");
                    form.setValue("fixedDailySalaryCup", 0, { shouldValidate: true });
                  }}
                />
                <span className="label-text">
                  <span className="font-medium">Por producción</span>
                  <span className="mt-0.5 block text-xs text-base-content/60">
                    Cobra según las tarifas de los trabajos realizados.
                  </span>
                </span>
              </label>
              <label className="label cursor-pointer justify-start gap-3 py-1">
                <input
                  type="radio"
                  className="radio radio-sm radio-primary"
                  disabled={isSubmitting}
                  checked={field.value === "fixed"}
                  onChange={() => field.onChange("fixed")}
                />
                <span className="label-text">
                  <span className="font-medium">Salario fijo diario</span>
                  <span className="mt-0.5 block text-xs text-base-content/60">
                    Cobro diario con un importe fijo predefinido.
                  </span>
                </span>
              </label>
              <label className="label cursor-pointer justify-start gap-3 py-1">
                <input
                  type="radio"
                  className="radio radio-sm radio-primary"
                  disabled={isSubmitting}
                  checked={field.value === "destajo"}
                  onChange={() => {
                    field.onChange("destajo");
                    form.setValue("fixedDailySalaryCup", 0, { shouldValidate: true });
                  }}
                />
                <span className="label-text">
                  <span className="font-medium">Salario por destajo diario</span>
                  <span className="mt-0.5 block text-xs text-base-content/60">
                    El importe se debe definir obligatoriamente cada día antes de pagar.
                  </span>
                </span>
              </label>
            </div>
          )}
        />
        {payMode === "fixed" && (
          <div className="form-control w-full">
            <label className="label" htmlFor="employee-fixed-salary">
              <span className="label-text">Importe diario (CUP)</span>
            </label>
            <input
              id="employee-fixed-salary"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="input input-bordered w-full"
              disabled={isSubmitting}
              {...form.register("fixedDailySalaryCup", { valueAsNumber: true })}
            />
            {form.formState.errors.fixedDailySalaryCup && (
              <span className="label-text-alt text-error">
                {form.formState.errors.fixedDailySalaryCup.message}
              </span>
            )}
          </div>
        )}
      </fieldset>

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
