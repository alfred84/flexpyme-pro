import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchCompanySettings, saveCompanySettings } from "@/db/queries/settings";
import type { CompanySettingsDto } from "@/types/settings";

function CompanySettingsForm(props: {
  initial: CompanySettingsDto;
  onSaved: () => void;
  onSubmitStart: () => void;
}) {
  const { initial, onSaved, onSubmitStart } = props;
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [companyRnc, setCompanyRnc] = useState(initial.companyRnc);
  const [companyPhone, setCompanyPhone] = useState(initial.companyPhone);
  const [companyAddress, setCompanyAddress] = useState(initial.companyAddress);

  const mutation = useMutation({
    mutationFn: saveCompanySettings,
    onSuccess: async () => {
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["settings", "company"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitStart();
    void mutation.mutateAsync({
      companyName,
      companyRnc,
      companyPhone,
      companyAddress,
    });
  };

  return (
    <form className="card bg-base-100 shadow" onSubmit={handleSubmit}>
      <div className="card-body space-y-4">
        <h2 className="card-title text-base">Empresa</h2>
        <label className="form-control w-full">
          <span className="label-text">Nombre comercial</span>
          <input
            className="input input-bordered"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            autoComplete="organization"
          />
        </label>
        <label className="form-control w-full">
          <span className="label-text">RNC / identificación fiscal</span>
          <input className="input input-bordered" value={companyRnc} onChange={(e) => setCompanyRnc(e.target.value)} />
        </label>
        <label className="form-control w-full">
          <span className="label-text">Teléfono</span>
          <input className="input input-bordered" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} type="tel" />
        </label>
        <label className="form-control w-full">
          <span className="label-text">Dirección</span>
          <textarea className="textarea textarea-bordered" rows={2} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
        </label>
        {mutation.isError && (
          <p className="text-error text-sm">
            {mutation.error instanceof Error ? mutation.error.message : "Error al guardar"}
          </p>
        )}
        <div className="card-actions justify-end">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Company and app settings backed by SQLite `settings` table.
 */
export function SettingsPage() {
  const [savedBanner, setSavedBanner] = useState(false);
  const settingsQuery = useQuery({
    queryKey: ["settings", "company"],
    queryFn: fetchCompanySettings,
  });

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-base-content/70">
          Datos del negocio que aparecen en la factura impresa (nombre, RNC, contacto).
        </p>
      </div>

      {settingsQuery.isLoading && <p>Cargando...</p>}
      {settingsQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar la configuración.</span>
        </div>
      )}

      {savedBanner && (
        <div className="alert alert-success">
          <span>Configuración guardada.</span>
        </div>
      )}

      {settingsQuery.isSuccess && settingsQuery.data && (
        <CompanySettingsForm
          key={settingsQuery.dataUpdatedAt}
          initial={settingsQuery.data}
          onSaved={() => setSavedBanner(true)}
          onSubmitStart={() => setSavedBanner(false)}
        />
      )}
    </section>
  );
}
