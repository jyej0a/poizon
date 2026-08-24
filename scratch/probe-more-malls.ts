const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const article = process.argv[2] || "CW2288-111";

async function probe(name: string, url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "*/*", ...(init?.headers as Record<string, string>) },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      ...init,
    });
    const text = await res.text();
    const markers = [
      "__NEXT_DATA__",
      "priceInfo",
      "goodsName",
      "productName",
      "salePrice",
      "finalPrice",
      "itemName",
      "itemList",
      "products",
      "pdName",
    ]
      .filter((m) => text.includes(m))
      .join(",");
    console.log(
      name.padEnd(16),
      String(res.status).padStart(3),
      String(text.length).padStart(8),
      (markers || "-").slice(0, 40),
      text.slice(0, 90).replace(/\n/g, " ")
    );
    return text;
  } catch (e) {
    console.log(name.padEnd(16), "ERR", (e as Error).message.slice(0, 80));
    return "";
  }
}

async function main() {
  await probe("akmall", `https://www.akmall.com/goods/search?searchWord=${article}`);
  await probe("galleria", `https://www.galleria.co.kr/search?keyword=${article}`);
  await probe("himart", `https://www.e-himart.co.kr/app/display/search?query=${article}`);
  await probe("elandmall", `https://www.elandmall.com/search/search.action?kwd=${article}`);
  await probe("spao", `https://www.spao.com/goods/goods_search.php?keyword=${article}`);
  await probe("uniqlo", `https://www.uniqlo.com/kr/ko/search?q=${article}`);
  await probe("nike-kr", `https://www.nike.com/kr/w?q=${encodeURIComponent(article)}&vst=${encodeURIComponent(article)}`);
  await probe("adidas-kr", `https://www.adidas.co.kr/search?q=${encodeURIComponent(article)}`);
  await probe("cjmall2", `https://display.cjonstyle.com/c/search?searchKeyword=${encodeURIComponent(article)}`);
  await probe("cjmall3", `https://base.cjonstyle.com/p/searchResult?searchKeyword=${encodeURIComponent(article)}`);
  await probe(
    "ssg-dept",
    `https://www.ssg.com/search.ssg?target=all&query=${encodeURIComponent(article)}&siteNo=6005`
  );

  // Hiver: try query as repeated typed params used by protobuf-ish APIs
  const hiverQs = [
    `query.type=search&query.keyword=${article}&offset=0&limit=40`,
    `query=type:search,keyword:${article}`,
    `type=SEARCH&keyword=${article}`,
    `query_type=search&query_keyword=${article}`,
  ];
  for (const q of hiverQs) {
    await probe("hiver-" + q.slice(0, 20), `https://hiver-api.brandi.biz/v1/web/products?${q}`);
  }

  // Brandi web API (same company as hiver)
  await probe("brandi-web", `https://www.brandi.co.kr/search?q=${article}`);
  await probe(
    "brandi-api",
    `https://api.brandi.co.kr/v2/web/products?query.type=search&query.keyword=${encodeURIComponent(article)}`
  );

  // Musinsa beauty / 29cm via Cloudflare?
  const t29 = await probe(
    "29cm-srch",
    `https://search-api.29cm.co.kr/api/v4/plp/products?keyword=${encodeURIComponent(article)}&sort=RECOMMEND&offset=0&limit=50&facetExist=true`
  );
  if (t29.includes("{")) console.log("29 body", t29.slice(0, 300));
}

main().catch(console.error);
