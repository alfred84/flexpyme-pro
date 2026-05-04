# FlexPyme Pro

Aplicacion de escritorio offline para la gestion de un taller de impresion grafica. El sistema cubre clientes, facturacion, caja por denominaciones, produccion por lotes, reportes y configuracion.

## Stack Tecnologico

- Tauri v2 + Rust
- React 18 + TypeScript
- Tailwind CSS v3 + DaisyUI v4
- TanStack Router v1 + TanStack Query v5
- Drizzle ORM + SQLite
- React Hook Form + Zod
- TanStack Table v8
- Recharts
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

## Base de datos (SQLite)

El archivo por defecto es `src-tauri/flexpyme.db`.

1. Aplicar migraciones (o usar seed, que las aplica antes de insertar datos):

```bash
pnpm db:migrate
```

2. Cargar datos iniciales (categorías, formatos, precios base y clientes desde `data/Reporte___TOTAL.xlsx` si existe):

```bash
pnpm db:seed
```

Si tenías una base antigua creada solo con la tabla `settings` y la migración falla por tablas duplicadas, borra `src-tauri/flexpyme.db` y vuelve a ejecutar `pnpm db:migrate` o `pnpm db:seed`.

## Clientes

En la app (`pnpm tauri dev`), abre **Clientes** en la barra superior: listado con búsqueda, alta, ficha y edición. Los datos se leen y escriben en SQLite mediante comandos Tauri (`clients_*`).

## Precios

En **Precios** puedes ver la lista de precios (activos por defecto; opción para incluir inactivos), filtrar en tabla y **editar precio, costo y estado activo** en un modal. Comandos Tauri: `prices_list`, `prices_update`, más catálogo `product_categories_list` y `formats_list` en el backend para uso futuro.

## Facturas (MVP)

En **Facturas**: listado, **Nueva factura** con líneas (categoría, formato, servicio, acabado, cantidad, precio), botón **Aplicar precio de lista** (`prices_lookup`), anticipado y pagado. Totales: `total = subtotal + deuda_anterior - anticipado`, `pendiente = total - pagado`. Al guardar se actualiza el **balance del cliente**. Comandos: `invoices_list`, `invoices_get_detail`, `invoices_create`.
