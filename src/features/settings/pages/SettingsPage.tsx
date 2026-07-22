import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { Building2, DatabaseBackup, DollarSign, HardDriveDownload, Hammer, Layers, RotateCcw, Ruler, Scale, Sparkles, Trash2, Upload, Users } from "lucide-react";
import { CategoriesTab } from "@/features/settings/components/CategoriesTab";
import { FinishesTab } from "@/features/settings/components/FinishesTab";
import { formatDateTime } from "@/lib/format-date";
import { UnitsTab } from "@/features/settings/components/UnitsTab";
import { BusinessLogo } from "@/components/common/BusinessLogo";
import { EmployeeRolesTab } from "@/features/settings/components/EmployeeRolesTab";
import { FormatsTab } from "@/features/settings/components/FormatsTab";
import { WorkTypesTab } from "@/features/settings/components/WorkTypesTab";
import { ExchangeRateTab } from "@/features/settings/components/ExchangeRateTab";
import {
  backupDatabase,
  fetchBackupOverview,
  fetchAllSettings,
  openDbFolder,
  removeBusinessLogo,
  restoreDatabase,
  setBackupIntervalDays,
  setSettingValue,
  updateBusinessLogo,
} from "@/db/queries/settings";
import { useTheme } from "@/lib/theme";

type TabKey =
  | "general"
  | "tasa-de-cambio"
  | "roles"
  | "categorias"
  | "acabados"
  | "unidades"
  | "formatos"
  | "tipos-trabajo"
  | "backup";

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "general", label: "General", icon: Building2 },
  { key: "tasa-de-cambio", label: "Tasa de cambio", icon: DollarSign },
  { key: "roles", label: "Roles", icon: Users },
  { key: "categorias", label: "Categorías", icon: Layers },
  { key: "acabados", label: "Acabados", icon: Sparkles },
  { key: "unidades", label: "Unidades", icon: Scale },
  { key: "formatos", label: "Formatos", icon: Ruler },
  { key: "tipos-trabajo", label: "Tipos de Trabajo", icon: Hammer },
  { key: "backup", label: "Backup", icon: HardDriveDownload },
];

function resolveSettingsTab(tab: string | undefined): TabKey {
  if (tab === "moneda" || tab === "tasa-de-cambio") {
    return "tasa-de-cambio";
  }
  const valid: TabKey[] = [
    "general",
    "tasa-de-cambio",
    "roles",
    "categorias",
    "acabados",
    "unidades",
    "formatos",
    "tipos-trabajo",
    "backup",
  ];
  if (tab && valid.includes(tab as TabKey)) {
    return tab as TabKey;
  }
  return "general";
}

/**
 * Página de Configuración con tabs internos (REQUIREMENTS §3.7).
 *
 * @returns Página de configuración.
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const { tab: initialTab } = useSearch({ from: "/configuracion" });
  const [tab, setTab] = useState<TabKey>(() => resolveSettingsTab(initialTab));

  useEffect(() => {
    if (initialTab === "precios" || initialTab === "costos") {
      void navigate({ to: "/precios", search: { categoria: undefined } });
      return;
    }
    if (initialTab) {
      setTab(resolveSettingsTab(initialTab));
    }
  }, [initialTab, navigate]);

  useEffect(() => {
    if (tab === "tasa-de-cambio") {
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
      {tab === "tasa-de-cambio" && <ExchangeRateTab />}
      {tab === "roles" && <EmployeeRolesTab />}
      {tab === "categorias" && <CategoriesTab />}
      {tab === "acabados" && <FinishesTab />}
      {tab === "unidades" && <UnitsTab />}
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
 * Tab Backup: respaldo de la base de datos a un archivo con marca de tiempo.
 */
