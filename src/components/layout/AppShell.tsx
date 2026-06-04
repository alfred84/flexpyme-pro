import { useState } from "react";
import { Outlet } from "@tanstack/react-router";
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

  return (
    <div className="flex h-screen overflow-hidden bg-base-100 text-base-content">
      <div className="print:hidden">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          businessName={settings.businessName}
          logoPath={settings.businessLogoPath}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header theme={theme} onToggleTheme={() => setTheme(theme === "business" ? "light" : "business")} />
        <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
