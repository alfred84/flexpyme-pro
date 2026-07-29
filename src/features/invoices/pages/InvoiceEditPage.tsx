import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchClients } from "@/db/queries/clients";
import {
  fetchCategories,
  fetchCategoryFinishes,
  fetchAllCategoryFormats,
  fetchAllCategoryWorkTypes,
} from "@/db/queries/categories";
import { fetchInvoiceDetail, updateInvoice } from "@/db/queries/invoices";
import { fetchInventoryItems, fetchInventoryRecipes, fetchMaterialCategories } from "@/db/queries/inventory";
import { fetchFormats, fetchPrices } from "@/db/queries/prices";
import { OrderHeaderSection } from "@/features/invoices/components/OrderHeaderSection";
import { OrderLineModal } from "@/features/invoices/components/OrderLineModal";
import { OrderLinesTable } from "@/features/invoices/components/OrderLinesTable";
import { invoiceItemsToDraftLines } from "@/features/invoices/lib/invoice-to-draft";
import {
  draftLineSubtotal,
  draftLineToItems,
  isDraftLineValid,
  type DraftLine,
} from "@/features/invoices/lib/order-draft";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Edición de un pedido aún sin trabajo de producción registrado.
 * No modifica cobros ya hechos; recalcula totales y saldo.
 *
 * @returns Página de edición de pedido.
 */
