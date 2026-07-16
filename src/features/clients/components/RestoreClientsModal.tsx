import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { fetchDeletedClients, restoreClient } from "@/db/queries/clients";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";

interface RestoreClientsModalProps {
  /** Cierra el modal. */
  onClose: () => void;
}

/**
 * Modal con el listado de clientes eliminados y acción de restaurar por fila.
 *
 * @param props - Callback de cierre.
 * @returns Diálogo DaisyUI de restauración.
 */
export function RestoreClientsModal(props: RestoreClientsModalProps) {
  const { onClose } = props;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );

  const deletedQuery = useQuery({
    queryKey: ["clients", "deleted"],
    queryFn: fetchDeletedClients,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreClient,
    onSuccess: async (_void, restoredId) => {
      const restored = deletedQuery.data?.find((c) => c.id === restoredId);
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      setFeedback({
        kind: "success",
        text: restored
          ? `«${restored.name}» restaurado correctamente.`
          : "Cliente restaurado correctamente.",
      });
      setRestoringId(null);
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo restaurar el cliente.",
      });
      setRestoringId(null);
    },
  });

  const filtered = useMemo(() => {
    const rows = deletedQuery.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }, [deletedQuery.data, filter]);

  const handleRestore = (id: number) => {
    setFeedback(null);
    setRestoringId(id);
    void restoreMutation.mutateAsync(id);
  };

  return (
    <dialog className="modal modal-open" aria-labelledby="restore-clients-title">
      <div className="modal-box flex max-h-[85vh] w-full max-w-2xl flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="restore-clients-title" className="text-lg font-bold">
              Restaurar clientes
            </h3>
            <p className="mt-1 text-sm text-base-content/70">
              Estos clientes están ocultos del listado. Restaurarlos los vuelve a mostrar sin
              perder su historial ni balance.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {feedback && (
          <div
            className={`alert py-2 ${feedback.kind === "success" ? "alert-success" : "alert-error"}`}
            role="status"
          >
            <span className="text-sm">{feedback.text}</span>
          </div>
        )}

        <label className="input input-bordered flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          <input
            type="search"
            className="grow"
            placeholder="Buscar por código, nombre o teléfono..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtrar clientes eliminados"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-base-300">
          {deletedQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-sm" />
              Cargando clientes eliminados…
            </div>
          )}

          {deletedQuery.isError && (
            <div className="p-4 text-sm text-error">
              No se pudieron cargar los clientes eliminados.
            </div>
          )}

          {deletedQuery.isSuccess && filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-base-content/60">
              {filter.trim()
                ? "Ningún cliente eliminado coincide con la búsqueda."
                : "No hay clientes eliminados."}
            </p>
          )}

          {filtered.length > 0 && (
            <table className="table table-sm">
              <thead className="sticky top-0 z-10 bg-base-200">
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Eliminado</th>
                  <th className="text-right">Balance</th>
                  <th className="w-28 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cliente) => {
                  const isRestoring = restoringId === cliente.id && restoreMutation.isPending;
                  return (
                    <tr key={cliente.id}>
                      <td className="font-mono text-xs">{cliente.code}</td>
                      <td>
                        <div className="font-medium">{cliente.name}</div>
                        {cliente.phone && (
                          <div className="text-xs text-base-content/60">{cliente.phone}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs text-base-content/70">
                        {formatDate(cliente.deletedAt)}
                      </td>
                      <td className="text-right tabular-nums text-sm">
                        {formatMoney(cliente.balance)}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-success btn-outline btn-xs gap-1"
                          disabled={restoreMutation.isPending}
                          onClick={() => handleRestore(cliente.id)}
                          title={`Restaurar ${cliente.name}`}
                        >
                          {isRestoring ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Restaurar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-action mt-0">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={onClose}>
          cerrar
        </button>
      </form>
    </dialog>
  );
}
