/**
 * POIZON `brand/page/by-name` 후보에서 검색어와 이름이 가장 가까운 브랜드를 고른다.
 * 로고/노출 플래그만 보면 `The north face`가 상품 0건인 Face a Face로 잡힌다.
 */

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "for"]);

/** compact query → 추가로 맞춰 볼 브랜드명 (한/영 표기가 다른 경우) */
const QUERY_ALIASES: Record<string, string[]> = {
  thenorthface: ["노스페이스", "the north face", "north face"],
  northface: ["노스페이스", "the north face", "north face"],
};

export interface BrandNameRow {
  brandId?: number | string;
  id?: number | string;
  name?: string;
  isShow?: number;
  isShowLogo?: number;
}

export function compactBrandName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function brandTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

function scoreName(query: string, name: string): number {
  const qNorm = compactBrandName(query);
  const nNorm = compactBrandName(name);
  if (!qNorm || !nNorm) return 0;
  if (qNorm === nNorm) return 1000;
  if (nNorm.includes(qNorm) || qNorm.includes(nNorm)) {
    return 800 - Math.min(200, Math.abs(nNorm.length - qNorm.length));
  }
  const qTokens = brandTokens(query);
  const nTokens = brandTokens(name);
  if (qTokens.length === 0) return 0;
  const overlap = qTokens.filter((token) => nTokens.includes(token)).length;
  if (overlap === 0) return 0;
  const allQuery = overlap === qTokens.length;
  return Math.round((overlap / qTokens.length) * 500) + (allQuery ? 80 : 0);
}

function queryNames(query: string): string[] {
  const aliases = QUERY_ALIASES[compactBrandName(query)] ?? [];
  return [query, ...aliases];
}

function scoreBrand(query: string, names: string[]): number {
  const needles = queryNames(query);
  let best = 0;
  for (const name of names) {
    for (const needle of needles) {
      best = Math.max(best, scoreName(needle, name));
    }
  }
  return best;
}

function rowId(row: BrandNameRow): string {
  const id = row.brandId ?? row.id;
  return id == null ? "" : String(id);
}

function rowName(row: BrandNameRow): string {
  return row.name ? String(row.name) : "";
}

/** ko+en 목록을 brandId 기준으로 합치고 검색어와 가장 가까운 행을 반환한다. */
export function pickBestBrandMatch<T extends BrandNameRow>(query: string, rows: T[]): T | null {
  const merged = new Map<string, { row: T; names: Set<string>; isShow: number; isShowLogo: number }>();
  for (const row of rows) {
    const id = rowId(row);
    if (!id) continue;
    const current = merged.get(id) ?? {
      row,
      names: new Set<string>(),
      isShow: 0,
      isShowLogo: 0,
    };
    const name = rowName(row);
    if (name) current.names.add(name);
    current.isShow = Math.max(current.isShow, Number(row.isShow) || 0);
    current.isShowLogo = Math.max(current.isShowLogo, Number(row.isShowLogo) || 0);
    merged.set(id, current);
  }

  const candidates = [...merged.values()];
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestScore = -1;
  for (const candidate of candidates) {
    let score = scoreBrand(query, [...candidate.names]);
    if (candidate.isShowLogo) score += 2;
    else if (candidate.isShow) score += 1;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best.row : candidates[0].row;
}
