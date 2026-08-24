const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const article = process.argv[2] || "CW2288-111";

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json,text/html,*/*", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  return { status: res.status, text, ctype: res.headers.get("content-type") };
}

async function main() {
  const candidates = [
    `https://hiver-api.brandi.biz/v1/search?keyword=${encodeURIComponent(article)}`,
    `https://hiver-api.brandi.biz/v2/search?keyword=${encodeURIComponent(article)}`,
    `https://hiver-api.brandi.biz/search?keyword=${encodeURIComponent(article)}`,
    `https://hiver-api.brandi.biz/v1/products/search?keyword=${encodeURIComponent(article)}`,
    `https://hiver-api.brandi.biz/v1/web/search?keyword=${encodeURIComponent(article)}`,
    `https://hiver-api.brandi.biz/v1/web/products?keyword=${encodeURIComponent(article)}`,
    `https://api.brandi.co.kr/v1/search?keyword=${encodeURIComponent(article)}`,
    `https://api.brandi.co.kr/v2/products/search?q=${encodeURIComponent(article)}`,
    // CJ onstyle / GS / Hmall
    `https://display.cjonstyle.com/p/searchResultAjax?searchKeyword=${encodeURIComponent(article)}`,
    `https://www.gsshop.com/shop/search/mainAjax.gs?tq=${encodeURIComponent(article)}`,
    `https://www.hmall.com/api/pde/search?searchTerm=${encodeURIComponent(article)}`,
    // LF mall
    `https://www.lfmall.co.kr/api/search/product?keyword=${encodeURIComponent(article)}`,
    `https://www.lfmall.co.kr/j/search/product?keyword=${encodeURIComponent(article)}`,
    // 11st mobile
    `https://m.11st.co.kr/MW/Search/searchProductApi.tmall?kwd=${encodeURIComponent(article)}`,
    `https://apis.11st.co.kr/search/api/v1/search?kwd=${encodeURIComponent(article)}`,
    // KREAM API guess
    `https://api.kream.co.kr/api/p/products/search?keyword=${encodeURIComponent(article)}`,
    `https://kream.co.kr/api/p/products/?keyword=${encodeURIComponent(article)}&sort=popular_score&cursor=`,
    // 29cm recent paths
    `https://search-api.29cm.co.kr/api/v4/plp/home?keyword=${encodeURIComponent(article)}`,
    `https://product-list-api.29cm.co.kr/api/v4/plp?keyword=${encodeURIComponent(article)}`,
    `https://product.29cm.co.kr/api/v4/plp?keyword=${encodeURIComponent(article)}`,
  ];

  for (const url of candidates) {
    try {
      const r = await get(url);
      console.log(
        String(r.status).padStart(3),
        String(r.text.length).padStart(7),
        (r.ctype || "").slice(0, 28).padEnd(28),
        url.slice(0, 90),
        r.text.slice(0, 100).replace(/\n/g, " ")
      );
    } catch (e) {
      console.log("ERR", (e as Error).message.slice(0, 60), url.slice(0, 70));
    }
  }

  // Inspect hiver JS chunk for API path
  const chunk = await get("https://www.hiver.co.kr/_next/static/chunks/pages/search-05dbf23f4c146539.js");
  console.log("\nchunk", chunk.status, chunk.text.length);
  const hits = [...chunk.text.matchAll(/https?:[^"'`\s]{10,120}|hiver-api[^"'`\s]{0,80}|\/v\d\/[^"'`\s]{5,80}/g)].map(
    (m) => m[0]
  );
  console.log([...new Set(hits)].slice(0, 50));
}

main().catch(console.error);
