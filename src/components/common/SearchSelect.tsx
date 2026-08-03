import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown, Search, X } from "lucide-react";

/** Opción de un selector con búsqueda. */
export interface SearchSelectOption {
  /** Valor estable de la opción (string para unificar ids y textos). */
  value: string;
  /** Texto mostrado al usuario. */
  label: string;
  /** Texto adicional para filtrar (si no se indica, se usa `label`). */
  searchText?: string;
}

interface SearchSelectProps {
  /** Id del input (asociación con label). */
  id?: string;
  /** Valor seleccionado (`""` = ninguno). */
  value: string;
  /** Opciones disponibles. */
  options: SearchSelectOption[];
  /** Callback al elegir o limpiar. */
  onChange: (value: string) => void;
  /** Texto cuando no hay selección. */
  placeholder?: string;
  /** Deshabilita interacción. */
  disabled?: boolean;
  /** Muestra botón para limpiar la selección. */
  allowClear?: boolean;
  /** Etiqueta accesible del botón limpiar. */
  clearLabel?: string;
  /** Máximo de resultados visibles tras filtrar. */
  maxResults?: number;
  /** Clase CSS extra del input. */
  className?: string;
}

const DEFAULT_MAX_RESULTS = 80;

interface ListPosition {
  top: number;
  left: number;
  width: number;
  /** Si true, el panel se abre hacia arriba del input. */
  openUpward: boolean;
}

/**
 * Normaliza texto para búsqueda (minúsculas, sin acentos).
 *
 * @param value - Texto de entrada.
 * @returns Cadena normalizada.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Contenedor del portal del listbox.
 * Si el combobox está dentro de un `<dialog>` (capa superior nativa), el portal
 * debe anclarse ahí; si no, cualquier hijo de `body` queda detrás del modal.
 *
 * @param anchor - Elemento del combobox.
 * @returns Nodo donde montar el listbox.
 */
function resolvePortalRoot(anchor: HTMLElement | null): HTMLElement {
  const dialog = anchor?.closest("dialog");
  if (dialog) {
    return dialog;
  }
  return document.body;
}

/**
 * Combobox genérico con búsqueda para listas largas.
 *
 * Filtra por etiqueta (o `searchText`), soporta teclado y renderiza el panel
 * en un portal con posición fija. Si hay un `<dialog>` ancestro, el portal se
 * monta dentro de él para respetar la capa superior del navegador.
 *
 * @param props - Valor, opciones y callbacks.
 * @returns Combobox con búsqueda.
 */
export function SearchSelect(props: SearchSelectProps) {
  const {
    id,
    value,
    options,
    onChange,
    placeholder = "Buscar o seleccionar…",
    disabled = false,
    allowClear = true,
    clearLabel = "Quitar selección",
    maxResults = DEFAULT_MAX_RESULTS,
    className = "",
  } = props;

  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [position, setPosition] = useState<ListPosition | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const normalizedQuery = normalizeSearchText(query);

  const filtered = options.filter((option) => {
    if (!normalizedQuery) return true;
    const haystack = normalizeSearchText(option.searchText ?? option.label);
    return haystack.includes(normalizedQuery);
  });

  const visible = filtered.slice(0, maxResults);
  const hasMore = filtered.length > maxResults;

  /**
   * Recalcula la posición del listbox bajo el input.
   */
  function updatePosition() {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxHeight = 224; // max-h-56
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < maxHeight && rect.top > spaceBelow;
    setPosition({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUpward,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      setPortalRoot(null);
      return;
    }
    setPortalRoot(resolvePortalRoot(containerRef.current));
    updatePosition();
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;

    /**
     * Cierra el panel al hacer clic fuera del combobox y del listbox.
     *
     * @param event - Evento de puntero del documento.
     */
    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery("");
    }

    /**
     * Reposiciona el panel al hacer scroll o redimensionar.
     */
    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlightIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  /**
   * Abre el panel de opciones.
   */
  function openPanel() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
  }

  /**
   * Cierra el panel y limpia la consulta.
   */
  function closePanel() {
    setOpen(false);
    setQuery("");
  }

  /**
   * Aplica la selección y cierra el panel.
   *
   * @param nextValue - Valor elegido.
   */
  function selectOption(nextValue: string) {
    onChange(nextValue);
    closePanel();
  }

  /**
   * Limpia la selección actual.
   *
   * @param event - Evento del botón limpiar.
   */
  function clearSelection(event: ReactMouseEvent) {
    event.stopPropagation();
    onChange("");
    setQuery("");
    if (open) {
      inputRef.current?.focus();
    }
  }

  /**
   * Navegación por teclado del combobox.
   *
   * @param event - Evento de teclado en el input.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        openPanel();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, Math.max(visible.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const choice = visible[highlightIndex];
      if (choice) {
        selectOption(choice.value);
      }
    }
  }

  const displayValue = open ? query : (selected?.label ?? "");
  const showClear = allowClear && value !== "" && !disabled;

  const listbox =
    open && position ? (
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        className="fixed z-[9999] max-h-56 overflow-y-auto rounded-box border border-base-300 bg-base-100 py-1 shadow-lg"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          transform: position.openUpward ? "translateY(-100%)" : undefined,
        }}
      >
        {visible.length === 0 ? (
          <li className="px-3 py-2 text-xs text-base-content/60">Sin resultados</li>
        ) : (
          visible.map((option, index) => {
            const active = index === highlightIndex;
            const selectedOption = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listboxId}-option-${option.value}`}
                role="option"
                aria-selected={selectedOption}
                className={`cursor-pointer px-3 py-1.5 text-sm ${
                  active ? "bg-primary text-primary-content" : "hover:bg-base-200"
                }`}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(option.value);
                }}
              >
                {option.label}
              </li>
            );
          })
        )}
        {hasMore ? (
          <li className="border-t border-base-300 px-3 py-1.5 text-[11px] text-base-content/50">
            Mostrando {maxResults} de {filtered.length}. Afina la búsqueda…
          </li>
        ) : null}
      </ul>
    ) : null;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/40" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && visible[highlightIndex]
              ? `${listboxId}-option-${visible[highlightIndex].value}`
              : undefined
          }
          className={`input input-bordered input-sm w-full pl-7 pr-14 ${className}`}
          value={displayValue}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={openPanel}
          onClick={openPanel}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {showClear ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              aria-label={clearLabel}
              onClick={clearSelection}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            aria-label={open ? "Cerrar lista" : "Abrir lista"}
            disabled={disabled}
            tabIndex={-1}
            onClick={() => (open ? closePanel() : openPanel())}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {listbox && portalRoot ? createPortal(listbox, portalRoot) : null}
    </div>
  );
}
