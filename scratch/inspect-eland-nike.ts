import { writeFileSync } from "fs";
import { extractJsonObjectsContainingKey } from "../lib/sourcing/utils";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const article = process.argv[2] || "CW2288-111";

async function main() {
  // E-Land Mall
  const eRes = await fetch(`https://www.elandmall.com/search/search.action?kwd=${encodeURIComponent(article)}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25000),
  });
  const eHtml = await eRes.text();
  writeFileSync("scratch/elandmall.html", eHtml);
  console.log("eland status", eRes.status, eHtml.length);

  // Try common patterns
  const next = eHtml.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  console.log("has NEXT_DATA", Boolean(next));

  for (const key of ["salePrice", "productName", "itemList", "goodsNo", "finalPrice"]) {
    const objs = extractJsonObjectsContainingKey<Record<string, unknown>>(eHtml, key);
    console.log("eland key", key, "count", objs.length);
    if (objs[0]) console.log(" sample", JSON.stringify(objs[0]).slice(0, 400));
  }

  // Look for API endpoints in page
  const apis = [...eHtml.matchAll(/https?:\/\/[^"'\\s>]{10,120}/g)]
    .map((m) => m[0])
    .filter((u) => /api|search|product|ajax/i.test(u));
  console.log("eland apis", [...new Set(apis)].slice(0, 20));

  // Nike KR
  const nRes = await fetch(
    `https://www.nike.com/kr/w?q=${encodeURIComponent(article)}&vst=${encodeURIComponent(article)}`,
    { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(25000) }
  );
  const nHtml = await nRes.text();
  writeFileSync("scratch/nike-kr.html", nHtml);
  console.log("\nnike", nRes.status, nHtml.length);
  const nNext = nHtml.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nNext) {
    const data = JSON.parse(nNext[1]);
    writeFileSync("scratch/nike-next.json", JSON.stringify(data, null, 2).slice(0, 200000));
    console.log("pageProps keys", Object.keys(data?.props?.pageProps ?? {}));
    const blob = JSON.stringify(data.props?.pageProps ?? {}).slice(0, 3000);
    console.log(blob);
  }

  // Brandi
  const bRes = await fetch(`https://www.brandi.co.kr/search?q=${encodeURIComponent(article)}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25000),
  });
  const bHtml = await bRes.text();
  writeFileSync("scratch/brandi.html", bHtml);
  console.log("\nbrandi", bRes.status, bHtml.length);
  for (const key of ["itemList", "sale_price", "product_name", "products", "name"]) {
    const objs = extractJsonObjectsContainingKey<Record<string, unknown>>(bHtml, key);
    console.log("brandi key", key, "count", objs.length);
    if (objs[0]) console.log(" sample", JSON.stringify(objs[0]).slice(0, 350));
  }
}

main().catch(console.error);