function BackupTab() {
  const [path, setPath] = useState<string | null>(null);
  const [intervalDays, setIntervalDays] = useState("");
  const queryClient = useQueryClient();
  const backupOverviewQuery = useQuery({
    queryKey: ["settings", "backup-overview"],
    queryFn: fetchBackupOverview,
  });
  const overview = backupOverviewQuery.data;

  useEffect(() => {
    if (overview) {
      setIntervalDays(String(overview.intervalDays));
    }
  }, [overview]);

  const manualBackupMutation = useMutation({
    mutationFn: backupDatabase,
    onSuccess: async (resultPath) => {
      setPath(`Respaldo creado en: ${resultPath}`);
      await queryClient.invalidateQueries({ queryKey: ["settings", "backup-overview"] });
    },
  });

  const intervalMutation = useMutation({
    mutationFn: (days: number) => setBackupIntervalDays(days),
    onSuccess: async () => {
      setPath("Intervalo de backup automático actualizado.");
      await queryClient.invalidateQueries({ queryKey: ["settings", "backup-overview"] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreDatabase,
    onSuccess: async (result) => {
      setPath(
        `Base restaurada en: ${result.restoredPath}. Respaldo previo creado en: ${result.safetyBackupPath}. Reinicia la app para usar la base restaurada sin datos en memoria.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["settings", "backup-overview"] });
      await queryClient.invalidateQueries();
    },
  });

  const handleSaveInterval = () => {
    const parsed = Number(intervalDays);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPath("El intervalo debe ser un número mayor o igual a 1 día.");
      return;
    }
    intervalMutation.mutate(Math.round(parsed));
  };

  const handleRestoreDatabase = async () => {
    const selected = await open({
      filters: [{ name: "SQLite", extensions: ["db", "sqlite", "sqlite3"] }],
      multiple: false,
    });
    if (typeof selected !== "string") return;
    const confirmed = window.confirm(
      "Se validará la base seleccionada y se reemplazará la BD activa flexpyme.db. Antes se creará un respaldo de seguridad. ¿Deseas continuar?",
    );
    if (!confirmed) return;
    await restoreMutation.mutateAsync(selected);
  };

  return (
    <div className="space-y-4">
      <div className="card max-w-3xl bg-base-200">
        <div className="card-body space-y-3">
          <h2 className="card-title text-base">Ubicación de la base de datos</h2>
          <p className="text-sm break-all text-base-content/80">Ruta actual: {overview?.dbPath ?? "…"}</p>
          <p className="text-sm break-all text-base-content/70">Backups en: {overview?.backupDir ?? "…"}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                void navigator.clipboard.writeText(overview?.dbPath ?? "");
              }}
            >
              Copiar ruta
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void openDbFolder()}>
              Abrir carpeta
            </button>
          </div>
          <p className="text-xs text-base-content/60">
            En la versión portable la BD activa siempre se llama <code>flexpyme.db</code> y vive junto al ejecutable.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-200">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">
              <DatabaseBackup className="h-5 w-5" /> Backup automático
            </h2>
            <p className="text-sm text-base-content/70">
              Se crea un respaldo programado al abrir Inicio o Configuración cuando se cumple el intervalo.
            </p>
            <label className="form-control max-w-xs">
              <span className="label-text">Cada cuántos días</span>
              <input
                type="number"
                min={1}
                max={365}
                className="input input-bordered"
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
              />
            </label>
            <p className="text-xs text-base-content/60">
              Último backup programado: {overview?.lastScheduledBackupAt ?? "Sin registro"}
            </p>
            <button
              className="btn btn-primary btn-sm w-fit"
              disabled={intervalMutation.isPending}
              onClick={handleSaveInterval}
            >
              {intervalMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar intervalo"}
            </button>
          </div>
        </div>

        <div className="card bg-base-200">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">Respaldo y restauración manual</h2>
            <p className="text-sm text-base-content/70">
              Crea una copia inmediata o importa una BD compatible para reemplazar <code>flexpyme.db</code>.
            </p>
            {(manualBackupMutation.isError || restoreMutation.isError || intervalMutation.isError) && (
              <div className="alert alert-error py-2 text-sm">
                <span>
                  {(manualBackupMutation.error as Error)?.message ??
                    (restoreMutation.error as Error)?.message ??
                    (intervalMutation.error as Error)?.message ??
                    "No se pudo completar la operación."}
                </span>
              </div>
            )}
            {path && (
              <div className="alert alert-success py-2 text-sm">
                <span className="break-all">{path}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-primary btn-sm"
                disabled={manualBackupMutation.isPending}
                onClick={() => manualBackupMutation.mutate()}
              >
                {manualBackupMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Crear respaldo"}
              </button>
              <button
                type="button"
                className="btn btn-warning btn-sm gap-2"
                disabled={restoreMutation.isPending}
                onClick={() => void handleRestoreDatabase()}
              >
                {restoreMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : <RotateCcw className="h-4 w-4" />}
                Restaurar / importar BD
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Últimos 5 backups</h2>
          {backupOverviewQuery.isLoading ? (
            <p className="text-sm text-base-content/60">Cargando backups...</p>
          ) : (overview?.backups.length ?? 0) === 0 ? (
            <p className="text-sm text-base-content/60">Todavía no hay backups registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th className="text-right">Tamaño</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.backups.map((backup) => (
                    <tr key={backup.path}>
                      <td className="max-w-xs truncate font-mono text-xs" title={backup.path}>
                        {backup.fileName}
                      </td>
                      <td>{backup.kind}</td>
                      <td>{formatDateTime(backup.createdAt)}</td>
                      <td className="text-right">{formatBackupSize(backup.sizeBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBackupSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
