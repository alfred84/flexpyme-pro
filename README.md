# FlexPyme Pro

Aplicación de escritorio **offline** para la gestión integral de un taller de impresión gráfica.
La fuente de verdad de requisitos es [`REQUIREMENTS.md`](./REQUIREMENTS.md) (**v2.5 — Reenfoque a Producción**).

## Módulos (v2.5)

- **Dashboard**: KPIs del mes, ingresos por categoría (Recharts), pedidos recientes y alertas.
- **Pedidos** (`/pedidos`): alta multi-producto con servicios auto-seleccionados por categoría (línea → varios `invoice_items`), detalle con registro de trabajo, impresión, cobro integrado (CUP/USD + vuelto) y filtros (en producción, listos, pendiente cobro). `/stock` redirige al filtro listos.
- **Reportes de producción** (`/reportes-produccion`): por Área/día/formato (Realizado vs Pendiente) y comparativa Factura vs Salario.
- **Facturas** (`/facturas`): vista financiera sobre los mismos pedidos (cobrada/parcial/pendiente/anulada).
- **Clientes**: CRUD, balance y ficha con historial.
- **Empleados**: CRUD con baja (soft delete), multi-rol, lotes de trabajo, nómina diaria y pago de salarios desde `cost_list`.
- **Inventario**: ítems, movimientos, recetas de producción; descuento al **concluir cada línea/servicio**; déficit permitido con bandera en línea y pedido.
- **Flujo de Caja**: balance CUP/USD, neto del día + neto de 30 días, serie diaria, movimientos con denominaciones, historial filtrable y enlaces a pedidos.
- **Precios** y **Costos**: entradas del sidebar (debajo de Flujo de Caja).
- **Otros gastos** (`/otros-gastos`): listado y KPIs; alta en `/otros-gastos/nuevo`; detalle y edición por gasto; tipos configurables; cada gasto genera egreso en caja.
- **Reportes**: exportes y resúmenes generales.
- **Configuración**: tabs General, Tasa de cambio, Roles, Categorías (servicios/acabados), Unidades, Formatos, Tipos de trabajo y Backup.

## Moneda

- Principal **CUP**; secundaria **USD** con tasa almacenada por operación.
- Denominaciones CUP: 1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000.
- Denominaciones USD: 100, 50, 20, 10, 5, 2, 1.
- Fechas en UI: **dd/mm/aaaa**.
- La tasa USD→CUP se actualiza desde el badge de la cabecera (modal) o desde Configuración > Tasa de cambio; cada cambio queda en el histórico.

## Stack Tecnologico

- Tauri v2 + Rust
- React 18 + TypeScript
- Tailwind CSS v3 + DaisyUI v4 (tema oscuro `business` por defecto)
- TanStack Router v1 + TanStack Query v5
- Drizzle ORM + SQLite
- React Hook Form + Zod
- TanStack Table v8
- Recharts
- Lucide React (iconos)
- Vitest + Testing Library

## Requisitos Previos

- Node.js 20+
- pnpm 10+
- Rust toolchain estable

## Instalacion

```bash
pnpm install
pnpm dev
```

Para ejecutar app de escritorio:

```bash
pnpm tauri dev
```

## Estructura Base

- `src/`: frontend React feature-sliced
- `src-tauri/`: backend Rust y commands Tauri
- `src/db/`: schema y migraciones Drizzle
- `.cursor/rules/`: reglas operativas del proyecto

## Repositorio en GitHub

El proyecto ya tiene Git inicializado y un commit en la rama `main`. Para crear el repositorio remoto y subir el código:

1. Inicia sesión con GitHub CLI (una vez):

   ```bash
   gh auth login
   ```

2. Desde la raíz del proyecto, crea el repo público y haz push (ajusta el nombre si ya existe):

   ```bash
   gh repo create flexpyme-pro --public --source=. --remote=origin --push
   ```

Si prefieres crear el repositorio vacío en la web de GitHub, añade el remoto y sube:

```bash
git remote add origin https://github.com/TU_USUARIO/flexpyme-pro.git
git push -u origin main
```

## Base de datos (SQLite)

En desarrollo, el archivo de trabajo por defecto es `.local/flexpyme.db` (fuera de `src-tauri` para evitar reinicios del watcher).

En release/ejecutable portable, la app usa siempre `flexpyme.db` junto al ejecutable:

- Si `flexpyme.db` existe en el directorio del ejecutable, se carga como BD activa.
- Si no existe, la app lo crea y aplica el esquema vigente.
- Los respaldos se guardan en `backups/` junto a `flexpyme.db`.
- La ubicación de la BD no se mueve desde la UI; se respalda o restaura desde Configuración > Backup.

1. Aplicar migraciones (o usar seed, que las aplica antes de insertar datos):

```bash
pnpm db:migrate
```

2. Cargar datos iniciales (categorías, formatos, precios base y clientes desde `data/Reporte___TOTAL.xlsx` si existe):

```bash
pnpm db:seed
```

Si la migración falla por tablas duplicadas, borra `.local/flexpyme.db` y vuelve a ejecutar `pnpm db:migrate` o `pnpm db:seed`.

### Backups y restauración

En **Configuración > Backup**:

- Crear respaldo manual con nombre `flexpyme-backup-manual-YYYYMMDD-HHMMSS.db`.
- Configurar backup automático cada N días (por defecto 5).
- Ver los últimos 5 backups también visibles desde Dashboard.
- Restaurar/importar una BD `.db` compatible. La app valida integridad y esquema, crea un respaldo previo y reemplaza la BD activa conservando el nombre `flexpyme.db`.

## Clientes

En la app (`pnpm tauri dev`), abre **Clientes** en la barra superior: listado con búsqueda, alta, ficha y edición. Los datos se leen y escriben en SQLite mediante comandos Tauri (`clients_*`).

## Precios

En **Precios** (`/precios`) puedes ver la lista de precios (activos por defecto; opción para incluir inactivos), filtrar en tabla y **editar precio, costo y estado activo** en un modal. En **Costos** (`/costos`) se editan los precios de mano de obra para empleados.

## Pedidos

En **Pedidos** (`/pedidos`): listado, **Nuevo pedido** con encabezado compacto, líneas en tabla (alta/edición en modal con servicios por categoría y precio desde lista), método de pago y **cobro integrado** (denominaciones CUP/USD y vuelto). Totales del pedido: `total = subtotal - anticipo`. Al guardar se actualiza el balance del cliente. Comandos: `invoices_list`, `invoices_get_detail`, `invoices_create`, `cashier_register_payment`.

## Empleados, Inventario, Caja y Gastos

- **Empleados**: `employees_*` (CRUD + baja + roles extra), `payroll_daily`, `cost_list_for_work_type`, `work_batch_create`, `work_batches_for_employee`, `work_batch_pay`.
- **Inventario**: `inventory_items_list`, `inventory_item_get/create/update`, `inventory_movement_register`, `inventory_movements_for_item`; descuento por línea concluida con déficit permitido.
- **Caja**: `cash_balance`, `cash_transactions_list`, `cash_daily_series`, `cash_net_summary`, `cash_transaction_create`.
- **Otros gastos**: `other_expenses_*` (listado, detalle, alta, edición, borrado; egreso en caja); `expense_types_*` (catálogo de tipos para el select).
- **Producción**: `production_report_monthly`.
- **Configuración**: `settings_get_all`, `settings_set_value`, `settings_backup_database`, `settings_get_backup_overview`, `settings_restore_database`, `cost_list_all`, `cost_update`.
