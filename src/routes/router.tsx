import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDbStatus } from "@/hooks/use-db-status";
import { ClientDetailPage } from "@/features/clients/pages/ClientDetailPage";
import { ClientEditPage } from "@/features/clients/pages/ClientEditPage";
import { ClientNewPage } from "@/features/clients/pages/ClientNewPage";
import { ClientsListPage } from "@/features/clients/pages/ClientsListPage";
import { PricesListPage } from "@/features/products/pages/PricesListPage";
import { ProductionBatchDetailPage } from "@/features/production/pages/ProductionBatchDetailPage";
import { ProductionListPage } from "@/features/production/pages/ProductionListPage";
import { ProductionNewPage } from "@/features/production/pages/ProductionNewPage";
import { ReportsPage } from "@/features/reports/pages/ReportsPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { InvoiceCashierPage } from "@/features/invoices/pages/InvoiceCashierPage";
import { InvoiceDetailPage } from "@/features/invoices/pages/InvoiceDetailPage";
import { InvoicePrintPage } from "@/features/invoices/pages/InvoicePrintPage";
import { InvoiceNewPage } from "@/features/invoices/pages/InvoiceNewPage";
import { InvoicesListPage } from "@/features/invoices/pages/InvoicesListPage";

type ThemeName = "light" | "dark";
const THEME_STORAGE_KEY = "flexpyme.theme";

const navTabClass = "btn btn-ghost btn-sm";
const navTabActiveClass = `${navTabClass} bg-base-200 font-medium`;

/**
 * Root layout with navigation and main content outlet.
 *
 * @returns Application shell.
 */
function AppLayout() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div data-theme={theme} className="min-h-screen">
      <div className="navbar bg-base-100 shadow-sm print:hidden">
        <div className="flex-1 px-4">
          <Link to="/" className="text-lg font-semibold">
            FlexPyme Pro
          </Link>
        </div>
        <div className="flex-none gap-2 px-2">
          <label className="label cursor-pointer gap-2 px-2">
            <span className="label-text text-xs">{theme === "dark" ? "Oscuro" : "Claro"}</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={theme === "dark"}
              onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
              aria-label="Cambiar entre modo claro y oscuro"
            />
          </label>
          <Link
            to="/"
            className={navTabClass}
            activeProps={{ className: navTabActiveClass }}
            activeOptions={{ exact: true }}
          >
            Inicio
          </Link>
          <Link
            to="/clientes"
            className={navTabClass}
            activeProps={{ className: navTabActiveClass }}
          >
            Clientes
          </Link>
          <Link
            to="/precios"
            className={navTabClass}
            activeProps={{ className: navTabActiveClass }}
          >
            Precios
          </Link>
          <Link
            to="/produccion"
            className={navTabClass}
            activeProps={{ className: navTabActiveClass }}
          >
            Producción
          </Link>
          <Link
            to="/facturas"
            className={navTabClass}
            activeProps={{ className: navTabActiveClass }}
          >
            Facturas
          </Link>
          <Link
            to="/reportes"
            className={navTabClass}
            activeProps={{ className: navTabActiveClass }}
          >
            Reportes
          </Link>
          <Link
            to="/configuracion"
            className={navTabClass}
            activeProps={{ className: navTabActiveClass }}
          >
            Configuración
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-7xl p-6 print:max-w-none print:p-4">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Dashboard with database status card.
 *
 * @returns Dashboard page.
 */
function DashboardPage() {
  const dbStatus = useDbStatus();
  const dbErrorMessage = dbStatus.error instanceof Error ? dbStatus.error.message : null;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="alert alert-info">
        <span>Base de datos lista. Usa Clientes para gestionar el maestro.</span>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-lg">Estado de base de datos</h2>
          {dbStatus.isLoading && <p>Comprobando estado...</p>}
          {dbStatus.isError && (
            <p className="text-error">
              No se pudo verificar la base de datos.
              {dbErrorMessage ? ` (${dbErrorMessage})` : ""}
            </p>
          )}
          {dbStatus.data && (
            <p className="text-sm">
              Estado: <strong>{dbStatus.data.status}</strong> · Ruta:{" "}
              <span className="font-mono">{dbStatus.data.dbPath}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/clientes" className="btn btn-primary">
          Ir a clientes
        </Link>
        <Link to="/precios" className="btn btn-outline">
          Lista de precios
        </Link>
        <Link to="/produccion" className="btn btn-outline">
          Producción
        </Link>
        <Link to="/facturas" className="btn btn-outline">
          Facturas
        </Link>
        <Link to="/reportes" className="btn btn-outline">
          Reportes
        </Link>
        <Link to="/configuracion" className="btn btn-outline">
          Configuración
        </Link>
      </div>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const clientsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "clientes",
  component: ClientsListPage,
});

const clientsNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "clientes/nuevo",
  component: ClientNewPage,
});

const clientDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "clientes/$clientId",
  component: ClientDetailPage,
});

const clientEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "clientes/$clientId/editar",
  component: ClientEditPage,
});

const pricesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "precios",
  component: PricesListPage,
});

const productionListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "produccion",
  component: ProductionListPage,
});

const productionNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "produccion/nueva",
  component: ProductionNewPage,
});

const productionBatchDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "produccion/$batchId",
  component: ProductionBatchDetailPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "reportes",
  component: ReportsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "configuracion",
  component: SettingsPage,
});

const invoicesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas",
  component: InvoicesListPage,
});

const invoicesNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas/nueva",
  component: InvoiceNewPage,
});

const invoicePrintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas/$invoiceId/imprimir",
  component: InvoicePrintPage,
});

const invoiceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas/$invoiceId",
  component: InvoiceDetailPage,
});

const invoiceCashierRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas/$invoiceId/caja",
  component: InvoiceCashierPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  clientsListRoute,
  clientsNewRoute,
  clientDetailRoute,
  clientEditRoute,
  pricesListRoute,
  productionListRoute,
  productionNewRoute,
  productionBatchDetailRoute,
  reportsRoute,
  settingsRoute,
  invoicesListRoute,
  invoicesNewRoute,
  invoicePrintRoute,
  invoiceCashierRoute,
  invoiceDetailRoute,
]);

export const appRouter = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
