# REQUIREMENTS.md — FlexPyme Pro
## Taller de Impresión Gráfica · Requisitos del Sistema

### Versión: 2.27 | Última actualización: 2026-08-27

> **v2.5 — Reenfoque a Producción**: producción/salario/inventario se derivan de
> los trabajos concluidos por Área/día ligados a pedidos. Novedades: Reportes de
> producción, Otros gastos, cuadrículas de denominaciones CUP+USD con vuelto que
> afecta caja, automatización de líneas por categoría (servicios/acabados
> configurables), inventario con materiales por línea (descuento al marcar Listo),
> empleados multi-rol con nómina diaria, caja con neto diario + 30 días, y fecha
> `dd/mm/aaaa` en toda la UI.

---

## 1. Descripción General

FlexPyme Pro es una aplicación de escritorio **completamente offline** para gestión
integral de un taller de impresión gráfica. Corre en Windows via Tauri v2.
Un único usuario la opera desde una laptop para recepcionar pedidos, gestionar
clientes, controlar inventario, pagar empleados y llevar el flujo de caja.

---

## 2. Stack Tecnológico (OBLIGATORIO — no sustituir)

| Capa | Tecnología |
|------|-----------|
| Desktop runtime | Tauri v2 (Rust + WebView2) |
| Frontend | React 18 + TypeScript (strict) |
| Estilos | Tailwind CSS v3 + DaisyUI v4 |
| Routing | TanStack Router v1 |
| Server state | TanStack Query v5 |
| Tablas | TanStack Table v8 |
| Formularios | React Hook Form + Zod |
| Gráficas | Recharts |
| Base de datos | SQLite vía Tauri commands |
| ORM | Drizzle ORM |
| Iconos | Lucide React |
| Documentación | JSDoc (obligatorio en toda función pública) |
| Tests | Vitest + @testing-library/react |
| VCS | Git + GitHub (Conventional Commits, commits atómicos) |

---

## 3. Módulos del Sistema

### 3.1 Inicio
- KPIs: facturación del día/mes, pedidos pendientes, cobros pendientes
- Gráfico de ingresos por categoría de producto (Recharts)
- Lista de pedidos recientes con estado
- Accesos rápidos a las acciones más frecuentes

### 3.2 Pedidos
- Recepcionar pedidos de clientes (crear orden de trabajo)
- Cada pedido contiene: cliente, productos/servicios, cantidades, precios, fecha
- **Estados de pedido: `pendiente` | `ejecutado`** (solo estos dos)
- Al confirmar un pedido → estado automático: `pendiente`
- Al marcar como listo → estado: `ejecutado`
- Filtros por estado, cliente, fecha
- Vista detalle de pedido con todos los ítems
- **Editar pedido**: permitido solo si no está anulado, no está listo y aún no hay trabajo registrado (sin `completed_quantity` ni lotes). Se pueden cambiar cliente, fecha, notas y líneas; los cobros ya hechos se conservan y el saldo se recalcula (no se permite bajar el total por debajo de lo pagado)
- **Anular pedido**: motivo obligatorio; revierte cobros en caja e inventario descontado; no se permite si está totalmente cobrado; los lotes/nómina históricos se conservan. También disponible desde Facturas
- **Resumen por tipo de trabajo**: debajo de las líneas, cantidades globales agrupadas por tipo (el importe de venta es del producto terminado, no se suma por tipo)
- **Asignación de empleados en líneas**: al crear/editar, por cada tipo de trabajo de la línea, botón **Empleados** para seleccionar 1..N trabajadores elegibles (rol primario/secundario con ese tipo de trabajo en Configuración). Varios pueden colaborar en la misma unidad (p. ej. cantidad 1 y 2 laminadores). Tarifa de pago personalizada opcional por empleado
- **Status por línea** en Ver pedido: `En producción` | `Listo`; botón para confirmar Listo (modal con empleados, cantidades y tarifas editables → crea `production_batches`). Si varios colaboran en la misma unidad, cada uno cobra su cantidad de nómina (≤ unidades pendientes); el inventario se descuenta una sola vez. Si todas las líneas están Listo, el pedido pasa a `production_status=listo`. **Marcar listo** en el listado aplica el mismo flujo a todas las líneas pendientes (requiere asignaciones)
- Se eliminó **Registrar trabajo** del detalle; la asignación ocurre en crear/editar líneas
- Historial de pedidos por cliente
- **Aviso de saldo a favor al cobrar**: si el cliente ya tiene crédito o el cobro va a dejarlo, un modal informativo resume importes (existente, aplicado, nuevo y saldo resultante) antes de confirmar

**Tipos de productos en un pedido (del taller):**
- Fotos/Ampliaciones (formatos 5x7 → 24x60, servicios: Impresión / Laminado / Enmarcado)
- Lienzo (Impresión / Ojete / Enmarcado / Bastidor)
- Revistas (Presilla y Lomo Duro, acabados: Brillo / 3D / Diamantado)
- Álbumes (estándar y genéricos, acabados múltiples)
- Cajas fotográficas
- Títulos
- Fotobooks/Book Mini
- Lonas
- Llaveros (simples y acrílicos)

### 3.3 Clientes
- CRUD completo: nombre, código, teléfono, dirección, notas
- Historial de pedidos y pagos por cliente
- Balance/deuda acumulada
- Búsqueda y filtrado en tiempo real

