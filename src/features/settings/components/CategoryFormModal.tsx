import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { createCategory, updateCategory } from "@/db/queries/categories";
import { CATEGORY_ICON_MAP, resolveCategoryIcon } from "@/lib/category-icons";
import { slugify } from "@/lib/slugify";
import type { ProductCategoryDto } from "@/types/category";

const ICON_OPTIONS = Object.keys(CATEGORY_ICON_MAP);

interface CategoryIconSelectProps {
  /** Nombre del icono seleccionado (`CATEGORY_ICON_MAP`). */
  value: string;
  /** Callback al elegir un icono. */
  onChange: (icon: string) => void;
}

/**
 * Selector de icono de categoría: cada opción muestra el nombre y el icono a la derecha.
 *
 * @param props - Valor actual y callback de cambio.
 */
function CategoryIconSelect(props: CategoryIconSelectProps) {
  const { value, onChange } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const SelectedIcon = resolveCategoryIcon(value);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="input input-bordered flex h-12 w-full items-center justify-between gap-3 pe-3 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Icono de categoría"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{value}</span>
        <span className="flex items-center gap-2">
          <SelectedIcon className="h-5 w-5 shrink-0" aria-hidden />
          <ChevronDown
            className={`h-4 w-4 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-base-300 bg-base-100 py-1 shadow-lg"
        >
          {ICON_OPTIONS.map((opt) => {
            const Icon = resolveCategoryIcon(opt);
            const selected = opt === value;
            return (
              <li key={opt} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-base-200 ${
                    selected ? "bg-base-200 font-medium" : ""
                  }`}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <span>{opt}</span>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface CategoryFormModalProps {
  /** Categoría a editar; `null` para alta. */
  category: ProductCategoryDto | null;
  /** Cierra el modal. */
  onClose: () => void;
  /** Tras guardar con éxito (alta o edición). */
  onSaved?: (category: ProductCategoryDto) => void;
}

/**
 * Modal de alta o edición de categoría de producto.
 * Misma pantalla que Configuración → Categorías de productos → Nueva categoría.
 *
 * @param props - Categoría opcional, cierre y callback de guardado.
 */
export function CategoryFormModal(props: CategoryFormModalProps) {
  const { category, onClose, onSaved } = props;
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "Tag");
  const [sortOrder, setSortOrder] = useState(category ? String(category.sortOrder) : "10");
  const [codeTouched, setCodeTouched] = useState(category != null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        code: code.trim() || slugify(name),
        description: description.trim() || null,
        icon,
        sortOrder: Number.parseInt(sortOrder, 10) || 10,
      };
      if (category) {
        return updateCategory(category.id, payload);
      }
      return createCategory(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      onClose();
      onSaved?.(saved);
    },
  });

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box overflow-visible">
          <h3 className="font-bold text-lg">{category ? "Editar categoría" : "Nueva categoría"}</h3>
          <div className="mt-4 space-y-3">
            <label className="form-control">
              <span className="label-text">Nombre *</span>
              <input
                className="input input-bordered"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!codeTouched) {
                    setCode(slugify(e.target.value));
                  }
                }}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Código *</span>
              <input
                className="input input-bordered font-mono"
                value={code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value);
                }}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Descripción</span>
              <input
                className="input input-bordered"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="form-control">
              <span className="label-text">Icono</span>
              <CategoryIconSelect value={icon} onChange={setIcon} />
            </div>
            <label className="form-control">
              <span className="label-text">Orden</span>
              <input className="input input-bordered" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </label>
          </div>
          {saveMutation.isError && (
            <p className="mt-2 text-sm text-error">{(saveMutation.error as Error).message}</p>
          )}
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saveMutation.isPending}
              onClick={() => void saveMutation.mutateAsync()}
            >
              {saveMutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Guardar categoría"
              )}
            </button>
          </div>
        </div>
        <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={onClose} />
      </dialog>
    </ModalPortal>
  );
}
