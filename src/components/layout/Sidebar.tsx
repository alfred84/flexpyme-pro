import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/config/navigation";
import { useSidebarBadges } from "@/hooks/use-sidebar-badges";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  businessName: string;
}

/**
 * Navegación lateral colapsable con iconos Lucide y resaltado de ruta activa.
 *
 * @param props - Estado de colapso, callback de toggle y nombre del negocio.
 * @returns Barra lateral de navegación.
 */
export function Sidebar(props: SidebarProps) {
  const { collapsed, onToggle, businessName } = props;
  const badges = useSidebarBadges();

  return (
    <aside
      className={`flex h-screen flex-col border-r border-base-300 bg-base-200 transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-16 items-center gap-2 border-b border-base-300 px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-content">
          <Printer className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">FlexPyme Pro</p>
            <p className="truncate text-xs text-base-content/60">{businessName}</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {PRIMARY_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} count={item.badge ? badges[item.badge] : 0} />
        ))}
      </nav>

      <div className="border-t border-base-300 p-2">
        {SECONDARY_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} count={0} />
        ))}
        <button
          type="button"
          onClick={onToggle}
          className="btn btn-ghost btn-sm mt-1 w-full justify-start gap-3"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}

interface SidebarLinkProps {
  item: NavItem;
  collapsed: boolean;
  count: number;
}

/**
 * Enlace individual del sidebar con icono, etiqueta opcional y badge.
 *
 * @param props - Ítem de navegación, estado de colapso y contador del badge.
 * @returns Enlace de navegación.
 */
function SidebarLink(props: SidebarLinkProps) {
  const { item, collapsed, count } = props;
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-base-content/80 transition-colors hover:bg-base-300"
      activeProps={{ className: "bg-primary/15 text-primary font-medium" }}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {count > 0 && (
        <span className={`badge badge-sm badge-warning ${collapsed ? "absolute ml-7 -mt-4" : ""}`}>{count}</span>
      )}
    </Link>
  );
}