### 3.4 Empleados
- CRUD completo: nombre, rol, teléfono, activo/baja
- Gestión de pagos de salario según tipo de trabajo:
  - **Laminado**: pago por unidad según formato (5x7-10x15: 10 CUP, 8x12-10x15: 16, 12x16/18: 20, 16x20-20x24: 26, 24x32: 30, 24x39: 40, 24x60: 50)
  - **Enmarcado completo**: pago por formato (5x7-10x15: 10, 12x16/18: 10, 16x20-20x24: 20, 24x32/39: 25, 24x60: 60)
  - **Solo Respaldo**: mismos precios que enmarcado
  - **Impresión**: 5x7-10x15: 5, 12x16/18: 10, 16x20-20x24: 15, 24x32/39: 20, 24x60: 50
- Registro de lotes de trabajo: fecha, tipo, cantidades por formato y cliente
- Los lotes pueden vincularse a un **pedido** (`production_batch_items.invoice_id`) al marcar Listo en el detalle (o Marcar listo en listado)
- Cálculo automático del salario a pagar (tarifa de Precios o personalizada en la asignación del pedido)
- **Forma de salario (excluyente)**: en alta/edición, el empleado elige una de:
  - **Por producción**: cobra según tarifas de trabajo
  - **Salario fijo diario**: importe CUP predefinido; se genera cada día y se paga desde la nómina diaria (botón Pagar por empleado)
  - **Salario por destajo diario**: importe CUP editable en alta/edición (igual que el fijo); debe quedar definido cada día (botón **Definir** en el listado o al guardar el empleado) antes de pagar
  - **Salario fijo mensual**: importe CUP predefinido; **no** entra solo en la nómina. Desde el listado, **Habilitar** abre un modal para elegir el **día del mes**; entonces aparece como pendiente ese día. Un cobro por mes calendario. **Deshacer** solo el día en que se pagó
  - Los lotes de trabajo de empleados fijo/destajo/mensual se registran con costo 0 para no duplicar el pago
- Historial de pagos al empleado
- Dar de baja (soft delete, no eliminar)
- **Multi-rol (v2.5)**: cada empleado tiene un rol principal (`employees.role_id`) y puede tener roles adicionales (`employee_extra_roles`) para cuando cubre otra Área
- **Nómina diaria (v2.5 / v2.12)**: vista de salario por empleado del día seleccionado (por defecto hoy; selector de fecha), con total, pagado, pendiente y botón **Pagar** por empleado (modal de denominaciones Efectivo/CUP). **Deshacer** (solo el día actual) revierte el pago con ingreso compensatorio en caja
- Pago individual por lote desde el historial del empleado con el mismo modal reutilizable

### 3.5 Inventario
- Gestión de materiales/insumos del taller
- **Categorías de material** (CRUD del usuario): obligatorias antes de dar de alta ítems; se gestionan desde la opción **Categorías** en Inventario (modal); el listado agrupa ítems en acordeón por categoría
- Campos del ítem: categoría (obligatoria), nombre, **formato** (catálogo de Configuración; por defecto **Sin formato**), unidad, stock; **stock mínimo, costo unitario (CUP y/o USD, independientes) y proveedor opcionales**; descripción/apuntes; **edición** de datos del ítem (el stock solo cambia con movimientos)
- Stock mínimo `0` o vacío = **Sin establecer** (sin alertas de stock bajo). Alertas solo si mínimo &gt; 0 y cantidad ≤ mínimo
- Listado: mosaico compacto por categoría de material; al entrar, tabla de ítems y alta de ítem; sección **Movimientos** (día/mes) con método Manual vs Rebaja por Pedido vs Merma; **salida manual** (sin pedido) con **motivo obligatorio**; **normas** desde la opción **Normas** (modal)
- Historial de movimientos por ítem (salidas con motivo obligatorio)
- **Normas de producción**: por categoría de pedido + tipo de trabajo (tabs) + formato/acabado + material y cantidad/unidad; editables (solo afectan pedidos futuros); desactivadas ocultas con opción de ver/reactivar
- En **Pedidos**, por línea: asignar materiales manualmente desde almacén (opción por defecto) **o** aplicar norma (se fijan materiales al crear el pedido). Solo materiales **existentes** (stock 0 o insuficiente permitido; no crear ítems desde el modal)
- **Descuento por línea Listo**: al marcar Listo se descuentan materiales asignados o, si no hay, los de normas coincidentes; **solo si hay stock suficiente** (sin existencia negativa)
- **Mermas de producción**: desde el pedido (editar o detalle) se registra merma eligiendo material, cantidad y motivo (Error de impresión, Material defectuoso, Error de corte, Otro). Descuenta almacén (salida estricta, sin stock negativo), guarda el costo snapshot (CUP/USD del costo unitario del ítem × cantidad) y **no altera el precio al cliente**. Si ya hay mermas, el pedido muestra el historial. Al anular el pedido no se revierte el stock de merma (pérdida física). Inventario clasifica esas salidas como método **Merma**.
- **Déficit al asignar (v2.16)**: si al guardar el pedido el stock no cubre `cant./ud. × cantidad de línea`, se permite guardar y se marca `resource_missing` (línea y pedido) con nota de materiales faltantes. **No** se puede marcar Listo (línea ni pedido) hasta reponer con una **entrada** en Inventario; tras la entrada se recalculan las banderas. Inventario muestra alerta de demanda pendiente (necesario &gt; disponible)

