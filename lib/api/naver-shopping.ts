import { createClerkSupabaseClient } from "@/lib/supabase/server";

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

export async function searchNaverShopping(keyword: string): Promise<{ success: boolean; data?: NaverShoppingItem[]; error?: string }> {
  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("네이버 API 인증 정보가 설정되지 않았습니다.");
    }

    // 키워드 정제: # 제거 및 공백 제거
    const cleanKeyword = keyword.replace("#", "").trim();
    console.log(`[NaverSearch] 키워드 정제: ${keyword} -> ${cleanKeyword}`);

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
      const errorData = await response.json();
      console.error(`[NaverSearch] API 오류:`, errorData);
      throw new Error(`Naver API Error: ${errorData.errorMessage || response.statusText}`);
    }

    const data = await response.json();
    const items: NaverShoppingItem[] = data.items || [];
    console.log(`[NaverSearch] 검색 결과 수: ${items.length}`);

    if (items.length === 0) {
      return { success: true, data: [] };
    }

    // DB에서 화이트리스트(메이저 종합몰) 가져오기
    const supabase = await createClerkSupabaseClient();
    const { data: whitelist, error: dbError } = await supabase
      .from("mall_whitelist")
      .select("name")
      .eq("is_active", true);

    if (dbError) {
      console.error("Failed to fetch mall whitelist:", dbError);
      return { success: true, data: items };
    }

    const whitelistNames = new Set(whitelist.map((m) => m.name));
    console.log(`[NaverSearch] 활성 화이트리스트:`, Array.from(whitelistNames));
    
    const filteredItems = items.filter((item) => whitelistNames.has(item.mallName));
    console.log(`[NaverSearch] 필터링 후 결과 수: ${filteredItems.length}`);

    // 만약 필터링 후 결과가 하나도 없다면, 상위 5개라도 보여주기 (최저가 참고용)
    if (filteredItems.length === 0 && items.length > 0) {
      console.log(`[NaverSearch] 필터링 결과 없음. 원본 상위 5개 사용.`);
      const backupItems = items.slice(0, 5).sort((a, b) => Number(a.lprice) - Number(b.lprice));
      return { success: true, data: backupItems };
    }

    // 낮은 가격순 정렬
    const sortedItems = filteredItems.sort((a, b) => Number(a.lprice) - Number(b.lprice));

    return { success: true, data: sortedItems };
  } catch (error: any) {
    console.error("Naver Shopping Search Error:", error);
    return { success: false, error: error.message };
  }
}
