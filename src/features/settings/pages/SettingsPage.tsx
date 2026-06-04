import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Building2, Coins, DollarSign, HardDriveDownload, Hammer, Ruler, Tag, Trash2, Upload, Users } from "lucide-react";
import { BusinessLogo } from "@/components/common/BusinessLogo";
import { EmployeeRolesTab } from "@/features/settings/components/EmployeeRolesTab";
import { FormatsTab } from "@/features/settings/components/FormatsTab";
import { WorkTypesTab } from "@/features/settings/components/WorkTypesTab";
import {
  backupDatabase,
  fetchAllSettings,
  getDbLocation,
  moveDatabase,
  openDbFolder,
  removeBusinessLogo,
  setSettingValue,
  updateBusinessLogo,
} from "@/db/queries/settings";
import { fetchCostList, updateCost } from "@/db/queries/prices";
import { PricesListPage } from "@/features/products/pages/PricesListPage";
import { useTheme } from "@/lib/theme";
import { WORK_TYPE_LABELS, type WorkType } from "@/types/employee";

type TabKey =
  | "general"
  | "precios"
  | "costos"
  | "moneda"
  | "roles"
  | "formatos"
  | "tipos-trabajo"
  | "backup";

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "general", label: "General", icon: Building2 },
  { key: "precios", label: "Precios", icon: Tag },
  { key: "costos", label: "Costos", icon: Coins },
  { key: "moneda", label: "Moneda", icon: DollarSign },
  { key: "roles", label: "Roles", icon: Users },
  { key: "formatos", label: "Formatos", icon: Ruler },
  { key: "tipos-trabajo", label: "Tipos de Trabajo", icon: Hammer },
  { key: "backup", label: "Backup", icon: HardDriveDownload },
];

/**
 * Página de Configuración con tabs internos (REQUIREMENTS §3.7).
 *
 * @returns Página de configuración.
 */
export function SettingsPage() {
  const { tab: initialTab } = useSearch({ from: "/configuracion" });
  const [tab, setTab] = useState<TabKey>((initialTab as TabKey) ?? "general");

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab as TabKey);
    }
  }, [initialTab]);

  useEffect(() => {
    if (tab === "moneda") {
      const timer = window.setTimeout(() => {
        document.getElementById("exchange-rate-input")?.focus();
      }, 300);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [tab]);

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
      {tab === "roles" && <EmployeeRolesTab />}
      {tab === "formatos" && <FormatsTab />}
      {tab === "tipos-trabajo" && <WorkTypesTab />}
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
  const logoPath = data.business_logo_path ?? null;
  const logoVersion = data.business_logo_version ?? null;
  const [name, setName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  const logoMutation = useMutation({
    mutationFn: async (path: string) => updateBusinessLogo(path),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: removeBusinessLogo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
    },
  });

  const handleSelectLogo = async () => {
    const selected = await open({
      filters: [{ name: "Imagen", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
      multiple: false,
    });
    if (typeof selected === "string") {
      await logoMutation.mutateAsync(selected);
    }
  };

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
        <div className="flex items-center gap-4">
          <BusinessLogo path={logoPath} version={logoVersion} size="md" fallbackIcon={Building2} />
          <div className="flex flex-col gap-2">
            <button type="button" className="btn btn-outline btn-sm gap-2" onClick={() => void handleSelectLogo()}>
              <Upload size={14} /> Cambiar icono
            </button>
            {logoPath && (
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-2 text-error"
                onClick={() => void removeLogoMutation.mutateAsync()}
              >
                <Trash2 size={14} /> Quitar icono
              </button>
            )}
            <p className="text-xs text-base-content/50">PNG, JPG, WEBP o SVG · Máx. 2MB</p>
          </div>
        </div>
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
            id="exchange-rate-input"
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
 * Tab Backup: respaldo de la base de datos a un archivo con marca de tiempo.
 */
function BackupTab() {
  const [path, setPath] = useState<string | null>(null);
  const dbPathQuery = useQuery({ queryKey: ["settings", "db-path"], queryFn: getDbLocation });
  const [moving, setMoving] = useState(false);
  const mutation = useMutation({
    mutationFn: backupDatabase,
    onSuccess: (resultPath) => setPath(resultPath),
  });

  const handleMoveDb = async () => {
    const dest = await save({
      filters: [{ name: "SQLite", extensions: ["db"] }],
      defaultPath: "flexpyme.db",
    });
    if (!dest) return;
    setMoving(true);
    try {
      const newPath = await moveDatabase(dest);
      await dbPathQuery.refetch();
      setPath(`Base de datos movida a: ${newPath}`);
    } catch (e) {
      setPath((e as Error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-4">
    <div className="card max-w-2xl bg-base-200">
      <div className="card-body space-y-3">
        <h2 className="card-title text-base">Ubicación de la base de datos</h2>
        <p className="text-sm break-all text-base-content/80">
          Ruta actual: {dbPathQuery.data ?? "…"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              void navigator.clipboard.writeText(dbPathQuery.data ?? "");
            }}
          >
            Copiar ruta
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void openDbFolder()}>
            Abrir carpeta
          </button>
          <button type="button" className="btn btn-warning btn-sm" disabled={moving} onClick={() => void handleMoveDb()}>
            {moving ? <span className="loading loading-spinner loading-sm" /> : "Mover base de datos"}
          </button>
        </div>
        <p className="text-xs text-warning">
          Al mover la BD, la app se reconectará automáticamente. Se recomienda hacer un respaldo antes.
        </p>
      </div>
    </div>
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
    </div>
  );
}