### 3.6 Flujo de Caja
- Registro de todas las entradas y salidas de dinero
- Formas de pago:
  - **Efectivo**: con desglose por denominaciones de billetes
  - **Transferencia**: con referencia/concepto
- Denominaciones CUP disponibles: 1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000
- Denominaciones USD disponibles: 100, 50, 20, 10, 5, 2, 1
- Cajeros físicos independientes: `amount_cup` y `amount_usd` en `cash_transactions` son flujo real de cada moneda (no se escribe el equivalente convertido en la otra). La tasa se guarda por operación solo para auditoría
- Balance actual de caja (CUP y USD por separado); ingresos/egresos/neto también duales
- Módulo de cobro de facturas: ingresa billetes → exceso como **vuelto** (desglose; neto caja = recibido − vuelto) o como **saldo a favor** del cliente (ingreso completo en caja)
- **Anticipo de pedido**: CUP o USD, efectivo (con denominaciones) o transferencia; se registra como ingreso en caja
- **KPIs**: flujo neto del día y de los últimos 30 días en CUP y USD (más serie diaria dual)
- Historial de movimientos con filtros por fecha, tipo, concepto, moneda (CUP/USD/Mixto) y método; columnas CUP, USD y tasa
- Resumen diario/mensual por moneda
- Movimientos manuales y Otros gastos en USD afectan solo el cajón USD (`amount_cup = 0`)

### 3.7 Configuración
- Datos del negocio (nombre, dirección, teléfono, logo)
- Tasa de cambio USD → CUP (actualizable desde cabecera o Configuración; histórico de cambios)
- **Precios** como entrada del sidebar (debajo de Flujo de Caja), no como tab de Configuración. Incluye precios de venta (**USD por defecto**; CUP opcional, activables por fila) y **tarifas de pago** a trabajadores en CUP (antes «Costos»); la ruta legacy `/costos` redirige a `/precios`. El precio de venta CUP/USD es **único del producto terminado** (categoría + formato + acabado); las pestañas por tipo de trabajo lo muestran como referencia y no pueden divergir. La tarifa de pago sí es por tipo de trabajo. Cada moneda se define de forma independiente; se puede aplicar la tasa vigente de la app para derivar un precio a partir del otro. En el mosaico, **Nueva categoría** abre el mismo formulario que Configuración → Categorías de productos. Al entrar a una categoría, **Configurar** abre el mismo modal de tipos de trabajo, formatos y acabados.
- **Categorías** de productos (CRUD con `is_system`, snapshot en pedidos)
- **Roles de empleados**: catálogo `employee_roles`; cada rol puede asociarse a uno o más **tipos de trabajo** (`role_work_types`) que definen qué trabajos pueden realizar los empleados con ese rol (principal o secundario)
- **Tipos de trabajo, formatos y acabados por categoría**: tablas `category_work_types`, `category_formats` y `category_finishes` (vinculadas a los catálogos `work_types`, `formats` y `finishes`). Catálogo global de acabados en Configuración → Acabados. Al crear líneas se preseleccionan tipos y acabados «por defecto»; cada tipo se expande en un `invoice_item` para producción, pero el cobro es una sola vez (precio del producto).
- **Unidades** de medida (CRUD con tipo, snapshot en inventario)
- Formatos disponibles (alta, edición y baja de formatos). Incluye formato base **Sin formato** (0×0) para categorías sin medidas.
- Backup y restauración de la base de datos
- Preferencias de la aplicación

### 3.8 Bandeja de pedidos listos (antes Stock v2.2)
- Ya no hay entrada **Stock** en el sidebar; la bandeja de salida vive en **Pedidos** con filtro `listos`
- Rutas `/stock` redirigen a `/pedidos?filter=listos` (detalle → `/pedidos/:id`)
- Badge del sidebar en Pedidos = en producción + listos sin cobrar
- Al marcar **listo**: `production_completed_at`; el descuento de inventario ocurre por línea al marcar Listo (con stock suficiente), no al marcar todo el pedido listo de golpe sin cubrir materiales

### 3.9 Módulo Facturas (v2.2)
- Vista financiera/contable sobre la misma tabla `invoices` (1 pedido = 1 factura)
- KPIs por estado con importes reales CUP y USD (`due_*` / cobrado / saldos duales; sin conversión por tasa de app)
- Detalle con total/pagado/saldo dual e historial de pagos físicos (`cash_transactions`)
- Anulación con motivo y reverso en caja (sin borrado físico)
- Rutas `/facturas`, impresión y registro de pago

### 3.10 Reportes de producción (v2.5)
- Entrada de sidebar **Reportes producción** (tras Pedidos); ruta `/reportes-produccion`
- Tracking por línea: `invoice_items.completed_quantity` / `completed_at` vía lotes (`production_batch_items.invoice_id`)
- Vista mensual por Área (Impresión/Laminado/Enmarcado), día y formato: Realizado vs Pendiente e importes
- Comparativa Factura vs Salario vs Diferencia del mes en curso

