import { formatMoney } from "@/lib/format-money";

/** Umbral para tratar importes casi cero como «Al Día». */
const BALANCE_EPS = 1e-6;

/**
 * Estado visual del balance del cliente (perspectiva del cliente).
 * En BD: `balance > 0` = deuda; `balance < 0` = saldo a favor.
 */
export type ClientBalanceStatus = "deuda" | "saldo" | "al_dia";

/**
 * Resuelve el estado del cliente según el balance almacenado.
 *
 * @param balance - Balance en BD (`> 0` deuda, `< 0` saldo a favor).
 * @returns Estado para badge y estilos.
 */
export function resolveClientBalanceStatus(balance: number): ClientBalanceStatus {
  if (balance > BALANCE_EPS) {
    return "deuda";
  }
  if (balance < -BALANCE_EPS) {
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
 * @param balance - Balance almacenado en BD.
 * @returns Texto, clases CSS y estado.
 */
export function formatClientBalanceDisplay(balance: number): {
  text: string;
  className: string;
  status: ClientBalanceStatus;
} {
  const status = resolveClientBalanceStatus(balance);
  if (status === "al_dia") {
    return {
      text: formatMoney(0),
      className: "tabular-nums text-base-content/70",
      status,
    };
  }
  if (status === "deuda") {
    return {
      text: `− ${formatMoney(Math.abs(balance))}`,
      className: "tabular-nums font-medium text-error",
      status,
    };
  }
  return {
    text: `+ ${formatMoney(Math.abs(balance))}`,
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
