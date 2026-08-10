import { formatAmount } from "@/lib/format-money";

/** Umbral para tratar importes casi cero como «Al Día». */
const BALANCE_EPS = 1e-6;

/**
 * Estado visual del balance del cliente (perspectiva del cliente).
 * Deuda = posición neta positiva; saldo a favor = negativa; al día ≈ 0.
 */
export type ClientBalanceStatus = "deuda" | "saldo" | "al_dia";

/**
 * Posición neta en una sola moneda: deuda abierta menos crédito disponible.
 * `> 0` = debe; `< 0` = saldo a favor; `≈ 0` = al día.
 *
 * @param balance - Deuda abierta.
 * @param creditBalance - Crédito disponible.
 * @returns Posición neta con signo contable (deuda positiva).
 */
export function clientNetPosition(balance: number, creditBalance = 0): number {
  return balance - creditBalance;
}

/**
 * Posición neta dual convertida a CUP con la tasa vigente.
 * Combina deuda USD, deuda CUP y crédito CUP (solo CUP hoy).
 *
 * @param balanceUsd - Deuda abierta en USD.
 * @param balanceCup - Deuda abierta en CUP (sin restar crédito).
 * @param creditCup - Saldo a favor en CUP.
 * @param exchangeRate - Tasa USD→CUP para netear el estado.
 * @returns Posición neta en CUP (deuda positiva).
 */
export function clientDualNetPositionCup(
  balanceUsd: number,
  balanceCup: number,
  creditCup = 0,
  exchangeRate = 0,
): number {
  const cupNet = clientNetPosition(balanceCup, creditCup);
  const usdAsCup = exchangeRate > BALANCE_EPS ? balanceUsd * exchangeRate : 0;
  return cupNet + usdAsCup;
}

/**
 * Resuelve el estado del cliente según deuda/crédito en una moneda.
 *
 * @param balance - Deuda abierta.
 * @param creditBalance - Saldo a favor.
 * @returns Estado para badge y estilos.
 */
export function resolveClientBalanceStatus(
  balance: number,
  creditBalance = 0,
): ClientBalanceStatus {
  const net = clientNetPosition(balance, creditBalance);
  if (net > BALANCE_EPS) {
    return "deuda";
  }
  if (net < -BALANCE_EPS) {
    return "saldo";
  }
  return "al_dia";
}

/**
 * Estado del cliente con balances duales: convierte USD↔CUP con la tasa
 * para decidir deuda / saldo a favor / al día.
 *
 * @param balanceUsd - Deuda USD.
 * @param balanceCup - Deuda CUP.
 * @param creditCup - Crédito CUP.
 * @param exchangeRate - Tasa USD→CUP.
 * @returns Estado para badge.
 */
export function resolveDualClientBalanceStatus(
  balanceUsd: number,
  balanceCup: number,
  creditCup = 0,
  exchangeRate = 0,
): ClientBalanceStatus {
  const cupNet = clientNetPosition(balanceCup, creditCup);
  if (exchangeRate > BALANCE_EPS) {
    return resolveClientBalanceStatus(
      clientDualNetPositionCup(balanceUsd, balanceCup, creditCup, exchangeRate),
      0,
    );
  }
  // Sin tasa: no se puede netear entre monedas; prioriza señales por moneda.
  if (balanceUsd > BALANCE_EPS || cupNet > BALANCE_EPS) {
    return "deuda";
  }
  if (cupNet < -BALANCE_EPS) {
    return "saldo";
  }
  return "al_dia";
}

/**
 * Etiqueta en español del estado de balance.
 *
 * @param status - Estado resuelto.
 * @returns Texto del badge.
 */
export function clientBalanceStatusLabel(status: ClientBalanceStatus): string {
  switch (status) {
    case "deuda":
      return "Con deuda";
    case "saldo":
      return "Con saldo";
    case "al_dia":
      return "Al Día";
  }
}

/**
 * Formatea el balance para la tabla: signo explícito y color semántico.
 * Deuda se muestra como negativo (−); saldo a favor como positivo (+).
 *
 * @param balance - Deuda abierta.
 * @param creditBalance - Crédito disponible.
 * @param formatAbs - Formatea el valor absoluto.
 * @returns Texto, clases CSS y estado.
 */
export function formatClientBalanceDisplay(
  balance: number,
  creditBalance = 0,
  formatAbs: (absValue: number) => string = formatAmount,
): {
  text: string;
  className: string;
  status: ClientBalanceStatus;
} {
  const status = resolveClientBalanceStatus(balance, creditBalance);
  const net = clientNetPosition(balance, creditBalance);
  if (status === "al_dia") {
    return {
      text: formatAbs(0),
      className: "tabular-nums text-base-content/70",
      status,
    };
  }
  if (status === "deuda") {
    return {
      text: `− ${formatAbs(Math.abs(net))}`,
      className: "tabular-nums font-medium text-error",
      status,
    };
  }
  return {
    text: `+ ${formatAbs(Math.abs(net))}`,
    className: "tabular-nums font-medium text-success",
    status,
  };
}

/**
 * Clases DaisyUI del badge de estado (texto blanco sobre fondo de color).
 *
 * @param status - Estado del balance.
 * @returns Clases del badge.
 */
export function clientBalanceStatusBadgeClass(status: ClientBalanceStatus): string {
  switch (status) {
    case "deuda":
      return "badge border-0 bg-error text-white";
    case "saldo":
      return "badge border-0 bg-success text-white";
    case "al_dia":
      return "badge border-0 bg-info text-white";
  }
}
