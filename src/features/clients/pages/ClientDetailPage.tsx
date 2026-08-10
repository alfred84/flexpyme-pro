import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { ClientWorkHistorySection } from "@/features/clients/components/ClientWorkHistorySection";
import {
  clientBalanceStatusBadgeClass,
  clientBalanceStatusLabel,
  clientDualNetPositionCup,
  formatClientBalanceDisplay,
  resolveDualClientBalanceStatus,
} from "@/features/clients/lib/client-balance";
import { fetchClientById, softDeleteClient } from "@/db/queries/clients";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { popFlashMessage, pushFlashMessage, type FlashMessage } from "@/lib/flash-message";

/**
 * Ficha de cliente con balances duales (USD/CUP por cobros) y estado neto.
 *
 * @returns Página de detalle del cliente.
 */
export function ClientDetailPage() {
  const params = useParams({ strict: false }) as { clientId?: string };
  const clientId = Number(params.clientId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usdExchangeRate } = useAppSettings();
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

  const client = clientQuery.data;
  const balanceUsd = client?.balanceUsd ?? 0;
  const balanceCup = client?.balanceCup ?? 0;
  const creditCup = client?.creditBalance ?? 0;
  const status = client
    ? resolveDualClientBalanceStatus(balanceUsd, balanceCup, creditCup, usdExchangeRate)
    : "al_dia";
  const usdDisplay = formatClientBalanceDisplay(balanceUsd, 0);
  const cupDebtDisplay = formatClientBalanceDisplay(balanceCup, 0);
  const netCup = clientDualNetPositionCup(
    balanceUsd,
    balanceCup,
    creditCup,
    usdExchangeRate,
  );
  const netDisplay = formatClientBalanceDisplay(netCup, 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cliente</h1>
          {client && <p className="text-lg font-medium">{client.name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/clientes" className="btn btn-ghost btn-sm">
            Volver al listado
          </Link>
          {client && (
            <Link
              to="/clientes/$clientId/editar"
              params={{ clientId: String(client.id) }}
              className="btn btn-outline btn-sm"
            >
              Editar
            </Link>
          )}
          {client && (
            <button
              type="button"
              className="btn btn-error btn-outline btn-sm"
              onClick={() => setShowDelete(true)}
            >
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

      {client && (
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-2">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-base-content/60">Código</dt>
                <dd className="font-mono">{client.code}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Estado</dt>
                <dd>
                  <span className={clientBalanceStatusBadgeClass(status)}>
                    {clientBalanceStatusLabel(status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">
                  {moneyHeading("Deuda abierta", "USD")}
                </dt>
                <dd className={usdDisplay.className}>{usdDisplay.text}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">
                  {moneyHeading("Deuda abierta", "CUP")}
                </dt>
                <dd className={cupDebtDisplay.className}>{cupDebtDisplay.text}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">
                  {moneyHeading("Saldo a favor", "CUP")}
                </dt>
                <dd className="tabular-nums text-success">
                  {creditCup > 0 ? `+ ${formatAmount(creditCup)}` : formatAmount(0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">
                  {moneyHeading("Posición neta", "CUP")}
                </dt>
                <dd
                  className={netDisplay.className}
                  title="Deuda CUP − crédito CUP + deuda USD × tasa vigente"
                >
                  {netDisplay.text}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">
                  {moneyHeading("Total histórico", "USD")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatAmount(client.totalHistoricalUsd ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">
                  {moneyHeading("Total histórico", "CUP")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatAmount(client.totalHistoricalCup ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Teléfono</dt>
                <dd>{client.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Actualizado</dt>
                <dd className="text-sm">{client.updatedAt}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-base-content/60">Dirección</dt>
                <dd>{client.address ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-base-content/60">Notas</dt>
                <dd className="whitespace-pre-wrap">{client.notes ?? "—"}</dd>
              </div>
            </dl>
            <p className="pt-2 text-xs text-base-content/60">
              Los importes USD y CUP reflejan cobros de pedidos (split Mixto incluido), no la
              conversión de un solo total. El estado usa la tasa vigente para netear ambas monedas.
            </p>
          </div>
        </div>
      )}

      {client && (
        <ClientWorkHistorySection
          clientId={client.id}
          totalHistoricalUsdHint={client.totalHistoricalUsd}
          totalHistoricalCupHint={client.totalHistoricalCup}
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
                  {deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : "Error"}
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
                  {deleteMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Eliminar"
                  )}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-backdrop bg-transparent"
              aria-label="Cerrar"
              onClick={() => setShowDelete(false)}
            />
          </dialog>
        </ModalPortal>
      )}
    </section>
  );
}
