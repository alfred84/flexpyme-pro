export interface SeedClientInput {
  code: string;
  name: string;
}

export interface SeedPriceInput {
  category: string;
  format: string | null;
  finish: string | null;
  service: string | null;
  price: number;
  cost: number | null;
}

export const PRODUCT_CATEGORIES = [
  "fotos",
  "lienzo",
  "revista",
  "album",
  "caja",
  "titulo",
  "book",
  "lona",
  "llavero",
] as const;

/**
 * Etiquetas en español por categoría (columna `label_es` de `product_categories`).
 */
export const CATEGORY_LABELS: Record<string, string> = {
  fotos: "Fotos / Ampliaciones",
  lienzo: "Lienzo",
  revista: "Revistas",
  album: "Álbumes",
  caja: "Cajas",
  titulo: "Títulos",
  book: "Fotobooks / Book Mini",
  lona: "Lonas",
  llavero: "Llaveros",
};

/**
 * Costo de mano de obra por tipo de trabajo (pago a empleados), en CUP.
 */
export interface SeedCostInput {
  workType: "laminado" | "enmarcado" | "respaldo" | "impresion";
  format: string;
  unitCost: number;
}

const LAMINADO_COSTS: Record<string, number> = {
  "5x7": 10, "6x8": 10, "8x10": 10,
  "8x12": 16, "10x12": 16, "10x15": 16,
  "12x16": 20, "12x18": 20,
  "16x20": 26, "16x24": 26, "20x24": 26,
  "24x32": 30, "24x39": 40, "24x60": 50,
};

const ENMARCADO_COSTS: Record<string, number> = {
  "5x7": 10, "6x8": 10, "8x10": 10, "8x12": 10, "10x12": 10, "10x15": 10,
  "12x16": 10, "12x18": 10,
  "16x20": 20, "16x24": 20, "20x24": 20,
  "24x32": 25, "24x39": 25, "24x60": 60,
};

const IMPRESION_COSTS: Record<string, number> = {
  "5x7": 5, "6x8": 5, "8x10": 5, "8x12": 5, "10x12": 5, "10x15": 5,
  "12x16": 10, "12x18": 10,
  "16x20": 15, "16x24": 15, "20x24": 15,
  "24x32": 20, "24x39": 20, "24x60": 50,
};

/**
 * Construye las filas de `cost_list` a partir de las tablas de costo por formato.
 * `respaldo` comparte la tarifa de `enmarcado` (regla de negocio §3.4).
 */
export function buildCostRows(): SeedCostInput[] {
  const rows: SeedCostInput[] = [];
  for (const [format, unitCost] of Object.entries(LAMINADO_COSTS)) {
    rows.push({ workType: "laminado", format, unitCost });
  }
  for (const [format, unitCost] of Object.entries(ENMARCADO_COSTS)) {
    rows.push({ workType: "enmarcado", format, unitCost });
    rows.push({ workType: "respaldo", format, unitCost });
  }
  for (const [format, unitCost] of Object.entries(IMPRESION_COSTS)) {
    rows.push({ workType: "impresion", format, unitCost });
  }
  return rows;
}

/**
 * Configuración inicial del sistema (tabla `settings`).
 */
export const SETTINGS_SEED: Record<string, string> = {
  business_name: "Taller Gráfico",
  business_address: "",
  business_phone: "",
  currency: "CUP",
  usd_exchange_rate: "250",
  dark_mode: "true",
};

export const FORMAT_LABELS = [
  "4x6",
  "5x7",
  "6x8",
  "8x10",
  "8x12",
  "10x12",
  "10x15",
  "12x16",
  "12x18",
  "12x20",
  "16x20",
  "16x24",
  "20x24",
  "24x32",
  "24x39",
  "24x60",
  "1.37x1m",
] as const;

const KNOWN_CLIENT_NAMES = [
  "ALEX DOVALES",
  "ARMANDO NIQUERO",
  "ABA",
  "AILEN",
  "ALAIN",
  "ALBERT FOTOMAX",
  "ALBERTO",
  "ALEXIS",
  "ALFONSO",
  "ALINA",
  "ALMANDO",
  "AMAURY",
  "AMELIA",
  "ANDY FOTO",
  "ANGEL",
  "ANITA",
  "ARIEL",
  "ARTURO",
  "BELLA FOTO",
  "BENITO",
] as const;

/**
 * Creates a deterministic list of 259 clients for initial offline seed.
 */
export function buildFallbackClients(): SeedClientInput[] {
  const target = 259;
  const clients: SeedClientInput[] = [];

  KNOWN_CLIENT_NAMES.forEach((name, index) => {
    clients.push({
      code: String(index + 1).padStart(3, "0"),
      name,
    });
  });

  for (let i = clients.length + 1; i <= target; i += 1) {
    clients.push({
      code: String(i).padStart(3, "0"),
      name: `CLIENTE ${String(i).padStart(3, "0")}`,
    });
  }

  return clients;
}

