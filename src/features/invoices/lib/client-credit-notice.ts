import type { OverpaymentDisposition } from "@/types/invoice";

/** Umbral para mostrar importes de crédito al usuario. */
export const CLIENT_CREDIT_NOTICE_EPS = 0.01;

/**
 * Vista previa del saldo a favor del cliente en un cobro.
 */
export interface ClientCreditNotice {
  /** Crédito CUP que ya tiene el cliente. */
  existingCreditCup: number;
  /** Crédito CUP que se aplicará a este cobro. */
  creditToApplyCup: number;
  /** Crédito CUP que este cobro dejará a favor (exceso). */
  creditToAddCup: number;
  /** Crédito CUP estimado tras la operación. */
  creditAfterCup: number;
}

/**
 * Calcula cómo queda el saldo a favor si se confirma el cobro.
 *
 * @param input - Crédito actual, pendiente, recibido y disposición del exceso.
 * @returns Importes de crédito a mostrar en el aviso.
 */
export function previewClientCreditNotice(input: {
  existingCreditCup: number;
  applyClientCredit: boolean;
  balanceDueCup: number;
  receivedCupEquiv: number;
  overpaymentDisposition: OverpaymentDisposition;
}): ClientCreditNotice {
  const existingCreditCup = Math.max(0, input.existingCreditCup);
  const balanceDueCup = Math.max(0, input.balanceDueCup);
  const receivedCupEquiv = Math.max(0, input.receivedCupEquiv);
  const creditToApplyCup = input.applyClientCredit
    ? Math.min(existingCreditCup, balanceDueCup)
    : 0;
  const effectiveDue = Math.max(0, balanceDueCup - creditToApplyCup);
  const excess = Math.max(0, receivedCupEquiv - effectiveDue);
  const creditToAddCup = input.overpaymentDisposition === "credit" ? excess : 0;
  return {
    existingCreditCup,
    creditToApplyCup,
    creditToAddCup,
    creditAfterCup: Math.max(0, existingCreditCup - creditToApplyCup + creditToAddCup),
  };
}

/**
 * Une el cobro principal con un anticipo en la misma operación.
 *
 * @param checkout - Vista previa del cobro del saldo.
 * @param extraCreditToAddCup - Exceso del anticipo dejado a favor.
 * @returns Vista previa combinada.
 */
export function mergeAdvanceCreditIntoNotice(
  checkout: ClientCreditNotice,
  extraCreditToAddCup: number,
): ClientCreditNotice {
  const extra = Math.max(0, extraCreditToAddCup);
  return {
    ...checkout,
    creditToAddCup: checkout.creditToAddCup + extra,
    creditAfterCup: checkout.creditAfterCup + extra,
  };
}

/**
 * Indica si conviene avisar al usuario antes de cobrar.
 *
 * @param notice - Vista previa de crédito.
 * @returns `true` si hay saldo actual o el cobro va a generar saldo a favor.
 */
export function shouldShowClientCreditNotice(notice: ClientCreditNotice): boolean {
  return (
    notice.existingCreditCup > CLIENT_CREDIT_NOTICE_EPS ||
    notice.creditToAddCup > CLIENT_CREDIT_NOTICE_EPS
  );
}
