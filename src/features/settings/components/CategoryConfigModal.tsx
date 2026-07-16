import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createCategoryFinish,
  createCategoryService,
  deleteCategoryFinish,
  deleteCategoryService,
  fetchCategoryFinishes,
  fetchCategoryServices,
  setCategoryFinishDefault,
  setCategoryServiceDefault,
} from "@/db/queries/categories";
import type { ProductCategoryDto } from "@/types/category";

interface CategoryConfigModalProps {
  /** Categoría en configuración. */
  category: ProductCategoryDto;
  /** Callback al cerrar el modal. */
  onClose: () => void;
}

/**
 * Modal para configurar los servicios/áreas y acabados de una categoría.
 *
 * Los servicios marcados como "por defecto" se preseleccionan al crear una
 * línea de pedido de esa categoría; el usuario podrá desmarcarlos. Los acabados
 * son siempre opcionales.
 *
 * @param props - Categoría y callback de cierre.
 * @returns Modal de configuración de servicios y acabados.
 */
export function CategoryConfigModal(props: CategoryConfigModalProps) {
  const { category, onClose } = props;
  const queryClient = useQueryClient();
  const [newService, setNewService] = useState("");
  const [newFinish, setNewFinish] = useState("");

  const servicesQuery = useQuery({
    queryKey: ["category-services"],
    queryFn: fetchCategoryServices,
  });
  const finishesQuery = useQuery({
    queryKey: ["category-finishes"],
    queryFn: fetchCategoryFinishes,
  });

  const services = (servicesQuery.data ?? []).filter((s) => s.categoryId === category.id);
  const finishes = (finishesQuery.data ?? []).filter((f) => f.categoryId === category.id);

  const invalidateServices = () =>
    queryClient.invalidateQueries({ queryKey: ["category-services"] });
  const invalidateFinishes = () =>
    queryClient.invalidateQueries({ queryKey: ["category-finishes"] });

  const addService = useMutation({
    mutationFn: () => createCategoryService(category.id, newService.trim(), true),
    onSuccess: async () => {
      setNewService("");
      await invalidateServices();
    },
  });
  const toggleService = useMutation({
    mutationFn: (args: { id: number; isDefault: boolean }) =>
      setCategoryServiceDefault(args.id, args.isDefault),
    onSuccess: () => void invalidateServices(),
  });
  const removeService = useMutation({
    mutationFn: (id: number) => deleteCategoryService(id),
    onSuccess: () => void invalidateServices(),
  });

  const addFinish = useMutation({
    mutationFn: () => createCategoryFinish(category.id, newFinish.trim(), false),
    onSuccess: async () => {
      setNewFinish("");
      await invalidateFinishes();
    },
  });
  const toggleFinish = useMutation({
    mutationFn: (args: { id: number; isDefault: boolean }) =>
      setCategoryFinishDefault(args.id, args.isDefault),
    onSuccess: () => void invalidateFinishes(),
  });
  const removeFinish = useMutation({
    mutationFn: (id: number) => deleteCategoryFinish(id),
    onSuccess: () => void invalidateFinishes(),
  });

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="text-lg font-bold">Configurar: {category.name}</h3>
        <p className="mt-1 text-sm text-base-content/60">
          Define qué servicios/áreas requiere esta categoría (se preseleccionan al crear una línea,
          desmarcables) y los acabados posibles (siempre opcionales).
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <h4 className="font-semibold">Servicios / áreas</h4>
            <div className="flex gap-1">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder="Ej. Impresión"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newService.trim()) {
                    void addService.mutateAsync();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!newService.trim() || addService.isPending}
                onClick={() => void addService.mutateAsync()}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {addService.isError && (
              <p className="text-xs text-error">{(addService.error as Error).message}</p>
            )}
            <ul className="space-y-1">
              {services.length === 0 && (
                <li className="text-xs text-base-content/50">Sin servicios configurados.</li>
              )}
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-base-300 px-2 py-1">
                  <span className="text-sm">{s.service}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={s.isDefault}
                        onChange={(e) =>
                          void toggleService.mutateAsync({ id: s.id, isDefault: e.target.checked })
                        }
                      />
                      Por defecto
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => void removeService.mutateAsync(s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold">Acabados</h4>
            <div className="flex gap-1">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder="Ej. Brillo"
                value={newFinish}
                onChange={(e) => setNewFinish(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFinish.trim()) {
                    void addFinish.mutateAsync();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!newFinish.trim() || addFinish.isPending}
                onClick={() => void addFinish.mutateAsync()}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {addFinish.isError && (
              <p className="text-xs text-error">{(addFinish.error as Error).message}</p>
            )}
            <ul className="space-y-1">
              {finishes.length === 0 && (
                <li className="text-xs text-base-content/50">Sin acabados configurados.</li>
              )}
              {finishes.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded border border-base-300 px-2 py-1">
                  <span className="text-sm">{f.finish}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={f.isDefault}
                        onChange={(e) =>
                          void toggleFinish.mutateAsync({ id: f.id, isDefault: e.target.checked })
                        }
                      />
                      Por defecto
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => void removeFinish.mutateAsync(f.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={onClose} />
    </dialog>
  );
}
