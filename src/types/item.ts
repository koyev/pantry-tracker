export type Location = 'fridge' | 'freezer' | 'pantry';

export type ExpiryStatus = 'fresh' | 'soon' | 'expired';

/**
 * A pantry item. Mirrors the single local SQLite table (see src/lib/db.ts).
 * Dates are ISO date strings "YYYY-MM-DD".
 */
export interface Item {
  id: string; // uuid
  name: string; // required, 1–80 chars
  barcode: string | null; // nullable for manual items
  quantity: number; // default 1, min 0
  unit: string; // "pcs" | "g" | "ml" | "kg" | "L" ...
  location: Location; // default "fridge"
  expiryDate: string; // ISO date, required
  addedDate: string; // ISO date, set on create
  imageUrl: string | null; // from food API, nullable
}

/** Fields supplied when creating an item; id and addedDate are generated. */
export type ItemInput = Omit<Item, 'id' | 'addedDate'>;

export const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry'];

export const UNITS: string[] = ['pcs', 'g', 'kg', 'ml', 'L'];
