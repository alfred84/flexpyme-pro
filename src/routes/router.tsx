import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
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
