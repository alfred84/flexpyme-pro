import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Coins, DollarSign, HardDriveDownload, Ruler, Tag } from "lucide-react";
import { backupDatabase, fetchAllSettings, setSettingValue } from "@/db/queries/settings";
import { fetchCostList, fetchFormats, updateCost } from "@/db/queries/prices";
import { PricesListPage } from "@/features/products/pages/PricesListPage";
import { useTheme } from "@/lib/theme";
import { WORK_TYPE_LABELS, type WorkType } from "@/types/employee";

type TabKey = "general" | "precios" | "costos" | "moneda" | "formatos" | "backup";

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "general", label: "General", icon: Building2 },
  { key: "precios", label: "Precios", icon: Tag },
  { key: "costos", label: "Costos", icon: Coins },
  { key: "moneda", label: "Moneda", icon: DollarSign },
  { key: "formatos", label: "Formatos", icon: Ruler },
  { key: "backup", label: "Backup", icon: HardDriveDownload },
];

/**
 * Página de Configuración con tabs internos (REQUIREMENTS §3.7).
 *
 * @returns Página de configuración.
 */
export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("general");

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Configuración</h1>
      <div role="tablist" className="tabs tabs-boxed w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              className={`tab gap-2 ${tab === t.key ? "tab-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "general" && <GeneralTab />}
      {tab === "precios" && <PricesListPage />}
      {tab === "costos" && <CostsTab />}
      {tab === "moneda" && <CurrencyTab />}
      {tab === "formatos" && <FormatsTab />}
      {tab === "backup" && <BackupTab />}
    </section>
  );
}

/**
 * Tab General: datos del negocio y conmutador de tema.
 */
function GeneralTab() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const settingsQuery = useQuery({ queryKey: ["settings", "all"], queryFn: fetchAllSettings });
  const [saved, setSaved] = useState(false);

  const data = settingsQuery.data ?? {};
  const [name, setName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      await setSettingValue("business_name", name ?? data.business_name ?? "");
      await setSettingValue("business_address", address ?? data.business_address ?? "");
      await setSettingValue("business_phone", phone ?? data.business_phone ?? "");
    },
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <div className="card max-w-xl bg-base-200">
      <div className="card-body space-y-3">
        <h2 className="card-title text-base">Datos del negocio</h2>
        {saved && <div className="alert alert-success py-2 text-sm">Guardado.</div>}
        <label className="form-control">
          <span className="label-text">Nombre</span>
          <input
            className="input input-bordered"
            defaultValue={data.business_name ?? data.company_name ?? ""}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="form-control">
          <span className="label-text">Dirección</span>
          <input
            className="input input-bordered"
            defaultValue={data.business_address ?? data.company_address ?? ""}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <label className="form-control">
          <span className="label-text">Teléfono</span>
          <input
            className="input input-bordered"
            defaultValue={data.business_phone ?? data.company_phone ?? ""}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>

        <div className="divider my-1" />
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="toggle"
            checked={theme === "business"}
            onChange={(e) => setTheme(e.target.checked ? "business" : "light")}
          />
          <span className="label-text">Modo oscuro</span>
        </label>

        <div>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tab Moneda: tasa de cambio USD → CUP.
 */
function CurrencyTab() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings", "all"], queryFn: fetchAllSettings });
  const [rate, setRate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const current = settingsQuery.data?.usd_exchange_rate ?? "";

  const mutation = useMutation({
    mutationFn: () => setSettingValue("usd_exchange_rate", rate ?? current),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <div className="card max-w-md bg-base-200">
      <div className="card-body space-y-3">
        <h2 className="card-title text-base">Tasa USD → CUP</h2>
        {saved && <div className="alert alert-success py-2 text-sm">Tasa actualizada.</div>}
        <label className="form-control">
          <span className="label-text">Cuántos CUP equivale 1 USD</span>
          <input
            type="number"
            className="input input-bordered"
            defaultValue={current}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <div>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            Guardar tasa
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tab Costos: edición de precios de costo de empleados por tipo de trabajo.
 */
function CostsTab() {
  const queryClient = useQueryClient();
  const costsQuery = useQuery({ queryKey: ["costs", "all"], queryFn: fetchCostList });
  const mutation = useMutation({
    mutationFn: updateCost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["costs"] }),
  });

  const rows = costsQuery.data ?? [];

  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <h2 className="card-title text-base">Precios de costo (pago a empleados)</h2>
        {costsQuery.isLoading && <p>Cargando...</p>}
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Tipo de trabajo</th>
                <th>Formato</th>
                <th className="text-right">Costo unitario (CUP)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{WORK_TYPE_LABELS[row.workType as WorkType] ?? row.workType}</td>
                  <td>{row.formatLabel ?? "—"}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      className="input input-bordered input-sm w-28 text-right"
                      defaultValue={row.unitCost}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== row.unitCost && value >= 0) {
                          mutation.mutate({ id: row.id, unitCost: value, isActive: row.isActive });
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Tab Formatos: listado de formatos disponibles (solo lectura).
 */
function FormatsTab() {
  const formatsQuery = useQuery({ queryKey: ["formats", "all"], queryFn: fetchFormats });
  return (
    <div className="card max-w-md bg-base-200">
      <div className="card-body">
        <h2 className="card-title text-base">Formatos disponibles</h2>
        <div className="flex flex-wrap gap-2">
          {(formatsQuery.data ?? []).map((format) => (
            <span key={format.id} className="badge badge-lg badge-outline">
              {format.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Tab Backup: respaldo de la base de datos a un archivo con marca de tiempo.
 */
function BackupTab() {
  const [path, setPath] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: backupDatabase,
    onSuccess: (resultPath) => setPath(resultPath),
  });

  return (
    <div className="card max-w-xl bg-base-200">
      <div className="card-body space-y-3">
        <h2 className="card-title text-base">Respaldo de la base de datos</h2>
        <p className="text-sm text-base-content/70">
          Crea una copia con marca de tiempo de la base de datos en la carpeta <code>backups</code>.
        </p>
        {mutation.isError && (
          <div className="alert alert-error py-2 text-sm">
            <span>{(mutation.error as Error)?.message ?? "No se pudo crear el respaldo."}</span>
          </div>
        )}
        {path && (
          <div className="alert alert-success py-2 text-sm">
            <span className="break-all">Respaldo creado en: {path}</span>
          </div>
        )}
        <div>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Crear respaldo"}
          </button>
        </div>
      </div>
    </div>
  );
}