### 3.11 Otros gastos (v2.5)
- Entrada de sidebar **Otros gastos** (tras Precios); ruta `/otros-gastos`
- Alta en pantalla dedicada `/otros-gastos/nuevo` (botón «Registrar gasto»); el listado muestra KPIs y el historial
- Detalle `/otros-gastos/:id` y edición `/otros-gastos/:id/editar` (la edición sincroniza el egreso en `cash_transactions`)
- Filtro rápido de periodo en el listado: **Día actual** (por defecto), **Mes actual** o **Todos**
- Tabla `other_expenses` (fecha, concepto, tipo, empleado opcional, montos CUP/USD, método, desglose de denominaciones)
- Cada gasto genera un `cash_transactions` (egreso) que afecta el balance de caja
- Vistas diaria y mensual
- **Tipos de gasto configurables**: catálogo `expense_types` (Almuerzo, Transporte, etc.) gestionable desde el botón «Configurar tipos de gasto»; el select «Tipo» lista solo tipos activos; el nombre se guarda como snapshot en el gasto

### 3.12 Base de datos portable y backups (v2.3)
- En release/ejecutable portable, la BD activa siempre se llama `flexpyme.db`.
- `flexpyme.db` vive en el mismo directorio donde está el ejecutable; si no existe, la app la crea y aplica el esquema vigente.
- Si existe `flexpyme.db` junto al ejecutable, la app la carga como BD activa del sistema.
- En desarrollo (`pnpm tauri dev`) se conserva `.local/flexpyme.db` para scripts, migraciones y evitar reinicios del watcher.
- La ubicación de BD no se mueve desde la UI; Configuración > Backup solo muestra ruta, abre carpeta, respalda y restaura.
- Backups manuales y programados se guardan en `backups/` junto a `flexpyme.db`.
- Nombre de backups: `flexpyme-backup-<tipo>-YYYYMMDD-HHMMSS.db`.
- Backup programado configurable por usuario; valor por defecto: **1 día** (cierres diarios).
- Inicio y Configuración > Backup muestran el histórico de los 5 últimos backups.
- La restauración manual permite seleccionar un fichero `.db` compatible, valida integridad/esquema, crea un backup de seguridad previo y reemplaza la BD activa conservando el nombre `flexpyme.db`.

---

## 4. Moneda y Pagos

- **Precios de venta**: USD por defecto; CUP permanece disponible por fila. En pedidos, `invoice_items.unit_price_usd` es la fuente de verdad; el CUP de línea = USD × `exchange_rate_snapshot` del pedido
- **Moneda de cobro del pedido**: `USD` | `CUP` | `mixto` (`payment_currency`). Transferencia fuerza cobro en CUP (el pedido puede ser mixto con parte CUP)
- **Mixto**: se declara el split `due_usd` + `due_cup` (debe cumplir `due_usd × tasa + due_cup ≈ total_cup`); en el cobro se pueden recibir y devolver billetes en ambas monedas
- **Saldo dual**: el pedido acumula `balance_usd` y saldo CUP (vía `balance` equivalente / parte CUP); listados y detalle muestran ambas cuando aplica
- **Libro contable**: totales espejo en CUP (`total`/`paid`/`balance` = equivalente CUP); cajas CUP y USD son flujos independientes (`balance_cup` / `balance_usd`)
- **UI de Pedidos**: en cobro USD muestra USD principal; en CUP/Mixto/transferencia, CUP principal (+ USD donde corresponda). Tarifas de pago a empleados siguen en CUP
- **Cobros y anticipos en efectivo**: pueden ser USD, CUP o Mixto; transferencia en CUP
- **Vuelto dual**: exceso validado como `change_cup + change_usd × tasa ≈ exceso_cup`; neto por moneda en caja = recibido − vuelto de esa moneda
- **Crédito de cliente** (`clients.credit_balance`): solo en CUP; se aplica contra la parte CUP del saldo. La deuda espejo (`clients.balance`) sigue siendo el equivalente CUP de pedidos abiertos. **UI Clientes (listado)**: Balance USD / CUP por cobros reales (no conversión). **Estado (USD)** según deuda USD abierta; **Estado (CUP)** según deuda CUP menos crédito. Los totales históricos se ven en el detalle del cliente, no en la tabla.
- **Salarios / tarifas de pago / denominaciones de caja internas**: CUP
- **Denominaciones de billetes CUP**: 1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000
- **Denominaciones de billetes USD**: 100, 50, 20, 10, 5, 2, 1
- **Formas de pago**: Efectivo | Transferencia
- La tasa USD/CUP se establece en Configuración; en pedidos CUP/Mixto es editable y al cambiarla se recalculan las líneas CUP desde precios USD
- **Vuelto / saldo a favor (v2.9+)**: si el recibido supera lo aplicado, el usuario elige **devolver vuelto** (desglose CUP y/o USD) o **dejar saldo a favor** (`clients.credit_balance`; ingreso en caja = recibido completo). El vuelto ya no es obligatorio
- **Saldo a favor**: se aplica automáticamente a futuros pedidos/cobros (desmarcable); reduce lo pendiente CUP sin movimiento de caja adicional

---

## 5. Diseño e Interfaz

- **Estilo**: Dashboard profesional, limpio, moderno — inspirado en Odoo/FacturaScript
- **Modo**: Dark mode por defecto (con opción de light mode en Configuración)
- **Sidebar**: Inicio, Pedidos, Reportes producción, Facturas, Clientes, Empleados, Inventario, Caja, Precios, Otros gastos, Reportes, Configuración
- **Fechas en UI (v2.5)**: siempre `dd/mm/aaaa` vía `formatDate` / `formatDateTime` (`src/lib/format-date.ts`)
- **Importes en UI (v2.14)**: moneda en la etiqueta/columna vía `moneyHeading('…')` y valor limpio con `formatAmount`; usar `formatMoney(valor, 'CUP'|'USD')` solo en mensajes, badges, tooltips o contextos mixtos sin encabezado (`src/lib/format-money.ts`)
- **Iconos**: Lucide React en todos los menús, botones y acciones
- **Tipografía**: moderna y legible
- **Colores**: paleta profesional con azul/índigo como color primario, acentos de color para estados
- **Estados visuales**: badges de colores para estados de pedidos (pendiente=amarillo, ejecutado=verde)
- **Tablas**: con paginación, búsqueda y ordenamiento
- **Formularios**: validación en tiempo real con mensajes de error claros en español
- **Responsive**: optimizado para laptop (no móvil)

