import { writeFileSync } from "fs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const article = "CW2288-111";

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  return { status: res.status, text, ctype: res.headers.get("content-type") };
}

async function main() {
  const h = await get(`https://www.hiver.co.kr/search?keyword=${article}`);
  console.log("hiver", h.status, h.text.length);
  writeFileSync("scratch/hiver-search.html", h.text);
  const urls = [...h.text.matchAll(/https?:\\\/\\\/[^"\\]+/g)]
    .map((m) => m[0].replace(/\\\//g, "/"))
    .filter((u) => /api|search|graphql|product|plp/i.test(u));
  console.log("hiver urls", [...new Set(urls)].slice(0, 40));

  for (const url of [
    `https://www.hiver.co.kr/api/search?keyword=${encodeURIComponent(article)}`,
    `https://api.hiver.co.kr/search?keyword=${encodeURIComponent(article)}`,
    `https://www.hiver.co.kr/api/products/search?q=${encodeURIComponent(article)}`,
  ]) {
    const r = await get(url);
    console.log("hapi", r.status, r.text.length, url, r.text.slice(0, 180).replace(/\n/g, " "));
  }

  const home = await get("https://www.29cm.co.kr/");
  console.log("29home", home.status, home.text.length);
  writeFileSync("scratch/29cm-home.html", home.text);
  const apiHits = [...home.text.matchAll(/https?:\/\/[a-z0-9.-]*29cm[^"'\\s]{0,100}/gi)].map((m) => m[0]);
  console.log("29 hosts", [...new Set(apiHits)].slice(0, 30));

  // look for buildManifest / env in 29cm home
  const envMatch = home.text.match(/NEXT_PUBLIC_[A-Z0-9_]+/g);
  console.log("29 env", [...new Set(envMatch ?? [])].slice(0, 40));

  for (const [name, url] of [
    ["lfmall", `https://www.lfmall.co.kr/app/search/product?keyword=${article}`],
    ["ohou", `https://ohou.se/productions/feed.json?query=${article}&v=5`],
    ["brandi", `https://www.brandi.co.kr/search?q=${article}`],
    ["musinsa2", `https://api.musinsa.com/api2/dp/v2/plp/goods?gf=A&keyword=${article}&sortCode=POPULAR&page=1&size=40&caller=SEARCH`],
    ["gsshop", `https://www.gsshop.com/shop/search/main.gs?tq=${article}`],
    ["hmall", `https://www.hmall.com/p/pde/search.do?searchTerm=${article}`],
    ["nsmall", `https://www.nsmall.com/jsp/search/search.jsp?keyword=${article}`],
    ["cjmall", `https://display.cjonstyle.com/p/searchResult?searchKeyword=${article}`],
  ] as const) {
    try {
      const r = await get(url);
      const markers = ["__NEXT_DATA__", "priceInfo", "goodsName", "productName", "salePrice", "finalPrice", "itemName", "itemList"]
        .filter((m) => r.text.includes(m))
        .join(",");
      console.log(name.padEnd(10), r.status, String(r.text.length).padStart(8), markers || "-", r.text.slice(0, 90).replace(/\n/g, " "));
    } catch (e) {
      console.log(name.padEnd(10), "ERR", (e as Error).message.slice(0, 80));
    }
  }
}

main().catch(console.error);
