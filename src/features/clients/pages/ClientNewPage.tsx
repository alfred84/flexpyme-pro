import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ClientForm } from "@/features/clients/components/ClientForm";
import type { ClientFormValues } from "@/features/clients/client.schema";
import { createClient } from "@/db/queries/clients";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Creates a new client and navigates to its detail view on success.
 *
 * @returns New client form page.
 */
export function ClientNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: ClientFormValues) =>
      createClient({
        code: values.code,
        name: values.name,
        phone: values.phone.trim() === "" ? undefined : values.phone,
        address: values.address.trim() === "" ? undefined : values.address,
        notes: values.notes.trim() === "" ? undefined : values.notes,
      }),
    onSuccess: async (newId) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      pushFlashMessage({ kind: "success", text: "Cliente creado correctamente." });
      await navigate({ to: "/clientes/$clientId", params: { clientId: String(newId) } });
    },
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nuevo cliente</h1>
        <p className="text-sm text-base-content/70">Completa los datos básicos del cliente.</p>
      </div>

      {mutation.isError && (
        <div className="alert alert-error">
          <span>{mutation.error instanceof Error ? mutation.error.message : "Error al guardar"}</span>
        </div>
      )}

      <ClientForm
        submitLabel="Guardar cliente"
        isSubmitting={mutation.isPending}
        onCancel={() => void navigate({ to: "/clientes" })}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
      />
    </section>
  );
}
