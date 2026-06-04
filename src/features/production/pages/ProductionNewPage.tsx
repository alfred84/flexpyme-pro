import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { fetchClients } from "@/db/queries/clients";
import { fetchFormats } from "@/db/queries/prices";
import { createProductionBatch } from "@/db/queries/production";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import type { CreateProductionItemPayload } from "@/types/production";

interface DraftLine {
  key: string;
  clientId: number;
  formatId: number | null;
  category: string;
  quantity: string;
  unitCost: string;
}

function makeLine(clientId: number): DraftLine {
  return {
    key: crypto.randomUUID(),
    clientId,
    formatId: null,
    category: "",
    quantity: "1",
    unitCost: "",
  };
}

export function ProductionNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientsQuery = useQuery({ queryKey: ["clients", "list"], queryFn: fetchClients });
  const formatsQuery = useQuery({ queryKey: ["formats"], queryFn: fetchFormats });

  const [type, setType] = useState("Tercerizada");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [workerName, setWorkerName] = useState("");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState("0");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createProductionBatch,
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["production", "list"] });
      pushFlashMessage({ kind: "success", text: "Lote de producción creado correctamente." });
      await navigate({ to: "/produccion/$batchId", params: { batchId: String(res.id) } });
    },
  });

  const addLine = () => {
    const firstClient = clientsQuery.data?.[0]?.id ?? 0;
    setLines((prev) => [...prev, makeLine(firstClient)]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const totalCost = lines.reduce((sum, line) => {
    const q = Number.parseInt(line.quantity, 10);
    const c = Number.parseFloat(line.unitCost.replace(",", "."));
    if (!Number.isFinite(q) || !Number.isFinite(c)) {
      return sum;
    }
    return sum + q * c;
  }, 0);

  const save = () => {
    setFormError(null);
    const paidNum = Number.parseFloat(paid.replace(",", ".")) || 0;
    if (paidNum < 0) {
      setFormError("El pagado no puede ser negativo.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Agrega al menos una línea.");
      return;
    }
    const items: CreateProductionItemPayload[] = [];
    for (const line of lines) {
      if (!line.clientId) {
        setFormError("Selecciona cliente en cada línea.");
        return;
      }
      const qty = Number.parseInt(line.quantity, 10);
      const unitCost = Number.parseFloat(line.unitCost.replace(",", "."));
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("Revisa cantidades.");
        return;
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        setFormError("Revisa costos unitarios.");
        return;
      }
      const category = line.category.trim();
      if (!category) {
        setFormError("La categoría es obligatoria en cada línea.");
        return;
      }
      items.push({
        clientId: line.clientId,
        formatId: line.formatId,
        category,
        quantity: qty,
        unitCost,
      });
    }
    if (paidNum - totalCost > 1e-6) {
      setFormError("El pagado no puede ser mayor que el costo total.");
      return;
    }
    void mutation.mutateAsync({
      type: type.trim(),
      date,
      workerName: workerName.trim() || null,
      notes: notes.trim() || null,
      paid: paidNum,
      items,
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Nuevo lote de producción</h1>
          <p className="text-sm text-base-content/70">Registra costos por cliente/formato.</p>
        </div>
        <Link to="/produccion" className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>

      {(formError || mutation.isError) && (
        <div className="alert alert-error">
          <span>{formError ?? (mutation.error instanceof Error ? mutation.error.message : "Error al guardar lote")}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-3">
              <h2 className="card-title text-base">Encabezado</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text">Tipo</span>
                  <input className="input input-bordered" value={type} onChange={(e) => setType(e.target.value)} />
                </label>
                <label className="form-control">
                  <span className="label-text">Fecha</span>
                  <input type="date" className="input input-bordered" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="form-control">
                  <span className="label-text">Operario (opcional)</span>
                  <input className="input input-bordered" value={workerName} onChange={(e) => setWorkerName(e.target.value)} />
                </label>
                <label className="form-control">
                  <span className="label-text">Pagado</span>
                  <input
                    className="input input-bordered"
                    inputMode="decimal"
                    value={paid}
                    onChange={(e) => setPaid(e.target.value)}
                  />
                </label>
              </div>
              <label className="form-control">
                <span className="label-text">Notas</span>
                <textarea className="textarea textarea-bordered" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base">Líneas</h2>
                <button type="button" className="btn btn-sm btn-outline" onClick={addLine}>
                  Añadir línea
                </button>
              </div>

              {lines.length === 0 && <p className="text-sm text-base-content/60">Aún no hay líneas. Pulsa "Añadir línea".</p>}

              {lines.map((line) => (
                <div key={line.key} className="rounded-lg border border-base-300 p-4 space-y-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="form-control">
                      <span className="label-text text-xs">Cliente</span>
                      <select
                        className="select select-bordered select-sm"
                        value={line.clientId ? String(line.clientId) : ""}
                        onChange={(e) => updateLine(line.key, { clientId: Number(e.target.value) || 0 })}
                      >
                        <option value="">— Seleccionar —</option>
                        {(clientsQuery.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text text-xs">Formato</span>
                      <select
                        className="select select-bordered select-sm"
                        value={line.formatId ?? ""}
                        onChange={(e) => updateLine(line.key, { formatId: e.target.value === "" ? null : Number(e.target.value) })}
                      >
                        <option value="">— Ninguno —</option>
                        {(formatsQuery.data ?? []).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text text-xs">Categoría</span>
                      <input
                        className="input input-bordered input-sm"
                        value={line.category}
                        onChange={(e) => updateLine(line.key, { category: e.target.value })}
                        placeholder="ej. Brochure"
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text text-xs">Cantidad</span>
                      <input
                        type="number"
                        min={1}
                        className="input input-bordered input-sm"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </label>
                    <label className="form-control md:col-span-2">
                      <span className="label-text text-xs">Costo unitario</span>
                      <input
                        className="input input-bordered input-sm"
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                      />
                    </label>
                  </div>
                  <button type="button" className="btn btn-xs btn-error btn-outline" onClick={() => removeLine(line.key)}>
                    Quitar línea
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow h-fit lg:sticky lg:top-4">
          <div className="card-body space-y-2 text-sm">
            <h2 className="card-title text-base">Resumen</h2>
            <div className="flex justify-between font-semibold">
              <span>Costo total</span>
              <span>{formatMoney(totalCost)}</span>
            </div>
            <button type="button" className="btn btn-primary mt-2" disabled={mutation.isPending} onClick={save}>
              {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar lote"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
