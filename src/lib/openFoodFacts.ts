/**
 * Open Food Facts barcode lookup (PROJECT.md §6). Free, no API key.
 * Never throws to the UI — any failure resolves to `null` so the user can
 * always fall back to typing the name manually.
 */

export interface ProductLookup {
  name?: string;
  imageUrl?: string;
}

const BASE = 'https://world.openfoodfacts.org/api/v2/product';
const TIMEOUT_MS = 8000;

export async function lookupBarcode(barcode: string): Promise<ProductLookup | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(barcode)}.json?fields=product_name,image_front_small_url`,
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const json: {
      status?: number;
      product?: { product_name?: string; image_front_small_url?: string };
    } = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const name = json.product.product_name?.trim() || undefined;
    const imageUrl = json.product.image_front_small_url || undefined;
    if (!name && !imageUrl) return null;
    return { name, imageUrl };
  } catch {
    // network error, timeout/abort, bad JSON — all non-fatal
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
