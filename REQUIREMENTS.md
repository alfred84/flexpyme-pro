# REQUIREMENTS.md — FlexPyme Pro
## Taller de Impresión Gráfica · Requisitos del Sistema

### Versión: 2.0 | Última actualización: 2026-06-04

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

### 3.1 Dashboard
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
- Historial de pedidos por cliente

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
- Cálculo automático del salario a pagar
- Historial de pagos al empleado
- Dar de baja (soft delete, no eliminar)

### 3.5 Inventario
- Gestión de materiales/insumos del taller
- Campos: nombre, categoría, cantidad en stock, unidad de medida, precio de costo, stock mínimo
- Alertas de stock bajo (cuando cantidad ≤ stock mínimo)
- Registro de entradas y salidas de inventario
- Historial de movimientos por ítem

### 3.6 Flujo de Caja
- Registro de todas las entradas y salidas de dinero
- Formas de pago:
  - **Efectivo**: con desglose por denominaciones de billetes
  - **Transferencia**: con referencia/concepto
- Denominaciones CUP disponibles: 1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000
- Soporte para USD con tasa de conversión a CUP (se almacena la tasa en cada operación)
- Balance actual de caja (CUP y USD por separado)
- Módulo de cobro de facturas: ingresa billetes → calcula vuelto automáticamente
- Historial de movimientos con filtros por fecha, tipo, concepto
- Resumen diario/mensual

### 3.7 Configuración
- Datos del negocio (nombre, dirección, teléfono, logo)
- Lista de precios: editar precios de venta por producto/formato/acabado
- Precios de costo de empleados (configurables, base para cálculo de salarios)
- Tasa de cambio USD → CUP (actualizable manualmente)
- **Categorías** de productos (CRUD con `is_system`, snapshot en pedidos)
- **Unidades** de medida (CRUD con tipo, snapshot en inventario)
- Formatos disponibles (alta/baja de formatos)
- Backup y restauración de la base de datos
- Preferencias de la aplicación

### 3.8 Módulo Stock (v2.2)
- Vista operativa de pedidos con `production_status = listo` (bandeja de salida)
- KPIs: listos, cobrados, sin cobrar, tiempo medio de espera
- Alerta de pedidos listos hace más de 7 días
- Acceso rápido a cobro si `payment_status = pendiente`
- Campo `production_completed_at` al marcar listo

### 3.9 Módulo Facturas (v2.2)
- Vista financiera/contable sobre la misma tabla `invoices` (1 pedido = 1 factura)
- KPIs por estado: cobrada, parcial, pendiente, anulada
- Detalle con historial de pagos (`cash_transactions`)
- Anulación con motivo y reverso en caja (sin borrado físico)
- Rutas `/facturas`, impresión y registro de pago

---

## 4. Moneda y Pagos

- **Moneda principal**: CUP (Pesos Cubanos)
- **Moneda secundaria**: USD (con tasa de conversión almacenada por operación)
- **Denominaciones de billetes CUP**: 1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000
- **Formas de pago**: Efectivo | Transferencia
- La tasa USD/CUP se establece en Configuración y se guarda en cada transacción

---

## 5. Diseño e Interfaz

- **Estilo**: Dashboard profesional, limpio, moderno — inspirado en Odoo/FacturaScript
- **Modo**: Dark mode por defecto (con opción de light mode en Configuración)
- **Sidebar**: Dashboard, Pedidos, Stock, Facturas, Clientes, Empleados, Inventario, Caja, Reportes, Configuración
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
2. Los precios se toman de la lista de precios configurada (no se hardcodean)
3. Los pagos a empleados usan los precios de COSTO (distintos a precios de VENTA)
4. Si un cliente tiene deuda anterior, se muestra al crear el pedido
5. El flujo de caja registra TODA operación de dinero (cobros a clientes, pagos a empleados, gastos)
6. Los empleados dados de baja no aparecen en nuevas asignaciones pero su historial se conserva
7. El inventario descuenta materiales cuando se marca un pedido como ejecutado (opcional/configurable)
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
| Dashboard KPIs | hecho |
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
  Denominaciones CUP: 1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000.

### v2.1 — Correcciones (2026)
- **Pago en pedidos**: `payment_method`, `payment_currency`, `exchange_rate_snapshot`, montos USD/CUP al crear.
- **Roles de empleados**: catálogo `employee_roles` + tab Configuración; `role_snapshot` inmutable.
- **Estados duales**: `production_status` (en_produccion/listo) y `payment_status` (pendiente/cobrado).
- **Logo del taller**: subida desde Configuración > General; sidebar dinámico.
- **Exportes**: CSV nativo con diálogo de guardado; XLSX/PDF siguen vía navegador/impresión.
- **Formatos / tipos de trabajo**: CRUD en Configuración; snapshots en ítems y lotes históricos.
- **Tasa USD**: badge del header enlaza a Configuración > Moneda.
- **Ubicación BD**: `db_location.json`, mover/copiar con verificación.

### v2.2 — Catálogos, Stock y Facturas (2026)
- **Categorías**: tabla `product_categories` ampliada (`code`, `icon`, `is_system`, `is_active`); `category_snapshot` en `invoice_items`.
- **Unidades**: tabla `units`; `unit_id` + `unit_snapshot` en inventario y movimientos.
- **Stock**: módulo `/stock` sin tablas nuevas; badge = listos sin cobrar.
- **Facturas**: módulo `/facturas`; anulación con `cancelled_at` / `cancelled_reason`.

### Catálogos del sistema y snapshots (v2.2)

| Catálogo | Tabla | Snapshot en |
|----------|-------|-------------|
| Categorías | `product_categories` | `invoice_items.category_snapshot` |
| Formatos | `formats` | `invoice_items.format_label_snapshot` |
| Unidades | `units` | `inventory_items.unit_snapshot`, `inventory_movements.unit_snapshot` |
| Tipos trabajo | `work_types` | `production_batches.work_type_snapshot` |
| Roles | `employee_roles` | `employees.role_snapshot` |

Reglas: `is_system = true` → solo lectura; `is_active = false` → no aparece en formularios nuevos; nunca DELETE en catálogos.

### Pendientes / próximos refinamientos
- PDF de pedido con imagen de logo embebida (hoy logo en impresión HTML; PDF Rust es texto).
- Reporte PDF/XLSX con todas las secciones del exporte web (deudores, producción).
- Cobro parcial con múltiples métodos en una misma factura (hoy un método por pedido).