---

## 6. Tipos de Productos del Taller

### Formatos de impresión disponibles:
5x7, 6x8, 8x10, 8x12, 10x12, 10x15, 12x16, 12x18, 16x20, 16x24, 20x24, 24x32, 24x39, 24x60

### Acabados fotográficos:
Brillo, 3D, Diamantado, Cuero Acrílico (solo Fotobooks)

### Servicios por categoría:
- **Fotos**: Impresión, Laminado, Enmarcado Original
- **Lienzo**: Impresión, Ojete, Enmarcado, Bastidor
- **Revistas**: Presilla (Brillo/3D/Diamantado), Lomo Duro
- **Álbumes**: estándar (Brillo/3D/Diamantado), Genéricos
- **Cajas**: Brillo/3D/Diamantado + precio extra por talla
- **Títulos**: precio unitario fijo
- **Fotobooks**: Brillo/3D/Diamantado/Cuero Acrílico
- **Lonas**: 24x32, 24x39, 1.37x1m
- **Llaveros**: simples (280 CUP), acrílicos (350 CUP)

---

## 7. Reglas de Negocio

1. Un pedido siempre está asociado a un cliente
2. Los precios se toman de la lista de precios configurada (no se hardcodean). El precio de venta es **único por producto terminado** (categoría + formato + acabado), no por tipo de trabajo; en pedidos no se suman precios de Impresión+Laminado+Enmarcado. Cada fila puede ofrecer USD, CUP o ambas; el unitario se resuelve en **CUP** (prioridad **USD activo** → `precio_usd × tasa`; si solo CUP, precio CUP)
3. Los pagos a empleados usan las **tarifas de pago** en CUP (distintas a precios de VENTA), salvo empleados con **salario fijo diario**, **salario por destajo diario** o **salario fijo mensual**
4. La deuda anterior del cliente **no** se incluye en el total del pedido; al guardar se actualiza `clients.balance` (deuda abierta). El saldo a favor vive en `clients.credit_balance` y se puede aplicar al pedido/cobro
5. El flujo de caja registra TODA operación de dinero (cobros a clientes, anticipos de pedido, pagos a empleados, gastos)
6. Los empleados dados de baja no aparecen en nuevas asignaciones pero su historial se conserva
7. El inventario descuenta materiales **al marcar Listo** cada línea (materiales fijados en el pedido desde norma o asignación manual; si no hay, coincidencia con `inventory_recipes`). El déficit se **declara al asignar** materiales con stock insuficiente (`resource_missing`); **no** se concluye la línea/pedido hasta reponer. El descuento exige stock suficiente (sin existencia negativa por conclusión)
8. La tasa USD/CUP vigente se guarda en cada transacción para auditoría

---

## 8. Git y Documentación

- Conventional Commits: `feat|fix|docs|chore|test|refactor|perf`
- Commits atómicos (un cambio lógico por commit)
- JSDoc en toda función pública y componente React
- Este archivo `REQUIREMENTS.md` es la fuente de verdad — actualizar ante cualquier cambio de requisitos

---

## 9. Estado de Implementación (seguimiento v2)

> Bitácora viva del avance de la migración v1 → v2. Actualizar al cerrar cada paso.

| Módulo / Paso | Estado |
|---|---|
| REQUIREMENTS.md + Cursor rules | hecho |
| Schema Drizzle v2 | hecho |
| Migración + Seed v2 | hecho |
| Layout sidebar + dark + Lucide | hecho |
| Inicio (KPIs) | hecho |
| Pedidos (UI /pedidos, tablas invoices) | hecho |
| Clientes (ajustes v2) | base v1 (sin cambios) |
| Empleados + lotes + salarios | hecho |
| Inventario + movimientos | hecho |
| Flujo de caja general CUP/USD | hecho |
| Configuración (tabs) | hecho |
| Tauri commands nuevos | hecho |

### Notas de decisiones tomadas
- **Pedidos vs Facturas**: se mantienen las tablas/comandos `invoices` por dentro
  (sin migración de datos) y se expone la UI como **Pedidos** con rutas `/pedidos`.
- **Estados**: se conservan los estados de pago (`pending/partial/paid`) y se mapean
  visualmente a pendiente/ejecutado (badge según saldo).
- **Moneda**: **CUP principal + USD con tasa** almacenada por operación.
  Denominaciones CUP: 1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000.

### v2.1 — Correcciones (2026)
- **Pago en pedidos**: `payment_method`, `payment_currency`, `exchange_rate_snapshot`, montos USD/CUP al crear.
- **Roles de empleados**: catálogo `employee_roles` + tab Configuración; `role_snapshot` inmutable.
- **Estados duales**: `production_status` (en_produccion/listo) y `payment_status` (pendiente/cobrado).
- **Logo del taller**: subida desde Configuración > General; sidebar dinámico.
- **Exportes**: CSV nativo con diálogo de guardado; XLSX/PDF siguen vía navegador/impresión.
- **Formatos / tipos de trabajo**: CRUD en Configuración; snapshots en ítems y lotes históricos.
- **Tasa USD**: badge del header abre modal sin salir de la pantalla; cambios registrados en histórico (`exchange_rate_history`).
- **Ubicación BD**: en v2.3 se reemplaza `db_location.json`; release usa `flexpyme.db` junto al ejecutable.

