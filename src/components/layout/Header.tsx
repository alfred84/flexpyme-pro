import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { DollarSign, Moon, Sun } from "lucide-react";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/config/navigation";
import { ExchangeRateModal } from "@/components/common/ExchangeRateModal";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import type { ThemeName } from "@/lib/theme";

interface HeaderProps {
  theme: ThemeName;
  onToggleTheme: () => void;
}

/**
 * Deriva el título de la página actual a partir de la ruta y la navegación.
 *
 * @param pathname - Ruta actual.
 * @returns Etiqueta de la sección activa.
 */
function resolvePageTitle(pathname: string): string {
  const all = [...PRIMARY_NAV, ...SECONDARY_NAV];
  const exact = all.find((item) => item.to === pathname);
  if (exact) {
    return exact.label;
  }
  const prefix = all
    .filter((item) => item.to !== "/" && pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return prefix?.label ?? "Inicio";
}

/**
 * Cabecera superior: título de sección, indicador de tasa USD/CUP, fecha y
 * conmutador de tema.
 *
 * @param props - Tema actual y callback para alternarlo.
 * @returns Barra de cabecera.
 */
export function Header(props: HeaderProps) {
  const { theme, onToggleTheme } = props;
  const settings = useAppSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = resolvePageTitle(pathname);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const today = formatDate(new Date());

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-base-300 bg-base-100 px-6 print:hidden">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          <p className="truncate text-xs capitalize text-base-content/60">{today}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRateModalOpen(true)}
            className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content"
            title="Clic para actualizar la tasa de cambio"
          >
            <DollarSign size={12} className="text-success transition-transform group-hover:scale-110" />
            <span>
              1 USD ={" "}
              {settings.usdExchangeRate > 0 ? formatMoney(settings.usdExchangeRate) : "—"}
            </span>
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Cambiar tema claro/oscuro"
          >
            {theme === "business" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <ExchangeRateModal open={rateModalOpen} source="header" onClose={() => setRateModalOpen(false)} />
    </>
  );
}
