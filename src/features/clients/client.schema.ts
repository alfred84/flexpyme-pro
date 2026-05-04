import { z } from "zod";

/**
 * Zod schema for client create/update forms (Spanish validation messages).
 */
export const clientFormSchema = z.object({
  code: z.string().trim().min(1, "El codigo es obligatorio").max(32, "El codigo es demasiado largo"),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200, "El nombre es demasiado largo"),
  phone: z.string().trim().max(50, "El telefono es demasiado largo"),
  address: z.string().trim().max(500, "La direccion es demasiado larga"),
  notes: z.string().trim().max(2000, "Las notas son demasiado largas"),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
