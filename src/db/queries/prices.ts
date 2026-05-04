import { invoke } from "@tauri-apps/api/core";
import type { CategoryDto, FormatDto, PriceRowDto, UpdatePricePayload } from "@/types/price";

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
