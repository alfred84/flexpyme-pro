import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ClientForm } from "@/features/clients/components/ClientForm";
import type { ClientFormValues } from "@/features/clients/client.schema";
import { fetchClientById, updateClient } from "@/db/queries/clients";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Edits an existing client's contact fields.
 *
 * @returns Client edit form page.
 */
export function ClientEditPage() {
  const params = useParams({ strict: false }) as { clientId?: string };
  const clientId = Number(params.clientId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clientQuery = useQuery({
    queryKey: ["clients", "detail", clientId],
    queryFn: () => fetchClientById(clientId),
    enabled: Number.isFinite(clientId) && clientId > 0,
  });

  const mutation = useMutation({
    mutationFn: (values: ClientFormValues) =>
      updateClient({
        id: clientId,
        code: values.code,
        name: values.name,
        phone: values.phone.trim() === "" ? undefined : values.phone,
        address: values.address.trim() === "" ? undefined : values.address,
        notes: values.notes.trim() === "" ? undefined : values.notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      pushFlashMessage({ kind: "success", text: "Cliente actualizado correctamente." });
      await navigate({ to: "/clientes/$clientId", params: { clientId: String(clientId) } });
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Editar cliente</h1>
          {clientQuery.data && <p className="text-sm text-base-content/70">{clientQuery.data.name}</p>}
        </div>
        <Link to="/clientes/$clientId" params={{ clientId: String(clientId) }} className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>

      {clientQuery.isLoading && <p>Cargando...</p>}
      {clientQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el cliente.</span>
        </div>
      )}

      {mutation.isError && (
        <div className="alert alert-error">
          <span>{mutation.error instanceof Error ? mutation.error.message : "Error al guardar"}</span>
        </div>
      )}

      {clientQuery.data && (
        <ClientForm
          key={clientQuery.data.updatedAt}
          submitLabel="Guardar cambios"
          isSubmitting={mutation.isPending}
          defaultValues={{
            code: clientQuery.data.code,
            name: clientQuery.data.name,
            phone: clientQuery.data.phone ?? "",
            address: clientQuery.data.address ?? "",
            notes: clientQuery.data.notes ?? "",
          }}
          onSubmit={async (values) => {
            await mutation.mutateAsync(values);
          }}
        />
      )}
    </section>
  );
}
