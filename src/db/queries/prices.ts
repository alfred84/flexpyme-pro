import { invoke } from "@tauri-apps/api/core";
import type {
  CategoryDto,
  CreatePricePayload,
  FormatDto,
  PriceRowDto,
  UpdatePricePayload,
} from "@/types/price";

/**
 * Loads product categories (catalog).
 */
export async function fetchProductCategories(): Promise<CategoryDto[]> {
  return invoke<CategoryDto[]>("product_categories_list");
}

/**
 * Loads print formats (catalog).
 */
export async function fetchFormats(): Promise<FormatDto[]> {
  return invoke<FormatDto[]>("formats_list");
}

/**
 * Loads price list rows; set includeInactive to show deactivated rows.
 */
export async function fetchPrices(includeInactive: boolean): Promise<PriceRowDto[]> {
  return invoke<PriceRowDto[]>("prices_list", { args: { includeInactive } });
}

/**
 * Creates a new price list row.
 */
export async function createPrice(payload: CreatePricePayload): Promise<PriceRowDto> {
  return invoke<PriceRowDto>("prices_create", { payload });
}

/**
 * Persists changes to a single price list row.
 */
export async function updatePrice(payload: UpdatePricePayload): Promise<void> {
  return invoke<void>("prices_update", { payload });
}

export interface PriceLookupArgs {
  categoryId: number;
  formatId: number | null;
  finish: string | null;
  service: string | null;
}

/**
 * Resolves unit price from the active price list, if a row matches exactly.
 */
export async function lookupUnitPrice(args: PriceLookupArgs): Promise<number | null> {
  return invoke<number | null>("prices_lookup", { args });
}

/**
 * Cost-list row (employee salary costs) with format label.
 */
export interface CostRowDto {
  id: number;
  workType: string;
  formatId: number | null;
  formatLabel: string | null;
  unitCost: number;
  isActive: boolean;
}

/**
 * Loads employee payment-tariff rows (`cost_list`).
 */
export async function fetchCostList(): Promise<CostRowDto[]> {
  return invoke<CostRowDto[]>("cost_list_all");
}

/**
 * Updates a single payment-tariff row (unit cost and active flag).
 * Prefer editing via Precios; this remains for programmatic sync.
 */
export async function updateCost(payload: {
  id: number;
  unitCost: number;
  isActive: boolean;
}): Promise<void> {
  return invoke<void>("cost_update", { payload });
}