export const PRICE_ROWS: SeedPriceInput[] = [
  { category: "fotos", format: "5x7", finish: null, service: "impresion", price: 170, cost: 10 },
  { category: "fotos", format: "5x7", finish: null, service: "laminado", price: 170, cost: 10 },
  { category: "fotos", format: "5x7", finish: null, service: "enmarcado", price: 550, cost: 10 },
  { category: "fotos", format: "6x8", finish: null, service: "impresion", price: 210, cost: 10 },
  { category: "fotos", format: "6x8", finish: null, service: "laminado", price: 170, cost: 10 },
  { category: "fotos", format: "6x8", finish: null, service: "enmarcado", price: 620, cost: 10 },
  { category: "fotos", format: "8x10", finish: null, service: "impresion", price: 310, cost: 10 },
  { category: "fotos", format: "8x10", finish: null, service: "laminado", price: 170, cost: 10 },
  { category: "fotos", format: "8x10", finish: null, service: "enmarcado", price: 870, cost: 10 },
  { category: "fotos", format: "8x12", finish: null, service: "impresion", price: 350, cost: 16 },
  { category: "fotos", format: "8x12", finish: null, service: "laminado", price: 180, cost: 16 },
  { category: "fotos", format: "8x12", finish: null, service: "enmarcado", price: 900, cost: 10 },
  { category: "fotos", format: "10x12", finish: null, service: "impresion", price: 440, cost: 16 },
  { category: "fotos", format: "10x12", finish: null, service: "laminado", price: 200, cost: 16 },
  { category: "fotos", format: "10x12", finish: null, service: "enmarcado", price: 960, cost: 10 },
  { category: "fotos", format: "10x15", finish: null, service: "impresion", price: 670, cost: 16 },
  { category: "fotos", format: "10x15", finish: null, service: "laminado", price: 210, cost: 16 },
  { category: "fotos", format: "10x15", finish: null, service: "enmarcado", price: 1010, cost: 10 },
  { category: "fotos", format: "12x16", finish: null, service: "impresion", price: 720, cost: 20 },
  { category: "fotos", format: "12x16", finish: null, service: "laminado", price: 260, cost: 20 },
  { category: "fotos", format: "12x16", finish: null, service: "enmarcado", price: 1320, cost: 10 },
  { category: "fotos", format: "12x18", finish: null, service: "impresion", price: 810, cost: 20 },
  { category: "fotos", format: "12x18", finish: null, service: "laminado", price: 290, cost: 20 },
  { category: "fotos", format: "12x18", finish: null, service: "enmarcado", price: 1340, cost: 10 },
  { category: "fotos", format: "16x20", finish: null, service: "impresion", price: 1440, cost: 26 },
  { category: "fotos", format: "16x20", finish: null, service: "laminado", price: 480, cost: 26 },
  { category: "fotos", format: "16x20", finish: null, service: "enmarcado", price: 1850, cost: 20 },
  { category: "fotos", format: "16x24", finish: null, service: "impresion", price: 1510, cost: 26 },
  { category: "fotos", format: "16x24", finish: null, service: "laminado", price: 500, cost: 26 },
  { category: "fotos", format: "16x24", finish: null, service: "enmarcado", price: 1880, cost: 20 },
  { category: "fotos", format: "20x24", finish: null, service: "impresion", price: 1780, cost: 26 },
  { category: "fotos", format: "20x24", finish: null, service: "laminado", price: 630, cost: 26 },
  { category: "fotos", format: "20x24", finish: null, service: "enmarcado", price: 2120, cost: 20 },
  { category: "fotos", format: "24x32", finish: null, service: "impresion", price: 2930, cost: 30 },
  { category: "fotos", format: "24x32", finish: null, service: "laminado", price: 980, cost: 30 },
  { category: "fotos", format: "24x32", finish: null, service: "enmarcado", price: 3250, cost: 25 },
  { category: "fotos", format: "24x39", finish: null, service: "impresion", price: 3500, cost: 40 },
  { category: "fotos", format: "24x39", finish: null, service: "laminado", price: 1130, cost: 40 },
  { category: "fotos", format: "24x39", finish: null, service: "enmarcado", price: 3710, cost: 25 },
  { category: "fotos", format: "24x60", finish: null, service: "impresion", price: 5770, cost: 50 },
  { category: "fotos", format: "24x60", finish: null, service: "laminado", price: 1780, cost: 50 },
  { category: "fotos", format: "24x60", finish: null, service: "enmarcado", price: 6340, cost: 60 },
  { category: "lienzo", format: "12x16", finish: null, service: "impresion", price: 900, cost: null },
  { category: "lienzo", format: "12x18", finish: null, service: "impresion", price: 970, cost: null },
  { category: "lienzo", format: null, finish: null, service: "ojete", price: 100, cost: null },
  { category: "revista", format: "6x8", finish: "brillo", service: "presilla", price: 1500, cost: null },
  { category: "revista", format: "8x12", finish: "brillo", service: "lomo_duro", price: 11330, cost: null },
  { category: "album", format: "5x7", finish: null, service: "generico", price: 1500, cost: null },
  { category: "album", format: "6x8", finish: null, service: "generico", price: 1600, cost: null },
  { category: "llavero", format: null, finish: null, service: "simple", price: 280, cost: null },
  { category: "llavero", format: null, finish: null, service: "acrilico", price: 350, cost: null },
  { category: "lona", format: "24x32", finish: null, service: "impresion", price: 3350, cost: null },
  { category: "lona", format: "24x39", finish: null, service: "impresion", price: 3600, cost: null },
  { category: "lona", format: "1.37x1m", finish: null, service: "impresion", price: 7200, cost: null },
];
