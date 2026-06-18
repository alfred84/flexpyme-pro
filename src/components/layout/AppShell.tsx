import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { getDbLocation } from "@/db/queries/settings";
import { popFlashMessage, pushFlashMessage, type FlashMessage } from "@/lib/flash-message";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useTheme } from "@/lib/theme";

/**
 * Shell principal de la aplicación: sidebar colapsable + header + área de contenido.
 *
 * @returns Layout raíz con navegación lateral y outlet de rutas.
 */
export function AppShell() {
  const { theme, setTheme } = useTheme();
  const settings = useAppSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  useEffect(() => {
    const key = "flexpyme.db_location_hint_shown";
    if (typeof window === "undefined" || window.localStorage.getItem(key)) {
      return;
    }
    void getDbLocation()
      .then((path) => {
        pushFlashMessage({
          kind: "info",
          text: `Base de datos activa: ${path}. Los respaldos se gestionan en Configuración > Backup.`,
        });
        window.localStorage.setItem(key, "1");
      })
      .catch(() => {
        /* Tauri no disponible (vite solo) */
      });
    const pending = popFlashMessage();
    if (pending) {
      setFlash(pending);
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-base-100 text-base-content">
      <div className="print:hidden">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          businessName={settings.businessName}
          logoPath={settings.businessLogoPath}
          logoVersion={settings.businessLogoVersion}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header theme={theme} onToggleTheme={() => setTheme(theme === "business" ? "light" : "business")} />
        <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-4">
          {flash && (
            <div
              className={`alert mb-4 print:hidden ${flash.kind === "success" ? "alert-success" : flash.kind === "error" ? "alert-error" : "alert-info"}`}
            >
              <span>{flash.text}</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
