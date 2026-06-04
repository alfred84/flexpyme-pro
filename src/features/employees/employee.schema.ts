import { z } from "zod";

/**
 * Esquema de validación del formulario de empleado.
 */
export const employeeFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200, "El nombre es demasiado largo"),
  roleId: z.number().int().min(1, "Selecciona un rol"),
  phone: z.string().trim().max(50, "El teléfono es demasiado largo"),
  notes: z.string().trim().max(2000, "Las notas son demasiado largas"),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
