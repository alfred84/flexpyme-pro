/**
 * Product category for catalog UI.
 */
export interface CategoryDto {
  id: number;
  name: string;
}

/**
 * Print format label for catalog UI.
 */
export interface FormatDto {
  id: number;
  label: string;
}

/**
 * Price list row with joined category/format labels and dual-currency sale prices.
 */
export interface PriceRowDto {
  id: number;
  categoryId: number;
  categoryName: string;
  formatId: number | null;
  formatLabel: string | null;
  finish: string | null;
  service: string | null;
  /** Espejo CUP (compat); preferir `priceCup`. */
  price: number;
  priceCup: number | null;
  priceUsd: number | null;
  isCupActive: boolean;
  isUsdActive: boolean;
  cost: number | null;
  validFrom: string;
  isActive: boolean;
}

/**
 * Payload for creating a price row (sale prices CUP/USD + payment tariff).
 */
export interface CreatePricePayload {
  categoryId: number;
  formatId: number | null;
  finish: string | null;
  service: string;
  priceCup: number | null;
  priceUsd: number | null;
  isCupActive: boolean;
  isUsdActive: boolean;
  /** Tarifa de pago al trabajador (CUP); default 0. */
  cost: number | null;
  isActive: boolean;
}

/**
 * Payload for updating a price row (sale prices CUP/USD + payment tariff).
 */
export interface UpdatePricePayload {
  id: number;
  priceCup: number | null;
  priceUsd: number | null;
  isCupActive: boolean;
  isUsdActive: boolean;
  /** Tarifa de pago al trabajador (CUP); required in UI, default 0. */
  cost: number | null;
  isActive: boolean;
}