### v2.2 — Catálogos, Stock y Facturas (2026)
- **Categorías**: tabla `product_categories` ampliada (`code`, `icon`, `is_system`, `is_active`); `category_snapshot` en `invoice_items`.
- **Unidades**: tabla `units`; `unit_id` + `unit_snapshot` en inventario y movimientos.
- **Stock**: módulo `/stock` sin tablas nuevas; badge = listos sin cobrar. *(v2.4: Stock retirado del menú; ver §3.8)*
- **Facturas**: módulo `/facturas`; anulación con `cancelled_at` / `cancelled_reason`.

### v2.3 — BD portable, backups y restauración (2026)
- **BD portable**: release crea/carga `flexpyme.db` junto al ejecutable.
- **Backup manual**: genera copias fechadas en la carpeta `backups`.
- **Backup programado**: intervalo configurable en días, por defecto 1 (cierres diarios).
- **Histórico**: Configuración > Backup e Inicio muestran los últimos 5 backups.
- **Restauración**: importa una BD compatible, valida integridad/esquema, crea backup de seguridad y reemplaza `flexpyme.db`.

### Catálogos del sistema y snapshots (v2.2)

| Catálogo | Tabla | Snapshot en |
|----------|-------|-------------|
| Categorías | `product_categories` | `invoice_items.category_snapshot` |
| Formatos | `formats` | `invoice_items.format_label_snapshot` |
| Unidades | `units` | `inventory_items.unit_snapshot`, `inventory_movements.unit_snapshot` |
| Tipos trabajo | `work_types` | `production_batches.work_type_snapshot` |
| Roles | `employee_roles` | `employees.role_snapshot` |

Reglas: `is_system = true` → solo lectura; `is_active = false` → no aparece en formularios nuevos; nunca DELETE en catálogos.

### v2.4 — Tasa, catálogos y navegación (2026)
- **Tasa de cambio**: modal en cabecera; tab Configuración renombrado a **Tasa de cambio** con histórico de cambios.
- **Catálogos**: reactivar tipos de trabajo, formatos, unidades y roles desactivados.
- **Roles**: corrección del formulario de alta; modal CRUD.
- **Navegación**: Precios en sidebar (debajo de Flujo de Caja); Costos unificado en Precios (tarifa de pago).
- **Caja**: denominación CUP **2000** en conteo de billetes.
- **Nuevo pedido**: encabezado compacto; líneas en tabla + modal CRUD; resumen solo del pedido (sin deuda anterior); cobro integrado al completar encabezado, líneas y método de pago; autocompletado de línea desde lista de precios.
- **Inventario operativo**: recetas de consumo (`inventory_recipes`); descuento automático al marcar pedido listo; Stock retirado del sidebar (filtro Listos en Pedidos).
- **Empleados ↔ pedidos**: asignación de trabajadores en crear/editar líneas; Listo por línea crea lotes (`invoice_id` en `production_batch_items`).
- **Caja ↔ pedidos**: cobro y anticipo registran `cash_transactions` en la misma transacción al crear el pedido (`initial_payment`); historial de cobros en detalle de pedido; enlaces desde Flujo de Caja al pedido origen.

### v2.5 — Reenfoque a producción (2026-07-16)
- **Fechas UI**: `dd/mm/aaaa` vía `formatDate` / `formatDateTime`; regla Cursor `.cursor/rules/fechas.mdc`.
- **Denominaciones USD** + `DenominationGrid` reutilizable (CUP/USD) en cobros, caja y otros gastos; vuelto con desglose que afecta el neto en caja.
- **Config por categoría**: `category_work_types` / `category_formats` / `category_finishes` (+ catálogo `finishes`); preselección de tipos y acabados al crear líneas; expansión a un `invoice_item` por tipo.
- **Caja**: KPIs de flujo neto del día y de los últimos 30 días; cuadrículas de denominaciones en movimientos nuevos.
- **Reportes de producción**: `/reportes-produccion` por Área/día/formato (Realizado vs Pendiente) + Factura vs Salario.
- **Inventario**: descuento por línea concluida; déficit permitido con bandera `resource_missing` (sustituido en v2.16).
- **Empleados**: multi-rol (`employee_extra_roles`) y nómina diaria.
- **Otros gastos**: `/otros-gastos` con egreso automático en `cash_transactions`.
- **Tipos de gasto (Otros gastos)**: catálogo `expense_types` con alta/renombre/activar-desactivar desde la UI; el select del formulario usa tipos activos.

### v2.6 — Precios y tarifas de pago (2026-07)
- **Costos** retirado del sidebar; gestión unificada en **Precios** (ruta `/costos` → `/precios`).
- **UX Precios**: mosaico por categoría → pestañas por tipo de trabajo de la categoría → tabla (formato, acabado, precio CUP, precio USD, tarifa de pago).
- Columna/modal **Tarifa de Pago** (obligatoria, default 0); al guardar se sincroniza `cost_list` para salarios.
- Formato base **Sin formato** (0×0); filas pendientes en Precios cuando hay tipos de trabajo sin precio definido.
- Click en Precios del sidebar limpia `?categoria=` y vuelve al mosaico.