export function InvoiceEditPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["invoices", "detail", invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });
  const clientsQuery = useQuery({ queryKey: ["clients", "list"], queryFn: fetchClients });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => fetchCategories(true),
  });
  const formatsQuery = useQuery({ queryKey: ["formats"], queryFn: fetchFormats });
  const pricesQuery = useQuery({
    queryKey: ["prices", "active"],
    queryFn: () => fetchPrices(false),
  });
  const categoryWorkTypesQuery = useQuery({
    queryKey: ["category-work-types"],
    queryFn: fetchAllCategoryWorkTypes,
  });
  const categoryFormatsQuery = useQuery({
    queryKey: ["category-formats"],
    queryFn: fetchAllCategoryFormats,
  });
  const categoryFinishesQuery = useQuery({
    queryKey: ["category-finishes"],
    queryFn: fetchCategoryFinishes,
  });
  const recipesQuery = useQuery({
    queryKey: ["inventory", "recipes", "active"],
    queryFn: () => fetchInventoryRecipes(true),
  });
  const inventoryItemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });
  const materialCategoriesQuery = useQuery({
    queryKey: ["inventory", "material-categories", "active"],
    queryFn: () => fetchMaterialCategories(true),
  });

  const [clientId, setClientId] = useState(0);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const detail = detailQuery.data;
    const inventoryItems = inventoryItemsQuery.data;
    if (!detail || hydrated) return;
    if (inventoryItemsQuery.isLoading) return;

    if (!detail.canEdit) {
      return;
    }

    setClientId(detail.invoice.clientId);
    setDate(detail.invoice.date.slice(0, 10));
    setNotes(detail.invoice.notes ?? "");
    setLines(invoiceItemsToDraftLines(detail.items, inventoryItems ?? []));
    setHydrated(true);
  }, [detailQuery.data, inventoryItemsQuery.data, inventoryItemsQuery.isLoading, hydrated]);

  const defaultCategoryId = categoriesQuery.data?.[0]?.id ?? 1;
  const categoryNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categoriesQuery.data ?? []) map.set(c.id, c.name);
    return map;
  }, [categoriesQuery.data]);
  const formatLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of formatsQuery.data ?? []) map.set(f.id, f.label);
    return map;
  }, [formatsQuery.data]);

  const linesSubtotal = useMemo(
    () => lines.reduce((sum, line) => sum + draftLineSubtotal(line), 0),
    [lines],
  );

  const inv = detailQuery.data?.invoice;
  const advanceNum = inv?.advancePayment ?? 0;
  const paidNum = inv?.paid ?? 0;
  const orderTotal = Math.max(linesSubtotal - advanceNum, 0);
  const pendingBalance = Math.max(orderTotal - paidNum, 0);
  const linesValid = lines.length > 0 && lines.every(isDraftLineValid);
  const canSave = clientId > 0 && linesValid && Boolean(detailQuery.data?.canEdit);

  const editingLine = editingLineKey
    ? (lines.find((l) => l.key === editingLineKey) ?? null)
    : null;

  const saveMutation = useMutation({
    mutationFn: updateInvoice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      pushFlashMessage({ kind: "success", text: "Pedido actualizado." });
      await navigate({
        to: "/pedidos/$invoiceId",
        params: { invoiceId: String(invoiceId) },
      });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const handleSaveLine = (line: DraftLine) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === line.key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = line;
        return next;
      }
      return [...prev, line];
    });
    setEditingLineKey(null);
  };

  const handleSubmit = () => {
    setFormError(null);
    if (!canSave) {
      setFormError("Completa cliente y líneas válidas.");
      return;
    }
    const items = lines.flatMap((line) =>
      draftLineToItems(line, recipesQuery.data ?? [], categoryWorkTypesQuery.data ?? []),
    );
    void saveMutation.mutateAsync({
      id: invoiceId,
      clientId,
      date,
      notes: notes.trim() || null,
      items,
    });
  };

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return <div className="alert alert-warning">Identificador de pedido no válido.</div>;
  }

  if (detailQuery.isLoading || inventoryItemsQuery.isLoading) {
    return <p>Cargando pedido…</p>;
  }

  if (detailQuery.data && !detailQuery.data.canEdit) {
    return (
      <section className="space-y-4">
        <div className="alert alert-warning">
          <span>
            {detailQuery.data.editBlockReason ?? "Este pedido no se puede editar."}
          </span>
        </div>
        <Link
          to="/pedidos/$invoiceId"
          params={{ invoiceId: String(invoiceId) }}
          className="btn btn-ghost btn-sm"
        >
          Volver al pedido
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Editar pedido</h1>
          {inv && <p className="font-mono text-base-content/70">{inv.invoiceNumber}</p>}
        </div>
        <Link
          to="/pedidos/$invoiceId"
          params={{ invoiceId: String(invoiceId) }}
          className="btn btn-ghost btn-sm"
        >
          Cancelar
        </Link>
      </div>

      <div className="alert alert-info text-sm">
        <span>
          Los cobros ya registrados no se modifican. Si reduces el total por debajo de lo pagado, no
          se permitirá guardar. El anticipo ({formatMoney(advanceNum)}) se mantiene.
        </span>
      </div>

      {(formError || saveMutation.isError) && (
        <div className="alert alert-error">
          <span>{formError ?? (saveMutation.error as Error)?.message}</span>
        </div>
      )}

      <OrderHeaderSection
        clients={clientsQuery.data ?? []}
        clientId={clientId}
        date={date}
        notes={notes}
        onClientChange={setClientId}
        onDateChange={setDate}
        onNotesChange={setNotes}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Líneas</h2>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1"
            onClick={() => {
              setEditingLineKey(null);
              setLineModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nueva línea
          </button>
        </div>
        <OrderLinesTable
          lines={lines}
          categoryNames={categoryNames}
          formatLabels={formatLabels}
          onEdit={(key) => {
            setEditingLineKey(key);
            setLineModalOpen(true);
          }}
          onRemove={(key) => setLines((prev) => prev.filter((l) => l.key !== key))}
        />
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal líneas</span>
          <span>{formatMoney(linesSubtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Anticipo</span>
          <span>{formatMoney(advanceNum)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ya pagado</span>
          <span>{formatMoney(paidNum)}</span>
        </div>
        <div className="mt-1 flex justify-between font-semibold">
          <span>Saldo estimado</span>
          <span>{formatMoney(pendingBalance)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link
          to="/pedidos/$invoiceId"
          params={{ invoiceId: String(invoiceId) }}
          className="btn btn-ghost"
        >
          Cancelar
        </Link>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave || saveMutation.isPending}
          onClick={handleSubmit}
        >
          {saveMutation.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Guardar cambios"
          )}
        </button>
      </div>

      <OrderLineModal
        open={lineModalOpen}
        editing={editingLine}
        defaultCategoryId={defaultCategoryId}
        categories={categoriesQuery.data ?? []}
        formats={formatsQuery.data ?? []}
        prices={pricesQuery.data ?? []}
        categoryWorkTypes={categoryWorkTypesQuery.data ?? []}
        categoryFormats={categoryFormatsQuery.data ?? []}
        categoryFinishes={categoryFinishesQuery.data ?? []}
        materialCategories={materialCategoriesQuery.data ?? []}
        inventoryItems={inventoryItemsQuery.data ?? []}
        recipes={recipesQuery.data ?? []}
        onClose={() => {
          setLineModalOpen(false);
          setEditingLineKey(null);
        }}
        onSave={handleSaveLine}
      />
    </section>
  );
}
