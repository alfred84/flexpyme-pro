import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { UnitSelect } from "@/components/inventory/UnitSelect";
import { createInventoryItem } from "@/db/queries/inventory";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Alta de ítem de inventario.
 *
 * @returns Página de creación de ítem.
 */
export function InventoryNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [costPerUnit, setCostPerUnit] = useState("0");
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      pushFlashMessage({ kind: "success", text: "Ítem creado correctamente." });
      await navigate({ to: "/inventario/$itemId", params: { itemId: String(id) } });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!unitId) {
      setError("Selecciona una unidad de medida.");
      return;
    }
    await mutation.mutateAsync({
      name: name.trim(),
      category: category.trim() || null,
      unitId,
      quantity: Number(quantity) || 0,
      minStock: Number(minStock) || 0,
      costPerUnit: Number(costPerUnit) || 0,
      supplier: supplier.trim() || null,
      notes: null,
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nuevo ítem de inventario</h1>
        <Link to="/inventario" className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>

      {(error || mutation.isError) && (
        <div className="alert alert-error">
          <span>{error ?? (mutation.error as Error)?.message ?? "No se pudo crear el ítem."}</span>
        </div>
      )}

      <form className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="form-control sm:col-span-2">
          <label className="label" htmlFor="inv-name">
            <span className="label-text">Nombre</span>
          </label>
          <input id="inv-name" className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="inv-category">
            <span className="label-text">Categoría</span>
          </label>
          <input
            id="inv-category"
            className="input input-bordered"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="inv-unit">
            <span className="label-text">Unidad</span>
          </label>
          <UnitSelect id="inv-unit" value={unitId} onChange={setUnitId} />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="inv-qty">
            <span className="label-text">Stock inicial</span>
          </label>
          <input
            id="inv-qty"
            type="number"
            className="input input-bordered"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="inv-min">
            <span className="label-text">Stock mínimo</span>
          </label>
          <input
            id="inv-min"
            type="number"
            className="input input-bordered"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="inv-cost">
            <span className="label-text">Costo por unidad (CUP)</span>
          </label>
          <input
            id="inv-cost"
            type="number"
            className="input input-bordered"
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="inv-supplier">
            <span className="label-text">Proveedor</span>
          </label>
          <input
            id="inv-supplier"
            className="input input-bordered"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Crear ítem"}
          </button>
        </div>
      </form>
    </section>
  );
}
