import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ClientFormValues } from "@/features/clients/client.schema";
import { clientFormSchema } from "@/features/clients/client.schema";

export interface ClientFormProps {
  /** Initial values when editing an existing client. */
  defaultValues?: Partial<ClientFormValues>;
  /** Called with validated form values on submit. */
  onSubmit: (values: ClientFormValues) => Promise<void>;
  /** Optional cancel handler shown as secondary button. */
  onCancel?: () => void;
  /** Primary button label. */
  submitLabel: string;
  /** Disables inputs while async submit runs. */
  isSubmitting?: boolean;
}

/**
 * Shared client form using React Hook Form and Zod validation.
 *
 * @param props Form configuration and handlers.
 * @returns Rendered form fields and actions.
 */
export function ClientForm(props: ClientFormProps) {
  const { defaultValues, onSubmit, onCancel, submitLabel, isSubmitting } = props;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      address: defaultValues?.address ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form
      className="mx-auto max-w-xl space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <div className="form-control w-full">
        <label className="label" htmlFor="client-code">
          <span className="label-text">Código</span>
        </label>
        <input
          id="client-code"
          type="text"
          className="input input-bordered w-full"
          autoComplete="off"
          disabled={isSubmitting}
          {...form.register("code")}
        />
        {form.formState.errors.code && (
          <span className="label-text-alt text-error">{form.formState.errors.code.message}</span>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label" htmlFor="client-name">
          <span className="label-text">Nombre</span>
        </label>
        <input
          id="client-name"
          type="text"
          className="input input-bordered w-full"
          autoComplete="organization"
          disabled={isSubmitting}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <span className="label-text-alt text-error">{form.formState.errors.name.message}</span>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label" htmlFor="client-phone">
          <span className="label-text">Teléfono</span>
        </label>
        <input
          id="client-phone"
          type="text"
          className="input input-bordered w-full"
          autoComplete="tel"
          disabled={isSubmitting}
          {...form.register("phone")}
        />
        {form.formState.errors.phone && (
          <span className="label-text-alt text-error">{form.formState.errors.phone.message}</span>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label" htmlFor="client-address">
          <span className="label-text">Dirección</span>
        </label>
        <textarea
          id="client-address"
          className="textarea textarea-bordered w-full"
          rows={2}
          disabled={isSubmitting}
          {...form.register("address")}
        />
        {form.formState.errors.address && (
          <span className="label-text-alt text-error">{form.formState.errors.address.message}</span>
        )}
      </div>

      <div className="form-control w-full">
        <label className="label" htmlFor="client-notes">
          <span className="label-text">Notas</span>
        </label>
        <textarea
          id="client-notes"
          className="textarea textarea-bordered w-full"
          rows={3}
          disabled={isSubmitting}
          {...form.register("notes")}
        />
        {form.formState.errors.notes && (
          <span className="label-text-alt text-error">{form.formState.errors.notes.message}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
