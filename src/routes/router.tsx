import { createRootRoute, createRoute, createRouter, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
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
import { EmployeesListPage } from "@/features/employees/pages/EmployeesListPage";
import { InventoryListPage } from "@/features/inventory/pages/InventoryListPage";
import { CashflowPage } from "@/features/cashflow/pages/CashflowPage";

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
  component: AppShell,
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

const employeesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "empleados",
  component: EmployeesListPage,
});

const inventoryListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "inventario",
  component: InventoryListPage,
});

const cashflowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "caja",
  component: CashflowPage,
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
  employeesListRoute,
  inventoryListRoute,
  cashflowRoute,
]);

export const appRouter = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
