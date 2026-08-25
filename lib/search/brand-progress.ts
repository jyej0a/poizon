const BRAND_PROGRESS_KEY = "poizon_brand_progress";

export interface BrandProgress {
  page: number;
  brandId: number | string | null;
  total: number;
}

export function readBrandProgress(): Record<string, BrandProgress> {
  try {
    const raw = localStorage.getItem(BRAND_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBrandProgress(brand: string, progress: BrandProgress) {
  try {
    const all = readBrandProgress();
    all[brand.trim().toLowerCase()] = progress;
    localStorage.setItem(BRAND_PROGRESS_KEY, JSON.stringify(all));
  } catch (error) {
    console.error("Failed to persist brand progress", error);
  }
}

export function getBrandProgress(brand: string): BrandProgress | null {
  const all = readBrandProgress();
  return all[brand.trim().toLowerCase()] ?? null;
}
