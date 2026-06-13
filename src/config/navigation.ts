import {
  LayoutDashboard,
  ShoppingCart,
  PackageCheck,
  FileText,
  Users,
  UserCog,
  Package,
  Wallet,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Tipo de badge que puede mostrar un ítem del sidebar.
 * - `pedidosPendientes`: pedidos en producción
 * - `stockListo`: pedidos listos sin cobrar
 * - `facturasPendientes`: facturas con saldo pendiente
 * - `stockBajo`: ítems de inventario bajo mínimo
 */
export type NavBadgeKey = "pedidosPendientes" | "stockListo" | "facturasPendientes" | "stockBajo";

/**
 * Definición de un ítem de navegación lateral.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: NavBadgeKey;
}

/**
 * Navegación principal del taller (sidebar). Orden según REQUIREMENTS §5.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, badge: "pedidosPendientes" },
  { to: "/stock", label: "Stock", icon: PackageCheck, badge: "stockListo" },
  { to: "/facturas", label: "Facturas", icon: FileText, badge: "facturasPendientes" },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/empleados", label: "Empleados", icon: UserCog },
  { to: "/inventario", label: "Inventario", icon: Package, badge: "stockBajo" },
  { to: "/caja", label: "Flujo de Caja", icon: Wallet },
  { to: "/reportes", label: "Reportes", icon: BarChart3 },
];

/**
 * Navegación secundaria (parte inferior del sidebar).
 */
export const SECONDARY_NAV: NavItem[] = [
  { to: "/configuracion", label: "Configuración", icon: Settings },
];
