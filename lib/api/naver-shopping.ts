import type { SupabaseClient } from "@supabase/supabase-js";

export interface NaverShoppingItem {
  title: string;
  link: string;
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

export interface NaverSearchResult {
  success: boolean;
  data?: NaverShoppingItem[];
  error?: string;
}

/**
 * 메이저 종합몰 화이트리스트. 품번 하나당 한 번씩 재조회되던 것을
 * 호출부에서 미리 로드해 재사용할 수 있도록 분리했다.
 */
export async function loadMallWhitelist(
  supabase: SupabaseClient
): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from("mall_whitelist")
    .select("name")
    .eq("is_active", true);

  if (error) {
    console.error("Failed to fetch mall whitelist:", error);
    return null;
  }
  return new Set((data ?? []).map((m: { name: string }) => m.name));
}

async function fetchNaverItems(keyword: string): Promise<NaverShoppingItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("네이버 API 인증 정보가 설정되지 않았습니다.");
  }

  // 키워드 정제: # 제거 및 공백 제거
  const cleanKeyword = keyword.replace("#", "").trim();

  const response = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(cleanKeyword)}&display=100&sort=sim`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Naver API Error: ${errorData.errorMessage || response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * 화이트리스트 적용 후 가격 오름차순 정렬.
 * 화이트리스트 결과가 하나도 없으면 최저가 참고용으로 원본 상위 5개를 반환한다.
 */
function applyMallWhitelist(
  items: NaverShoppingItem[],
  whitelistNames: Set<string> | null
): NaverShoppingItem[] {
  const byPrice = (a: NaverShoppingItem, b: NaverShoppingItem) =>
    Number(a.lprice) - Number(b.lprice);

  if (!whitelistNames) return items;

  const filtered = items.filter((item) => whitelistNames.has(item.mallName));
  if (filtered.length === 0) return items.slice(0, 5).sort(byPrice);

  return filtered.sort(byPrice);
}

/**
 * 화이트리스트를 미리 로드해 사용한다.
 *
 * Clerk에 의존하지 않으므로 Next 런타임 밖(백그라운드 워커)에서도 호출할 수 있다.
 * 화이트리스트를 호출부에서 주입받기 때문에 품번 N건을 조회해도 DB 조회는 1회다.
 */
export async function searchNaverShoppingWithWhitelist(
  keyword: string,
  whitelistNames: Set<string> | null
): Promise<NaverSearchResult> {
  try {
    const items = await fetchNaverItems(keyword);
    if (items.length === 0) return { success: true, data: [] };
    return { success: true, data: applyMallWhitelist(items, whitelistNames) };
  } catch (error: any) {
    // 스택은 남기지 않는다. 대량 검색에서 품번마다 반복되면 로그를 덮어버리고,
    // 호출부가 실패 사유를 이미 집계한다.
    return { success: false, error: error.message };
  }
}
