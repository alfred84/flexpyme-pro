import { z } from "zod";

/**
 * Esquema de validación del formulario de empleado.
 */
export const employeeFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(200, "El nombre es demasiado largo"),
    roleId: z.number().int().min(1, "Selecciona un rol"),
    phone: z.string().trim().max(50, "El teléfono es demasiado largo"),
    notes: z.string().trim().max(2000, "Las notas son demasiado largas"),
    extraRoleIds: z.array(z.number().int().positive()),
    payMode: z.enum(["production", "fixed", "destajo", "monthly"]),
    fixedDailySalaryCup: z.number().finite().min(0, "El salario no puede ser negativo"),
    fixedMonthlySalaryCup: z.number().finite().min(0, "El salario no puede ser negativo"),
  })
  .superRefine((values, ctx) => {
    if (values.extraRoleIds.includes(values.roleId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extraRoleIds"],
        message: "Un rol adicional no puede coincidir con el rol principal",
      });
    }
    if (
      (values.payMode === "fixed" || values.payMode === "destajo") &&
      values.fixedDailySalaryCup <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fixedDailySalaryCup"],
        message:
          values.payMode === "destajo"
            ? "Indica un importe de destajo mayor que cero"
            : "Indica un salario fijo diario mayor que cero",
      });
    }
    if (values.payMode === "monthly" && values.fixedMonthlySalaryCup <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fixedMonthlySalaryCup"],
        message: "Indica un salario fijo mensual mayor que cero",
      });
    }
  });

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
