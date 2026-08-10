import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { UserCog } from "lucide-react";
import {
  createWorkBatch,
  fetchCostListForWorkType,
  fetchEmployees,
  fetchWorkBatchesForInvoice,
} from "@/db/queries/employees";
import { serviceMatchesWorkType } from "@/features/invoices/lib/work-type-match";
import { pushFlashMessage } from "@/lib/flash-message";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { InvoiceItemDto } from "@/types/invoice";

interface WorkTypeOption {
  id: number;
  name: string;
  code: string;
}

interface InvoiceWorkPanelProps {
  invoiceId: number;
  clientId: number;
  items: InvoiceItemDto[];
}

/**
 * Panel para registrar trabajo de empleados vinculado a un pedido.
 *
 * @param props - Identificador del pedido, cliente y líneas del pedido.
 * @returns Sección de registro e historial de lotes de trabajo.
 */
export function InvoiceWorkPanel(props: InvoiceWorkPanelProps) {
  const { invoiceId, clientId, items } = props;
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => fetchEmployees(true),
  });
  const workTypesQuery = useQuery({
    queryKey: ["work-types", "active"],
    queryFn: () => invoke<WorkTypeOption[]>("get_work_types", { activeOnly: true }),
  });
  const batchesQuery = useQuery({
    queryKey: ["employees", "batches", "invoice", invoiceId],
    queryFn: () => fetchWorkBatchesForInvoice(invoiceId),
  });

  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [workTypeId, setWorkTypeId] = useState(1);
  const [date, setDate] = useState(() => todayIso());
  const [payNow, setPayNow] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const selectedWorkType = workTypesQuery.data?.find((type) => type.id === workTypeId);
  const costsQuery = useQuery({
    queryKey: ["cost-list", workTypeId],
    queryFn: () => fetchCostListForWorkType(workTypeId),
    enabled: workTypeId > 0,
  });
  const costs = useMemo(() => costsQuery.data ?? [], [costsQuery.data]);
  const costByFormat = useMemo(
    () => new Map(costs.map((cost) => [cost.formatId, cost.unitCost])),
    [costs],
  );

  const eligibleLines = useMemo(
    () => items.filter((line) => line.formatId != null),
    [items],
  );

  useEffect(() => {
    if (!selectedWorkType) {
      return;
    }
    setQuantities((prev) => {
      const next = { ...prev };
      for (const line of eligibleLines) {
        if (serviceMatchesWorkType(line.service, selectedWorkType.code, selectedWorkType.name)) {
          next[line.id] = String(line.quantity);
        } else if (next[line.id] === undefined) {
          next[line.id] = "";
        }
      }
      return next;
    });
  }, [eligibleLines, selectedWorkType?.code, selectedWorkType]);

  const total = useMemo(
    () =>
      eligibleLines.reduce((acc, line) => {
        const qty = Number(quantities[line.id] ?? "0") || 0;
        const unitCost = line.formatId ? (costByFormat.get(line.formatId) ?? 0) : 0;
        return acc + qty * unitCost;
      }, 0),
    [eligibleLines, quantities, costByFormat],
  );

  const saveMutation = useMutation({
    mutationFn: createWorkBatch,
    onSuccess: async () => {
      setQuantities({});
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employees", "batches", "invoice", invoiceId] }),
        queryClient.invalidateQueries({ queryKey: ["cashflow"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      pushFlashMessage({ kind: "success", text: "Trabajo registrado correctamente." });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const handleSave = async () => {
    setFormError(null);
    if (!employeeId) {
      setFormError("Selecciona un empleado.");
      return;
    }
    if (!selectedWorkType) {
      setFormError("Selecciona un tipo de trabajo.");
      return;
    }

    const batchItems = eligibleLines
      .map((line) => {
        const quantity = Number(quantities[line.id] ?? "0") || 0;
        if (quantity <= 0 || line.formatId == null) {
          return null;
        }
        const unitCost = costByFormat.get(line.formatId);
        if (unitCost == null) {
          return null;
        }
        return {
          clientId,
          formatId: line.formatId,
          category: selectedWorkType.code,
          quantity,
          unitCost,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    if (batchItems.length === 0) {
      setFormError("Indica al menos una cantidad con costo configurado para este tipo de trabajo.");
      return;
    }

    await saveMutation.mutateAsync({
      employeeId,
      workTypeId,
      date,
      notes: null,
      payNow,
      invoiceId,
      items: batchItems,
    });
  };

  const batches = batchesQuery.data ?? [];

  return (
    <div className="space-y-4 rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex items-center gap-2">
        <UserCog className="h-5 w-5" />
        <div>
          <h2 className="text-lg font-semibold">Registrar trabajo</h2>
          <p className="text-sm text-base-content/70">
            Vincula el salario del empleado con las líneas de este pedido.
          </p>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Tipo</th>
                <th className="text-right">{moneyHeading("Total")}</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDate(batch.date)}</td>
                  <td>{batch.employeeName}</td>
                  <td>{batch.workType}</td>
                  <td className="text-right">{formatAmount(batch.totalCost)}</td>
                  <td>
                    <span
                      className={`badge badge-sm ${batch.status === "pagado" ? "badge-success" : "badge-warning"}`}
                    >
                      {batch.status === "pagado" ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formError && (
        <div className="alert alert-error">
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="form-control w-full">
          <span className="label-text">Empleado</span>
          <select
            className="select select-bordered select-sm"
            value={employeeId ?? ""}
            onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Seleccionar...</option>
            {(employeesQuery.data ?? []).map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
                {employee.role ? ` (${employee.role})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control w-full">
          <span className="label-text">Tipo de trabajo</span>
          <select
            className="select select-bordered select-sm"
            value={workTypeId}
            onChange={(e) => setWorkTypeId(Number(e.target.value))}
          >
            {(workTypesQuery.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control w-full">
          <span className="label-text">Fecha</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {eligibleLines.length === 0 ? (
        <p className="text-sm text-base-content/60">
          Este pedido no tiene líneas con formato; no se puede calcular la tarifa de mano de obra.
        </p>
      ) : costsQuery.isLoading ? (
        <p className="text-sm">Cargando tarifas...</p>
      ) : costs.length === 0 ? (
        <p className="text-sm text-base-content/60">
          No hay tarifas de pago configuradas para este tipo de trabajo. Defínelas en Precios.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Línea</th>
                <th>Tipo de trabajo</th>
                <th className="text-right">Pedido</th>
                <th className="text-right">{moneyHeading("Tarifa")}</th>
                <th className="w-28">Cant. trabajo</th>
                <th className="text-right">{moneyHeading("Subtotal")}</th>
              </tr>
            </thead>
            <tbody>
              {eligibleLines.map((line) => {
                const qty = Number(quantities[line.id] ?? "0") || 0;
                const unitCost = line.formatId ? (costByFormat.get(line.formatId) ?? null) : null;
                const matches = selectedWorkType
                  ? serviceMatchesWorkType(line.service, selectedWorkType.code, selectedWorkType.name)
                  : false;
                return (
                  <tr key={line.id} className={matches ? "bg-primary/5" : ""}>
                    <td>
                      {line.categoryName}
                      {line.formatLabel ? ` · ${line.formatLabel}` : ""}
                    </td>
                    <td>{line.service ?? "—"}</td>
                    <td className="text-right">{line.quantity}</td>
                    <td className="text-right">
                      {unitCost != null ? formatAmount(unitCost) : "—"}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="input input-bordered input-sm w-24"
                        value={quantities[line.id] ?? ""}
                        disabled={unitCost == null}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="text-right">
                      {unitCost != null ? formatAmount(qty * unitCost) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-base-200 p-4">
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={payNow}
            onChange={(e) => setPayNow(e.target.checked)}
          />
          <span className="label-text">Pagar ahora (egreso en caja)</span>
        </label>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs uppercase text-base-content/60">{moneyHeading("Total a pagar")}</p>
            <p className="text-xl font-semibold">{formatAmount(total)}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveMutation.isPending || total <= 0}
            onClick={() => void handleSave()}
          >
            {saveMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