### v2.8 — Precios duales CUP/USD (2026-07)
- `price_list`: `price_cup`, `price_usd`, `is_cup_active`, `is_usd_active` (columna legada `price` espejo de CUP).
- UI: toggles por moneda, edición independiente y botones «Aplicar tasa» CUP↔USD con la tasa de Configuración.
- Pedidos/lookup: unitario siempre en CUP según monedas activas; cobros en caja siguen eligiendo moneda de pago de forma independiente.

### v2.6.1 — Inventario por categorías y normas (2026-07)
- Categorías de material (`inventory_material_categories`); ítems con categoría obligatoria; listado en acordeón.
- Stock mínimo / costo / proveedor opcionales; sin alertas si mínimo no establecido.
- Normas por tipo de trabajo (tabs) + formato/acabado; editar (solo futuros); ver/reactivar desactivadas.
- Pedidos: norma o materiales manuales por línea (`invoice_item_materials`); salida manual con motivo.
- **Pedidos: editar / anular** desde detalle (`/pedidos/:id`); anulación con reverso de caja e inventario; edición acotada a pedidos sin trabajo iniciado.

### v2.7 — Roles ↔ trabajos, asignación en líneas y Listo (2026-07)
- **Roles ↔ tipos de trabajo** (`role_work_types`): configurable en Configuración → Roles.
- **Asignaciones en líneas** (`invoice_item_assignments`): empleados + tarifa opcional; varios pueden colaborar en la misma unidad.
- **Status por línea** (`production_line_status`); confirmar Listo crea lotes; Marcar listo del listado sincroniza todas las líneas.
- Se retira **Registrar trabajo** del detalle de pedido.
- **Pago empleados** con `DenominationGrid` (lote individual y pago del día).

### v2.9 — Anticipo con denominaciones y saldo a favor (2026-07)
- Anticipo al crear pedido: método (efectivo/transferencia), moneda CUP/USD, `DenominationGrid` si efectivo; ingreso en `cash_transactions`.
- Exceso de pago (anticipo o cobro): **vuelto** o **saldo a favor** (`clients.credit_balance`); columnas `credit_applied` / `credit_added` en pedidos para anulación coherente.
- Crédito aplicable a futuros cobros (checkbox «Aplicar saldo a favor», default ON).
- Anulación: revierte caja; restaura crédito aplicado y quita crédito generado (error si el crédito generado ya se consumió).

### v2.10 — Salario fijo diario de empleados (2026-08)
- `employees.has_fixed_daily_salary` + `fixed_daily_salary_cup`; tabla `employee_daily_salaries` (pendiente/pagado por día).
- Formulario alta/edición: toggle bajo roles adicionales + importe CUP.
- Pago del día y nómina diaria incluyen salarios fijos; lotes de producción de esos empleados no acumulan tarifa.

### v2.11 — Salario por destajo diario (2026-08)
- `employees.pay_mode`: `production` | `fixed` | `destajo` (excluyentes); columnas legacy de fijo se mantienen sincronizadas.
- `employee_daily_salaries.kind`: `fixed` | `destajo`.
- Destajo: importe editable en alta/edición; en el listado, botón **Definir** o badge con el valor del día.
- Misma lógica que fijo respecto a producción (costo de lote 0) y nómina/pago del día.

### v2.12 — Nómina diaria por fecha y pago individual (2026-08)
- Filtro de nómina pasa de mes a día (`YYYY-MM-DD`), por defecto el día actual.
- Columna **Pagar** por empleado con pendiente; abre el modal de caja con denominaciones.
- Se elimina el pago global «Pago de empleados»; el pago es solo individual por día.

### v2.13 — Reverso de pago a empleados (mismo día) (2026-08)
- `cash_transaction_id` en lotes y salarios diarios vincula el egreso de caja.
- Botón **Deshacer** en nómina (solo fecha = hoy): revierte ítems a `pendiente` e inserta `ingreso` compensatorio (`salario_reverso`), sin borrar el egreso original.

### v2.14 — Precios y cobros por defecto en USD (2026-08)
- Precios de venta: USD activo por defecto en altas; CUP opcional.
- Resolución de unitario en pedidos: prioridad USD×tasa; si solo CUP, usa CUP. Totales del pedido siguen en CUP.
- Cobros/anticipos en efectivo y alta de movimiento de caja: moneda por defecto USD (transferencia sigue CUP).
- Salarios y tarifas de pago a empleados no cambian (CUP).

### v2.15 — UI Pedidos en USD con equivalente CUP (2026-08)
- Listado, resumen, líneas y cobro/anticipo muestran venta en USD (+ CUP según tasa); si el pago es CUP, el orden se invierte.
- Listado de pedidos y Facturas: columnas **Total (USD)** y **Total (CUP)** con montos reales de cobro (`due_usd` / `due_cup`, sin conversión). KPIs de Facturas duales (facturado / cobrado / saldos) por moneda física.
- Clientes: **Balance** y **Total histórico** en USD y CUP por moneda de cobro (listado, Ver/Editar e historial); estado por posición neta convertida con la tasa.
- Inicio: KPIs monetarios, gráfico de ingresos y totales de pedidos recientes en USD (+ CUP donde corresponda).
- Precios de tipo de trabajo editables en USD con equivalente CUP; tarifas de empleados permanecen en CUP.
- Cuadrícula Pendiente/Recibido/Aplica del anticipo/cobro usa la moneda seleccionada (no fija CUP).

