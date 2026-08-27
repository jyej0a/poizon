import { isSoldOutOffer } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";

export function normalizeArticleNumber(articleNumber: string): string {
  return articleNumber.trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
}

export function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isNaN(raw) || raw <= 0 ? null : raw;
  const num = Number(String(raw).replace(/[^0-9]/g, ""));
  return Number.isNaN(num) || num <= 0 ? null : num;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** HTML 조각에서 표시용 텍스트를 뽑는다 (태그 제거 + 엔티티 복원) */
export function decodeHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `marker`가 나타나는 위치를 경계로 HTML을 조각낸다.
 *
 * 상품 하나가 한 조각에 담기므로, 조각 안에서만 필드를 뽑으면 서로 다른 상품의
 * 이름과 가격이 섞이지 않는다.
 */
export function splitByMarker(html: string, marker: string): string[] {
  const starts: number[] = [];
  let cursor = html.indexOf(marker);
  while (cursor !== -1) {
    starts.push(cursor);
    cursor = html.indexOf(marker, cursor + marker.length);
  }

  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
}

/** 비교용으로 구분자를 제거한 영숫자 형태 */
function compactArticleNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * 오퍼 제목이 실제로 해당 품번의 상품인지 판정한다.
 *
 * 몰 검색은 품번으로 질의해도 무관한 상품을 함께 돌려준다. 실측에서 롯데ON은
 * `CW2288-111` 검색 결과 60건 중 13건이 다른 상품이었고, 그중 최저가(77,420원)가
 * 전혀 다른 모델이었다. 이를 원가로 쓰면 마진 계산이 그대로 어긋난다.
 */
export function matchesArticleNumber(text: string | null | undefined, articleNumber: string): boolean {
  if (!text) return false;
  const needle = compactArticleNumber(articleNumber);
  if (needle.length < 4) return false;
  return compactArticleNumber(text).includes(needle);
}

/**
 * HTML 안에 직렬화된 JSON 객체 중 `key`를 포함하는 것들을 객체 단위로 잘라낸다.
 *
 * 정규식으로 필드를 이어 붙이면 서로 다른 상품의 이름과 가격이 짝지어질 수 있다.
 * 문자열 리터럴을 마스킹한 뒤 중괄호 균형으로 경계를 찾아 이 문제를 없앤다.
 */
export function extractJsonObjectsContainingKey<T>(html: string, key: string): T[] {
  const inString = new Uint8Array(html.length);
  for (let i = 0; i < html.length; i += 1) {
    if (html[i] !== '"') continue;
    let j = i + 1;
    while (j < html.length) {
      if (html[j] === "\\") {
        j += 2;
        continue;
      }
      if (html[j] === '"') break;
      j += 1;
    }
    for (let k = i; k <= Math.min(j, html.length - 1); k += 1) inString[k] = 1;
    i = j;
  }

  const findObjectStart = (from: number): number => {
    let depth = 0;
    for (let i = from; i >= 0; i -= 1) {
      if (inString[i]) continue;
      if (html[i] === "}") depth += 1;
      else if (html[i] === "{") {
        if (depth === 0) return i;
        depth -= 1;
      }
    }
    return -1;
  };

  const findObjectEnd = (start: number): number => {
    let depth = 0;
    for (let i = start; i < html.length; i += 1) {
      if (inString[i]) continue;
      if (html[i] === "{") depth += 1;
      else if (html[i] === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  const token = `"${key}"`;
  const results: T[] = [];
  const seenStarts = new Set<number>();

  let cursor = html.indexOf(token);
  while (cursor !== -1) {
    const start = findObjectStart(cursor);
    if (start !== -1 && !seenStarts.has(start)) {
      seenStarts.add(start);
      const end = findObjectEnd(start);
      if (end !== -1) {
        try {
          results.push(JSON.parse(html.slice(start, end + 1)) as T);
        } catch {
          // 상품 객체가 아닌 조각이 섞여도 다음 후보를 계속 시도한다.
        }
      }
    }
    cursor = html.indexOf(token, cursor + token.length);
  }

  return results;
}

/**
 * 동일 링크는 최저가로 합치고 상위 `limit`개를 만든다.
 *
 * 살 수 있는 오퍼를 품절보다 앞에 둔다. 품절가가 더 싸도 원가 1등 자리를
 * 차지하지 않게 하고, 상위 10개 자리도 살 수 있는 쪽으로 먼저 채운다.
 *
 * `perSourceLimit`은 한 몰이 목록을 독점하는 것을 막는다. 롯데ON은 한 품번에
 * 60건을 돌려주기 때문에 상한이 없으면 상위 10개가 전부 한 몰로 채워져
 * 품절 시 대안을 볼 수 없다. 몰별 상한을 채운 뒤 남는 자리는 이어서 메운다.
 */
export function dedupeAndSortOffers(
  offers: SourceOffer[],
  limit = 10,
  perSourceLimit = 5
): SourceOffer[] {
  const byKey = new Map<string, SourceOffer>();

  for (const offer of offers) {
    const key = `${offer.source}:${offer.link}`;
    const prev = byKey.get(key);
    if (!prev || offer.price < prev.price) {
      byKey.set(key, offer);
    }
  }

  const unique = [...byKey.values()];
  const ranked = [
    ...unique.filter((offer) => !isSoldOutOffer(offer)).sort((a, b) => a.price - b.price),
    ...unique.filter((offer) => isSoldOutOffer(offer)).sort((a, b) => a.price - b.price),
  ];

  const perSourceCount = new Map<string, number>();
  const picked: SourceOffer[] = [];
  const overflow: SourceOffer[] = [];

  for (const offer of ranked) {
    const count = perSourceCount.get(offer.source) ?? 0;
    if (count < perSourceLimit) {
      perSourceCount.set(offer.source, count + 1);
      picked.push(offer);
    } else {
      overflow.push(offer);
    }
  }

  return [...picked, ...overflow].slice(0, limit);
}
