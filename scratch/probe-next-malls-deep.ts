/**
 * 유망 몰 HTML/JS에서 검색 API·토큰을 찾는다.
 * 사용: pnpm tsx scratch/probe-next-malls-deep.ts
 */
import { writeFileSync, mkdirSync } from "fs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const article = process.argv[2] || "JWJGX25211";

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  return { status: res.status, text, url: res.url, ctype: res.headers.get("content-type") };
}

function pickUrls(text: string, extra = /api|search|graphql|product|plp|capi/i) {
  const raw = [
    ...text.matchAll(/https?:\/\/[a-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/gi),
    ...text.matchAll(/https?:\\\/\\\/[^"\\]+/g),
  ].map((m) => m[0].replace(/\\\//g, "/").replace(/[\\'",]+$/, ""));
  return [...new Set(raw.filter((u) => extra.test(u)))].slice(0, 40);
}

async function dump(name: string, url: string, headers?: Record<string, string>) {
  const r = await get(url, headers);
  mkdirSync("scratch/next-malls", { recursive: true });
  writeFileSync(`scratch/next-malls/${name}.txt`, r.text.slice(0, 400_000));
  console.log(
    "\n==",
    name,
    r.status,
    r.text.length,
    r.url,
    (r.ctype || "").slice(0, 30)
  );
  console.log("urls", pickUrls(r.text).slice(0, 20));
  const tokenHits = [
    ...r.text.matchAll(/(Authorization|api[-_]?key|guest|CM|DISPLAY[-_]?API|accessToken)[^]{0,80}/gi),
  ]
    .map((m) => m[0].replace(/\s+/g, " ").slice(0, 120))
    .slice(0, 8);
  if (tokenHits.length) console.log("tokens", tokenHits);
  return r;
}

async function main() {
  const q = encodeURIComponent(article);

  await dump("brandi-html", `https://www.brandi.co.kr/search?q=${q}`);
  await dump("halfclub-html", `https://www.halfclub.com/search?keyword=${q}`);
  await dump("uniqlo-html", `https://www.uniqlo.com/kr/ko/search?q=${q}`);
  await dump("zigzag-html", `https://zigzag.kr/search?keyword=${q}`);
  await dump("galleria-html", `https://www.galleria.co.kr/search?keyword=${q}`);
  await dump("nsmall-html", `https://www.nsmall.com/jsp/search/search.jsp?keyword=${q}`);

  for (const [name, url] of [
    ["akmall-do", `https://www.akmall.com/search/Search.do?searchGubun=total&searchWord=${q}`],
    ["akmall-txt", `https://www.akmall.com/goods/Search?searchTxt=${q}`],
    ["fashionplus-php", `https://www.fashionplus.co.kr/goods/goods_search.php?keyword=${q}`],
    ["fashionplus2", `https://www.fashionplus.co.kr/display/search?searchWord=${q}`],
    ["okmall-total", `https://www.okmall.com/search/total?keyword=${q}`],
    ["okmall-goods", `https://www.okmall.com/goods/goods_search.php?keyword=${q}`],
    ["halfclub-term", `https://www.halfclub.com/display/search?searchTerm=${q}`],
    ["nsmall-wcs", `https://www.nsmall.com/webapp/wcs/stores/servlet/SearchDisplay?searchTerm=${q}`],
    ["hnsmall-search", `https://www.hnsmall.com/display/search?searchTerm=${q}`],
    ["spao-search", `https://www.spao.com/product/search?keyword=${q}`],
    ["galleria-g", `https://www.galleria.co.kr/gsearch?keyword=${q}`],
    ["interpark2", `https://shopping.interpark.com/product/search.do?keyword=${q}`],
  ] as const) {
    try {
      const r = await get(url);
      console.log(
        name.padEnd(22),
        r.status,
        String(r.text.length).padStart(8),
        r.url.slice(0, 70),
        r.text.slice(0, 80).replace(/\s+/g, " ")
      );
    } catch (error) {
      console.log(name.padEnd(22), "ERR", (error as Error).message.slice(0, 80));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