### v2.16 — Materiales en déficit con bloqueo de Listo (2026-08)
- Déficit se declara al **asignar** materiales (manual o norma) con stock insuficiente; se guarda el pedido y se marca `resource_missing`.
- **No** se puede marcar Listo (línea ni pedido) ni concluir vía lotes de empleados hasta reponer con entrada en Inventario.
- Al Listo, descuento **estricto** (sin stock negativo). Tras entradas se recalculan las banderas de pedidos abiertos.
- Inventario: alerta de demanda pendiente; categoría/detalle muestran necesario vs disponible.
- Modal de línea: aviso de déficit por material; se permite guardar.

### v2.17 — Dualidad monetaria USD / CUP / Mixto (2026-08)
- `invoice_items.unit_price_usd` + totales/saldos duales en pedidos (`total_usd`, `paid_usd`, `balance_usd`, `due_usd`, `due_cup`).
- Moneda de pedido: USD | CUP | **Mixto** (split declarado + billetes en ambas monedas al cobrar).
- Cobro/anticipo/vuelto dual; neto de caja por moneda = recibido − vuelto.
- Al cambiar la tasa del pedido se recalculan precios CUP desde USD persistidos.
- Crédito de cliente sigue en CUP; deuda espejo de cliente = equivalente CUP de saldos duales abiertos.
- Transferencia sigue cobrando en CUP. Sin crédito USD ni reescritura histórica forzada (backfill `unit_price / rate`).
- **Clientes (listado/detalle)**: balances e históricos duales por moneda de cobro; estado por posición neta convertida.
- **Flujo de caja**: UI y agregados duales; escritores (movimiento manual / otros gastos) no contaminan `amount_cup` con USD×tasa; migración `0031` limpia histórico USD-solo.
- **Facturas**: KPIs y detalle con importes reales CUP/USD (`due_*`, `paid_*`, saldos duales); sin DualMoneyText por tasa de app.

### v2.18 — Mermas de material en pedidos (2026-08)
- Tabla `invoice_material_wastes`: material, cantidad, motivo, costo snapshot CUP/USD e id de movimiento de inventario.
- **Registrar merma** en editar y detalle de pedido (no en anulados). Motivos: Error de impresión, Material defectuoso, Error de corte, Otro.
- Descuento de almacén en la misma transacción; el precio de venta del pedido no cambia.
- Historial de mermas en el pedido cuando ya hay registros. Salidas de inventario con método **Merma**. Al anular, no se restaura el stock merma.

### v2.19 — Salario fijo mensual de empleados (2026-08)
- `employees.pay_mode`: `production` | `fixed` | `destajo` | `monthly`; `fixed_monthly_salary_cup`.
- Un cobro por mes calendario (`employee_daily_salaries.kind = monthly`).
- Lotes de producción de esos empleados con costo 0. **Deshacer** solo el día del pago.

### v2.20 — Habilitar salario mensual en nómina (2026-08)
- El salario mensual **no** aparece por defecto en la nómina diaria.
- Desde el listado, **Habilitar** abre un modal para elegir el día del mes en curso; solo entonces figura como pendiente ese día.

### v2.21 — Aviso de saldo a favor al cobrar (2026-08)
- Al cobrar un pedido (alta o página de cobro), si el cliente ya tiene crédito o el cobro va a dejar saldo a favor, un modal informa importes antes de confirmar.

### v2.22 — Listado de clientes: estado por moneda (2026-08)
- Tabla de clientes: se ocultan Total histórico USD/CUP; **Estado (USD)** y **Estado (CUP)** sustituyen el estado neto único.

### v2.23 — Configurar categoría desde Precios (2026-08)
- En Precios, al entrar a una categoría, **Configurar** abre el mismo modal de tipos de trabajo, formatos y acabados que Configuración → Categorías de productos.

### v2.24 — Alta de categoría desde Precios (2026-08)
- En el mosaico de Precios, **Nueva categoría** (botón y ficha) usa el mismo formulario que Configuración → Categorías de productos.

### v2.25 — Precio único del producto terminado (2026-08)
- Precios: CUP/USD únicos por categoría + formato + acabado (visibles en cada tipo de trabajo; al guardar se sincronizan). La tarifa de pago sigue por tipo.
- Pedidos: el total cobra una vez el producto; los tipos de trabajo extra quedan como «Incluido» (producción y salarios no cambian).

### v2.26 — Varios empleados por tipo de trabajo (2026-08)
- En líneas de pedido se pueden asignar varios trabajadores a un mismo tipo aunque la cantidad sea 1 (trabajo colaborativo). Al marcar Listo, el inventario se descuenta por unidades del producto, no por la suma de nómina.

### v2.27 — Formato en ítems de inventario (2026-08)
- Al crear o editar un material se elige un formato del catálogo de Configuración. Si no se selecciona, queda el formato base **Sin formato**. Los ítems existentes se migran a ese formato.

### Pendientes / próximos refinamientos
- PDF de pedido con imagen de logo embebida (hoy logo en impresión HTML; PDF Rust es texto).
- Reporte PDF/XLSX con todas las secciones del exporte web (deudores, producción).
- Cobro parcial con múltiples métodos en una misma factura (hoy un método por pedido).
- Crédito de cliente en USD.
