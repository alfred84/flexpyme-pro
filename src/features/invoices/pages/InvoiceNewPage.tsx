import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchClients } from "@/db/queries/clients";
import { createInvoice } from "@/db/queries/invoices";
import { fetchFormats, fetchProductCategories, lookupUnitPrice } from "@/db/queries/prices";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import type { CreateInvoiceItemPayload } from "@/types/invoice";

interface DraftLine {
  key: string;
  categoryId: number;
  formatId: number | null;
  finish: string;
  service: string;
  quantity: string;
  unitPrice: string;
}

function makeLine(categoryId: number): DraftLine {
  return {
    key: crypto.randomUUID(),
    categoryId,
    formatId: null,
    finish: "",
    service: "",
    quantity: "1",
    unitPrice: "",
  };
}

/**
 * Creates a new invoice with line items, totals preview, and optional price lookup.
 *
 * @returns New invoice form page.
 */
export function InvoiceNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientsQuery = useQuery({ queryKey: ["clients", "list"], queryFn: fetchClients });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchProductCategories });
  const formatsQuery = useQuery({ queryKey: ["formats"], queryFn: fetchFormats });

  const [clientId, setClientId] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [advancePayment, setAdvancePayment] = useState("0");
  const [paid, setPaid] = useState("0");
  const [lines, setLines] = useState<DraftLine[]>(() => [makeLine(1)]);
  const [formError, setFormError] = useState<string | null>(null);

  const previousDebt = useMemo(() => {
    if (!clientId) {
      return 0;
    }
    return clientsQuery.data?.find((c) => c.id === clientId)?.balance ?? 0;
  }, [clientId, clientsQuery.data]);

  const linesSubtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const q = Number.parseInt(line.quantity, 10);
      const p = Number.parseFloat(line.unitPrice.replace(",", "."));
      if (!Number.isFinite(q) || !Number.isFinite(p)) {
        return sum;
      }
      return sum + q * p;
    }, 0);
  }, [lines]);

  const advanceNum = Number.parseFloat(advancePayment.replace(",", ".")) || 0;
  const paidNum = Number.parseFloat(paid.replace(",", ".")) || 0;
  const total = linesSubtotal + previousDebt - advanceNum;
  const balance = total - paidNum;

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      pushFlashMessage({ kind: "success", text: `Pedido ${res.invoiceNumber} creado correctamente.` });
      await navigate({ to: "/pedidos/$invoiceId", params: { invoiceId: String(res.id) } });
    },
  });

  const applyPrice = async (lineKey: string) => {
    const line = lines.find((l) => l.key === lineKey);
    if (!line?.categoryId) {
      return;
    }
    const price = await lookupUnitPrice({
      categoryId: line.categoryId,
      formatId: line.formatId,
      finish: line.finish.trim() || null,
      service: line.service.trim() || null,
    });
    if (price === null) {
      setFormError("No hay precio en lista para esa combinación.");
      return;
    }
    setFormError(null);
    setLines((prev) => prev.map((l) => (l.key === lineKey ? { ...l, unitPrice: String(price) } : l)));
  };

  const addLine = () => {
    const cat = categoriesQuery.data?.[0]?.id ?? 1;
    setLines((prev) => [...prev, makeLine(cat)]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleSubmit = () => {
    mutation.reset();
    setFormError(null);
    if (!clientId) {
      setFormError("Selecciona un cliente.");
      return;
    }
    const items: CreateInvoiceItemPayload[] = [];
    for (const line of lines) {
      if (!line.categoryId) {
        setFormError("Cada línea debe tener categoría.");
        return;
      }
      const qty = Number.parseInt(line.quantity, 10);
      const unit = Number.parseFloat(line.unitPrice.replace(",", "."));
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("Revisa las cantidades.");
        return;
      }
      if (!Number.isFinite(unit) || unit < 0) {
        setFormError("Revisa los precios unitarios.");
        return;
      }
      items.push({
        categoryId: line.categoryId,
        formatId: line.formatId,
        finish: line.finish.trim() || null,
        service: line.service.trim() || null,
        quantity: qty,
        unitPrice: unit,
      });
    }
    if (advanceNum < 0 || paidNum < 0) {
      setFormError("Anticipado y pagado no pueden ser negativos.");
      return;
    }
    if (paidNum - total > 1e-6) {
      setFormError("El pagado no puede ser mayor que el total.");
      return;
    }
    void mutation.mutateAsync({
      clientId,
      date,
      notes: notes.trim() || null,
      advancePayment: advanceNum,
      paid: paidNum,
      items,
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Nuevo pedido</h1>
          <p className="text-sm text-base-content/70">Líneas de detalle del pedido y totales.</p>
        </div>
        <Link to="/pedidos" className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>

      {(formError || mutation.isError) && (
        <div className="alert alert-error">
          <span>
            {formError ??
              (mutation.error instanceof Error ? mutation.error.message : "Error al guardar la factura")}
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-3">
              <h2 className="card-title text-base">Encabezado</h2>
              <div className="form-control">
                <label className="label" htmlFor="inv-client">
                  <span className="label-text">Cliente</span>
                </label>
                <select
                  id="inv-client"
                  className="select select-bordered"
                  value={clientId ? String(clientId) : ""}
                  onChange={(e) => setClientId(e.target.value === "" ? 0 : Number(e.target.value))}
                >
                  <option value="">— Seleccionar —</option>
                  {(clientsQuery.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control max-w-xs">
                <label className="label" htmlFor="inv-date">
                  <span className="label-text">Fecha</span>
                </label>
                <input id="inv-date" type="date" className="input input-bordered" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label" htmlFor="inv-notes">
                  <span className="label-text">Notas</span>
                </label>
                <textarea id="inv-notes" className="textarea textarea-bordered" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
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

              {lines.map((line) => (
                <div key={line.key} className="rounded-lg border border-base-300 p-4 space-y-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="form-control">
                      <span className="label-text text-xs">Categoría</span>
                      <select
                        className="select select-bordered select-sm"
                        value={line.categoryId}
                        onChange={(e) => updateLine(line.key, { categoryId: Number(e.target.value) })}
                      >
                        {(categoriesQuery.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control">
                      <span className="label-text text-xs">Formato</span>
                      <select
                        className="select select-bordered select-sm"
                        value={line.formatId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateLine(line.key, { formatId: v === "" ? null : Number(v) });
                        }}
                      >
                        <option value="">— Ninguno —</option>
                        {(formatsQuery.data ?? []).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control">
                      <span className="label-text text-xs">Servicio</span>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={line.service}
                        onChange={(e) => updateLine(line.key, { service: e.target.value })}
                        placeholder="ej. impresion"
                      />
                    </div>
                    <div className="form-control">
                      <span className="label-text text-xs">Acabado</span>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={line.finish}
                        onChange={(e) => updateLine(line.key, { finish: e.target.value })}
                        placeholder="ej. brillo"
                      />
                    </div>
                    <div className="form-control">
                      <span className="label-text text-xs">Cantidad</span>
                      <input
                        type="number"
                        min={1}
                        className="input input-bordered input-sm"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="form-control">
                      <span className="label-text text-xs">Precio unitario</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input input-bordered input-sm"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-xs btn-ghost" onClick={() => void applyPrice(line.key)}>
                      Aplicar precio de lista
                    </button>
                    <button type="button" className="btn btn-xs btn-error btn-outline" onClick={() => removeLine(line.key)}>
                      Quitar línea
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow h-fit lg:sticky lg:top-4">
          <div className="card-body space-y-2 text-sm">
            <h2 className="card-title text-base">Resumen</h2>
            <p className="text-xs text-base-content/60">Deuda anterior = balance actual del cliente al guardar.</p>
            <div className="flex justify-between">
              <span>Subtotal líneas</span>
              <span>{formatMoney(linesSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Deuda anterior</span>
              <span>{formatMoney(previousDebt)}</span>
            </div>
            <div className="form-control">
              <label className="label py-0" htmlFor="inv-advance">
                <span className="label-text">Anticipado</span>
              </label>
              <input
                id="inv-advance"
                type="text"
                inputMode="decimal"
                className="input input-bordered input-sm"
                value={advancePayment}
                onChange={(e) => setAdvancePayment(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label py-0" htmlFor="inv-paid">
                <span className="label-text">Pagado</span>
              </label>
              <input
                id="inv-paid"
                type="text"
                inputMode="decimal"
                className="input input-bordered input-sm"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
            <div className="divider my-1" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            <div className="flex justify-between text-primary">
              <span>Pendiente</span>
              <span>{formatMoney(balance)}</span>
            </div>
            <button type="button" className="btn btn-primary mt-2" disabled={mutation.isPending} onClick={handleSubmit}>
              {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar factura"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
