import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

interface ImallGoods {
  goodsNo?: number;
  goodsNm?: string;
  brandNm?: string;
  benefitPrc?: string;
  normalPrc?: string;
  goodsUrl?: string;
  goodsImgUrl?: string;
  isSoldout?: string;
}

interface ImallUnit {
  meta?: { uid?: string };
  data?: ImallGoods[] | Record<string, unknown>;
}

interface ImallSearchResponse {
  header?: { resultCode?: string; resultMsg?: string };
  body?: ImallUnit[];
}

const IMALL_SEARCH_URL = "https://www.lotteimall.com/search/searchMain.lotte";
const IMALL_ORIGIN = "https://www.lotteimall.com";

function absolute(path: string | undefined | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${IMALL_ORIGIN}${path}`;
}

export const lotteImallProvider: SourceOfferProvider = {
  key: "lotteimall",
  label: "롯데아이몰",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const params = new URLSearchParams({
      isTemplate: "Y",
      headerQuery: normalized,
      cate_depth: "1",
      page: "1",
      lst_sort_cd: "RANK/DESC",
      colldisplay: "60",
    });

    const response = await fetch(`${IMALL_SEARCH_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/html",
        Referer: `${IMALL_SEARCH_URL}?headerQuery=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`롯데아이몰 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as ImallSearchResponse;
    if (body.header?.resultCode && body.header.resultCode !== "0000") {
      throw new Error(`롯데아이몰 응답 실패 (${body.header.resultMsg ?? body.header.resultCode})`);
    }

    const items =
      body.body?.find((unit) => unit.meta?.uid === "search_result_goods_info")?.data ?? [];
    const goodsList = Array.isArray(items) ? items : [];

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const goods of goodsList) {
      const price = parsePrice(goods.benefitPrc || goods.normalPrc);
      const link = absolute(goods.goodsUrl);
      if (!price || !goods.goodsNm || !link) continue;

      const hints = [
        goods.isSoldout === "Y" ? "품절" : null,
        goods.brandNm || null,
      ].filter(Boolean);

      offers.push({
        source: "lotteimall",
        sourceLabel: "롯데아이몰",
        price,
        title: `${goods.brandNm ? `${goods.brandNm} ` : ""}${goods.goodsNm}`,
        link,
        image: goods.goodsImgUrl ?? null,
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
