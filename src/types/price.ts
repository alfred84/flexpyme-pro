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
 * Price list row with joined category and format labels.
 */
export interface PriceRowDto {
  id: number;
  categoryId: number;
  categoryName: string;
  formatId: number | null;
  formatLabel: string | null;
  finish: string | null;
  service: string | null;
  price: number;
  cost: number | null;
  validFrom: string;
  isActive: boolean;
}

/**
 * Payload for updating a price row.
 */
export interface UpdatePricePayload {
  id: number;
  price: number;
  cost: number | null;
  isActive: boolean;
}
