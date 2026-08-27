/**
 * 다음 몰 커버리지 배치 프로브.
 * 사용: pnpm tsx scratch/probe-next-malls.ts [품번]
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const article = process.argv[2] || "JWJGX25211";

async function probe(name: string, url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/json,*/*",
        ...(init?.headers as Record<string, string> | undefined),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      ...init,
    });
    const text = await res.text();
    const ctype = res.headers.get("content-type") ?? "";
    const markers = [
      "__NEXT_DATA__",
      "salePrice",
      "productName",
      "goodsName",
      "itemName",
      "itemList",
      "products",
      "prdNm",
      "finalPrice",
      "data-prd",
      "soldOut",
    ]
      .filter((marker) => text.includes(marker))
      .join(",");
    console.log(
      name.padEnd(22),
      String(res.status).padStart(3),
      String(text.length).padStart(8),
      ctype.slice(0, 24).padEnd(24),
      (markers || "-").slice(0, 48),
      text.slice(0, 110).replace(/\s+/g, " ")
    );
    return text;
  } catch (error) {
    console.log(name.padEnd(22), "ERR", (error as Error).message.slice(0, 100));
    return "";
  }
}

async function main() {
  const q = encodeURIComponent(article);
  await probe("brandi", `https://www.brandi.co.kr/search?q=${q}`);
  await probe("brandi-api", `https://api.brandi.co.kr/v1/web/search/products/${q}?offset=0&limit=30`);
  await probe(
    "brandi-capi",
    `https://capi.brandi.co.kr/v1/web/search/products/${q}?offset=0&limit=30`
  );
  await probe("akmall", `https://www.akmall.com/goods/Search?searchWord=${q}`);
  await probe("akmall2", `https://www.akmall.com/goods/searchGoods?searchWord=${q}`);
  await probe("galleria", `https://www.galleria.co.kr/search?keyword=${q}`);
  await probe("fashionplus", `https://www.fashionplus.co.kr/search?keyword=${q}`);
  await probe("halfclub", `https://www.halfclub.com/search?keyword=${q}`);
  await probe("okmall", `https://www.okmall.com/products/search?keyword=${q}`);
  await probe("nsmall", `https://www.nsmall.com/jsp/search/search.jsp?keyword=${q}`);
  await probe("hnsmall", `https://www.hnsmall.com/search?query=${q}`);
  await probe("spao", `https://www.spao.com/goods/goods_search.php?keyword=${q}`);
  await probe("uniqlo", `https://www.uniqlo.com/kr/ko/search?q=${q}`);
  await probe("interpark", `https://shopping.interpark.com/search?q=${q}`);
  await probe("zigzag", `https://zigzag.kr/search?keyword=${q}`);
  await probe("ably", `https://m.a-bly.com/search?keyword=${q}`);
  await probe("shoemarker", `https://www.shoemarker.co.kr/goods/goods_search.php?keyword=${q}`);
  await probe("footlocker", `https://www.footlocker.kr/search?q=${q}`);
  await probe("okmall2", `https://www.okmall.com/search?keyword=${q}`);
  await probe("halfclub2", `https://www.halfclub.com/Display/Search?keyword=${q}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
