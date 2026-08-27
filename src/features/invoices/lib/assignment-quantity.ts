/**
 * Cantidad a prellenar por empleado al marcar Listo.
 * Si hay más trabajadores que unidades, colaboran en las mismas (cada uno con `pending`).
 * Si no, se reparte 1 ud. a cada uno y el resto al último (comportamiento previo).
 *
 * @param workerCount - Empleados asignados.
 * @param pending - Unidades pendientes de la línea.
 * @param index - Índice del empleado (0-based).
 * @returns Cantidad ≥ 0 para ese empleado.
 */
export function payQuantityForAssignedWorker(
  workerCount: number,
  pending: number,
  index: number,
): number {
  if (pending <= 0 || workerCount <= 0 || index < 0 || index >= workerCount) {
    return 0;
  }
  if (workerCount > pending) {
    return pending;
  }
  const isLast = index === workerCount - 1;
  if (isLast) {
    return pending - (workerCount - 1);
  }
  return 1;
}
