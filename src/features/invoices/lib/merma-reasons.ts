import type { MermaReasonCode } from "@/types/inventory";

/** Opción de motivo de merma en producción. */
export interface MermaReasonOption {
  code: MermaReasonCode;
  label: string;
}

/**
 * Motivos de merma disponibles al registrar (códigos persistidos).
 */
export const MERMA_REASON_OPTIONS: readonly MermaReasonOption[] = [
  { code: "error_impresion", label: "Error de impresión" },
  { code: "material_defectuoso", label: "Material defectuoso" },
  { code: "error_corte", label: "Error de corte" },
  { code: "otro", label: "Otro" },
] as const;
