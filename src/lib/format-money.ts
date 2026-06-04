/**
 * Formato de importes con separadores en español y prefijo `$` genérico
 * (sin moneda ISO ni códigos de país como RD$).
 */
const amountFormatter = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number): string {
  return `$ ${amountFormatter.format(value)}`;
}
