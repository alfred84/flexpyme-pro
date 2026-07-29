import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
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
import { ProductionReportPage } from "@/features/production/pages/ProductionReportPage";
import { ReportsPage } from "@/features/reports/pages/ReportsPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { InvoiceCashierPage } from "@/features/invoices/pages/InvoiceCashierPage";
import { InvoiceDetailPage } from "@/features/invoices/pages/InvoiceDetailPage";
import { InvoicePrintPage } from "@/features/invoices/pages/InvoicePrintPage";
import { InvoiceNewPage } from "@/features/invoices/pages/InvoiceNewPage";
import { InvoiceEditPage } from "@/features/invoices/pages/InvoiceEditPage";
import { InvoicesListPage } from "@/features/invoices/pages/InvoicesListPage";
import { FacturaDetailPage } from "@/features/invoices/pages/FacturaDetailPage";
import { FacturasPage } from "@/features/invoices/pages/FacturasPage";
import { EmployeesListPage } from "@/features/employees/pages/EmployeesListPage";
import { EmployeeNewPage } from "@/features/employees/pages/EmployeeNewPage";
import { EmployeeEditPage } from "@/features/employees/pages/EmployeeEditPage";
import { EmployeeDetailPage } from "@/features/employees/pages/EmployeeDetailPage";
import { EmployeeWorkBatchPage } from "@/features/employees/pages/EmployeeWorkBatchPage";
import { InventoryListPage } from "@/features/inventory/pages/InventoryListPage";
import { InventoryNewPage } from "@/features/inventory/pages/InventoryNewPage";
import { InventoryCategoryPage } from "@/features/inventory/pages/InventoryCategoryPage";
import { InventoryItemDetailPage } from "@/features/inventory/pages/InventoryItemDetailPage";
import { InventoryItemEditPage } from "@/features/inventory/pages/InventoryItemEditPage";
import { CashflowPage } from "@/features/cashflow/pages/CashflowPage";
import { CashflowNewPage } from "@/features/cashflow/pages/CashflowNewPage";
import { CashflowHistoryPage } from "@/features/cashflow/pages/CashflowHistoryPage";
import { OtherExpensesPage } from "@/features/expenses/pages/OtherExpensesPage";
import { OtherExpenseNewPage } from "@/features/expenses/pages/OtherExpenseNewPage";
import { OtherExpenseDetailPage } from "@/features/expenses/pages/OtherExpenseDetailPage";
import { OtherExpenseEditPage } from "@/features/expenses/pages/OtherExpenseEditPage";

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
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.categoria;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && /^\d+$/.test(raw)
          ? Number(raw)
          : undefined;
    return {
      categoria: n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined,
    };
  },
  component: PricesListPage,
});

/** Legacy route: Costos se gestiona dentro de Precios. */
const costsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "costos",
  beforeLoad: () => {
    throw redirect({ to: "/precios", search: { categoria: undefined } });
  },
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

const productionReportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "reportes-produccion",
  component: ProductionReportPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "configuracion",
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "general",
  }),
  component: SettingsPage,
});

const PEDIDOS_FILTERS = [
  "todos",
  "en_produccion",
  "listos",
  "pendiente_cobro",
  "cobrados",
  "completados",
] as const;

type PedidosSearchFilter = (typeof PEDIDOS_FILTERS)[number];

const stockListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "stock",
  beforeLoad: () => {
    throw redirect({ to: "/pedidos", search: { filter: "listos" } });
  },
});

const stockDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "stock/$invoiceId",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/pedidos/$invoiceId",
      params: { invoiceId: params.invoiceId },
    });
  },
});

const facturasListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas",
  component: FacturasPage,
});

const facturaDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas/$invoiceId",
  component: FacturaDetailPage,
});

const facturaPrintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas/$invoiceId/imprimir",
  component: InvoicePrintPage,
});

const facturaPagoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "facturas/$invoiceId/pago",
  component: InvoiceCashierPage,
});

const invoicesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pedidos",
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search.filter === "string" ? search.filter : undefined;
    const filter = PEDIDOS_FILTERS.includes(raw as PedidosSearchFilter)
      ? (raw as PedidosSearchFilter)
      : undefined;
    return { filter };
  },
  component: InvoicesListPage,
});

const invoicesNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pedidos/nuevo",
  component: InvoiceNewPage,
});

const invoiceEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pedidos/$invoiceId/editar",
  component: InvoiceEditPage,
});

const invoicePrintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pedidos/$invoiceId/imprimir",
  component: InvoicePrintPage,
});

const invoiceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pedidos/$invoiceId",
  component: InvoiceDetailPage,
});

const invoiceCashierRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pedidos/$invoiceId/caja",
  component: InvoiceCashierPage,
});

const employeesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "empleados",
  component: EmployeesListPage,
});

const employeeNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "empleados/nuevo",
  component: EmployeeNewPage,
});

const employeeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "empleados/$employeeId",
  component: EmployeeDetailPage,
});

const employeeEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "empleados/$employeeId/editar",
  component: EmployeeEditPage,
});

const employeeWorkBatchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "empleados/$employeeId/lote",
  component: EmployeeWorkBatchPage,
});

const inventoryListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "inventario",
  component: InventoryListPage,
});

const inventoryNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "inventario/nuevo",
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.categoria;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return {
      categoria: Number.isFinite(n) && n > 0 ? n : undefined,
    };
  },
  component: InventoryNewPage,
});

const inventoryCategoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "inventario/categoria/$categoryId",
  component: InventoryCategoryPage,
});

const inventoryItemDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "inventario/$itemId",
  component: InventoryItemDetailPage,
});

const inventoryItemEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "inventario/$itemId/editar",
  component: InventoryItemEditPage,
});

const cashflowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "caja",
  component: CashflowPage,
});

const cashflowNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "caja/nuevo",
  component: CashflowNewPage,
});

const cashflowHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "caja/historial",
  component: CashflowHistoryPage,
});

const otherExpensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "otros-gastos",
  component: OtherExpensesPage,
});

const otherExpenseNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "otros-gastos/nuevo",
  component: OtherExpenseNewPage,
});

const otherExpenseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "otros-gastos/$expenseId",
  component: OtherExpenseDetailPage,
});

const otherExpenseEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "otros-gastos/$expenseId/editar",
  component: OtherExpenseEditPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  clientsListRoute,
  clientsNewRoute,
  clientDetailRoute,
  clientEditRoute,
  pricesListRoute,
  costsListRoute,
  productionListRoute,
  productionNewRoute,
  productionBatchDetailRoute,
  reportsRoute,
  productionReportRoute,
  settingsRoute,
  stockListRoute,
  stockDetailRoute,
  facturasListRoute,
  facturaDetailRoute,
  facturaPrintRoute,
  facturaPagoRoute,
  invoicesListRoute,
  invoicesNewRoute,
  invoiceEditRoute,
  invoicePrintRoute,
  invoiceCashierRoute,
  invoiceDetailRoute,
  employeesListRoute,
  employeeNewRoute,
  employeeDetailRoute,
  employeeEditRoute,
  employeeWorkBatchRoute,
  inventoryListRoute,
  inventoryNewRoute,
  inventoryCategoryRoute,
  inventoryItemEditRoute,
  inventoryItemDetailRoute,
  cashflowRoute,
  cashflowNewRoute,
  cashflowHistoryRoute,
  otherExpensesRoute,
  otherExpenseNewRoute,
  otherExpenseDetailRoute,
  otherExpenseEditRoute,
]);

export const appRouter = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
