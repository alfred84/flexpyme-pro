import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { fetchClients } from "@/db/queries/clients";
import { invoke } from "@tauri-apps/api/core";
import {
  createWorkBatch,
  fetchCostListForWorkType,
  fetchEmployeeById,
} from "@/db/queries/employees";
import { pushFlashMessage } from "@/lib/flash-message";
import { todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";

interface WorkTypeOption {
  id: number;
  name: string;
  code: string;
}

/**
 * Registro de un lote de trabajo de un empleado: tipo, fecha, cliente y
 * cantidades por formato (con costo automático desde `cost_list`).
 *
 * @returns Página de registro de lote.
 */
export function EmployeeWorkBatchPage() {
  const params = useParams({ strict: false }) as { employeeId?: string };
  const employeeId = Number(params.employeeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const workTypesQuery = useQuery({
    queryKey: ["work-types", "active"],
    queryFn: () => invoke<WorkTypeOption[]>("get_work_types", { activeOnly: true }),
  });
  const [workTypeId, setWorkTypeId] = useState(1);
  const selectedWorkType = workTypesQuery.data?.find((w) => w.id === workTypeId);
  const [date, setDate] = useState(() => todayIso());
  const [clientId, setClientId] = useState<number | null>(null);
  const [payNow, setPayNow] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  const employeeQuery = useQuery({
    queryKey: ["employees", "detail", employeeId],
    queryFn: () => fetchEmployeeById(employeeId),
    enabled: Number.isFinite(employeeId),
  });

  const clientsQuery = useQuery({ queryKey: ["clients", "list"], queryFn: fetchClients });

  const costsQuery = useQuery({
    queryKey: ["cost-list", workTypeId],
    queryFn: () => fetchCostListForWorkType(workTypeId),
    enabled: workTypeId > 0,
  });

  const costs = useMemo(() => costsQuery.data ?? [], [costsQuery.data]);

  const total = useMemo(
    () =>
      costs.reduce((acc, cost) => {
        const qty = Number(quantities[cost.formatId] ?? "0") || 0;
        return acc + qty * cost.unitCost;
      }, 0),
    [costs, quantities],
  );

  const mutation = useMutation({
    mutationFn: createWorkBatch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees", "batches", employeeId] });
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      pushFlashMessage({ kind: "success", text: "Lote registrado correctamente." });
      await navigate({ to: "/empleados/$employeeId", params: { employeeId: String(employeeId) } });
    },
  });

  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    if (!clientId) {
      setFormError("Selecciona un cliente para el lote.");
      return;
    }
    const items = costs
      .map((cost) => ({
        clientId,
        formatId: cost.formatId,
        category: selectedWorkType?.code ?? "laminado",
        quantity: Number(quantities[cost.formatId] ?? "0") || 0,
        unitCost: cost.unitCost,
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setFormError("Indica al menos una cantidad mayor que cero.");
      return;
    }

    await mutation.mutateAsync({
      employeeId,
      workTypeId,
      date,
      notes: null,
      payNow,
      items,
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Registrar lote</h1>
          <p className="text-sm text-base-content/60">{employeeQuery.data?.name ?? ""}</p>
        </div>
        <Link to="/empleados/$employeeId" params={{ employeeId: String(employeeId) }} className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>

      {formError && (
        <div className="alert alert-error">
          <span>{formError}</span>
        </div>
      )}
      {mutation.isError && (
        <div className="alert alert-error">
          <span>{(mutation.error as Error)?.message ?? "No se pudo registrar el lote."}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="form-control">
          <label className="label" htmlFor="batch-type">
            <span className="label-text">Tipo de trabajo</span>
          </label>
          <select
            id="batch-type"
            className="select select-bordered"
            value={workTypeId}
            onChange={(e) => setWorkTypeId(Number(e.target.value))}
          >
            {(workTypesQuery.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label" htmlFor="batch-date">
            <span className="label-text">Fecha</span>
          </label>
          <input
            id="batch-date"
            type="date"
            className="input input-bordered"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="batch-client">
            <span className="label-text">Cliente</span>
          </label>
          <select
            id="batch-client"
            className="select select-bordered"
            value={clientId ?? ""}
            onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Selecciona…</option>
            {(clientsQuery.data ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Cantidades por formato</h2>
          {costsQuery.isLoading ? (
            <p>Cargando costos...</p>
          ) : costs.length === 0 ? (
            <p className="text-sm text-base-content/60">No hay costos configurados para este tipo de trabajo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Formato</th>
                    <th className="text-right">Costo unitario</th>
                    <th className="w-32">Cantidad</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost) => {
                    const qty = Number(quantities[cost.formatId] ?? "0") || 0;
                    return (
                      <tr key={cost.formatId}>
                        <td>{cost.formatLabel}</td>
                        <td className="text-right">{formatMoney(cost.unitCost)}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-24"
                            value={quantities[cost.formatId] ?? ""}
                            onChange={(e) =>
                              setQuantities((prev) => ({ ...prev, [cost.formatId]: e.target.value }))
                            }
                          />
                        </td>
                        <td className="text-right">{formatMoney(qty * cost.unitCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-base-200 p-4">
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={payNow}
            onChange={(e) => setPayNow(e.target.checked)}
          />
          <span className="label-text">Pagar ahora (registra egreso en caja)</span>
        </label>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs uppercase text-base-content/60">Total a pagar</p>
            <p className="text-xl font-semibold">{formatMoney(total)}</p>
          </div>
          <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={handleSave}>
            {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar lote"}
          </button>
        </div>
      </div>
    </section>
  );
}
