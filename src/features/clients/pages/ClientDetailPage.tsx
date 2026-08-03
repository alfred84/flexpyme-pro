import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { ClientWorkHistorySection } from "@/features/clients/components/ClientWorkHistorySection";
import { fetchClientById, softDeleteClient } from "@/db/queries/clients";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { popFlashMessage, pushFlashMessage, type FlashMessage } from "@/lib/flash-message";

/**
 * Shows a single client profile with balance and soft-delete action.
 *
 * @returns Client detail page.
 */
export function ClientDetailPage() {
  const params = useParams({ strict: false }) as { clientId?: string };
  const clientId = Number(params.clientId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());

  const clientQuery = useQuery({
    queryKey: ["clients", "detail", clientId],
    queryFn: () => fetchClientById(clientId),
    enabled: Number.isFinite(clientId) && clientId > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteClient(clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      pushFlashMessage({ kind: "success", text: "Cliente eliminado del listado." });
      await navigate({ to: "/clientes" });
    },
  });

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de cliente no válido.</span>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cliente</h1>
          {clientQuery.data && <p className="text-lg font-medium">{clientQuery.data.name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/clientes" className="btn btn-ghost btn-sm">
            Volver al listado
          </Link>
          {clientQuery.data && (
            <Link
              to="/clientes/$clientId/editar"
              params={{ clientId: String(clientQuery.data.id) }}
              className="btn btn-outline btn-sm"
            >
              Editar
            </Link>
          )}
          {clientQuery.data && (
            <button type="button" className="btn btn-error btn-outline btn-sm" onClick={() => setShowDelete(true)}>
              Eliminar
            </button>
          )}
        </div>
      </div>

      {clientQuery.isLoading && <p>Cargando...</p>}
      {clientQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el cliente.</span>
        </div>
      )}
      {flash && (
        <div className={flash.kind === "success" ? "alert alert-success" : "alert alert-info"}>
          <span>{flash.text}</span>
        </div>
      )}

      {clientQuery.data && (
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-2">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-base-content/60">Código</dt>
                <dd className="font-mono">{clientQuery.data.code}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">{moneyHeading("Deuda abierta")}</dt>
                <dd>{formatAmount(clientQuery.data.balance)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">{moneyHeading("Saldo a favor")}</dt>
                <dd className="text-success">{formatAmount(clientQuery.data.creditBalance ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">{moneyHeading("Total histórico")}</dt>
                <dd className="font-medium tabular-nums">{formatAmount(clientQuery.data.totalHistorical)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Teléfono</dt>
                <dd>{clientQuery.data.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Actualizado</dt>
                <dd className="text-sm">{clientQuery.data.updatedAt}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-base-content/60">Dirección</dt>
                <dd>{clientQuery.data.address ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-base-content/60">Notas</dt>
                <dd className="whitespace-pre-wrap">{clientQuery.data.notes ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {clientQuery.data && (
        <ClientWorkHistorySection
          clientId={clientQuery.data.id}
          totalHistoricalHint={clientQuery.data.totalHistorical}
        />
      )}

      {showDelete && (
        <ModalPortal>
          <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold">Eliminar cliente</h3>
            <p className="py-4">Se ocultará del listado (eliminación lógica). ¿Continuar?</p>
            {deleteMutation.isError && (
              <p className="text-error text-sm">
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Error"}
              </p>
            )}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setShowDelete(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutateAsync()}
              >
                {deleteMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Eliminar"}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={() => setShowDelete(false)} />
          </dialog>
        </ModalPortal>
      )}
    </section>
  );
}
