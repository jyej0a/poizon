import { readFileSync, writeFileSync } from "fs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const article = process.argv[2] || "JWJGX25211";

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json,text/javascript,*/*", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  return { status: res.status, text, ctype: res.headers.get("content-type"), url: res.url };
}

function clip(text: string, n = 280) {
  return text.replace(/\s+/g, " ").slice(0, n);
}

async function main() {
  const brandi = readFileSync("scratch/next-malls/brandi-html.txt", "utf8");
  const stateMatch = brandi.match(/window\.__INITIAL_STATE__ = (\{.*\});?\s*</s);
  if (stateMatch) {
    const state = JSON.parse(stateMatch[1]);
    writeFileSync("scratch/next-malls/brandi-state-keys.json", JSON.stringify(Object.keys(state), null, 2));
    const search = state.search ?? state.searches ?? state.searchResult ?? null;
    console.log("brandi keys", Object.keys(state).join(","));
    if (search) {
      console.log("brandi search keys", Object.keys(search));
      writeFileSync("scratch/next-malls/brandi-search.json", JSON.stringify(search).slice(0, 20000));
    } else {
      for (const [key, value] of Object.entries(state)) {
        const json = JSON.stringify(value);
        if (json.includes("JWJGX") || json.includes("productList") && json.length > 200) {
          console.log("brandi hit", key, json.slice(0, 200));
        }
      }
    }
  } else {
    console.log("brandi no INITIAL_STATE parse");
  }

  const scripts = [...brandi.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]).slice(0, 30);
  console.log("brandi scripts", scripts.slice(0, 15));

  const q = encodeURIComponent(article);

  // Brandi / Hiver style APIs
  for (const [name, url, headers] of [
    [
      "brandi-capi",
      `https://capi.brandi.co.kr/v1/web/search/products/${q}?offset=0&limit=30&version=2301&total-count=true&service-type=brandi`,
      { Origin: "https://www.brandi.co.kr", Referer: `https://www.brandi.co.kr/search?q=${q}` },
    ],
    [
      "brandi-search",
      `https://search.brandi.co.kr/v1/web/search/products/${q}?offset=0&limit=30`,
      { Origin: "https://www.brandi.co.kr" },
    ],
    [
      "halfclub-hapix",
      `https://hapix.halfclub.com/search/v1/products?keyword=${q}&page=1&size=40`,
      { Origin: "https://www.halfclub.com", Referer: "https://www.halfclub.com/" },
    ],
    [
      "halfclub-cf",
      `https://cf-hapi.halfclub.com/search/v1/products?keyword=${q}&page=1&size=40`,
      { Origin: "https://www.halfclub.com" },
    ],
    [
      "zigzag-search",
      `https://api.zigzag.kr/api/2/graphql`,
      { Origin: "https://zigzag.kr", "Content-Type": "application/json" },
    ],
    [
      "uniqlo-api",
      `https://www.uniqlo.com/kr/api/commerce/v5/ko/products?q=${q}&offset=0&limit=24`,
      { Origin: "https://www.uniqlo.com", Referer: `https://www.uniqlo.com/kr/ko/search?q=${q}` },
    ],
  ] as Array<[string, string, Record<string, string>]>) {
    try {
      const init =
        name === "zigzag-search"
          ? {
              method: "POST",
              body: JSON.stringify({
                query: "query { __typename }",
              }),
            }
          : {};
      const r = await get(url, { ...headers, ...(init as { headers?: Record<string, string> }).headers });
      console.log(name.padEnd(18), r.status, r.text.length, clip(r.text));
    } catch (error) {
      console.log(name.padEnd(18), "ERR", (error as Error).message.slice(0, 80));
    }
  }

  const halfJs = await get("https://cdn2.halfclub.com/rd/static/hpc/_nuxt/js/search-DuVnfmVJ.js");
  const halfHits = [...halfJs.text.matchAll(/hapix[^"`']{0,80}|cf-hapi[^"`']{0,80}|\/search[^"`']{0,80}|keyword[^"`']{0,40}/g)]
    .map((m) => m[0])
    .slice(0, 40);
  console.log("\nhalfclub js", halfJs.status, [...new Set(halfHits)].slice(0, 30));
  writeFileSync("scratch/next-malls/halfclub-search.js.txt", halfJs.text.slice(0, 80000));

  const zigJs = await get(
    "https://www.zigzag.kr/resources/latest/arm64/website/_next/static/chunks/pages/search-82441edbd79a216b.js"
  );
  const zigHits = [...zigJs.text.matchAll(/api\.zigzag[^"`']{0,80}|search[^"`']{0,50}|graphql[^"`']{0,40}/g)]
    .map((m) => m[0])
    .slice(0, 40);
  console.log("\nzigzag js", zigJs.status, zigJs.text.length, [...new Set(zigHits)].slice(0, 30));
  writeFileSync("scratch/next-malls/zigzag-search.js.txt", zigJs.text.slice(0, 80000));

  const nsmallJs = await get("https://www.nsmall.com/assets/index-DQqlC40R.js");
  const nsHits = [...nsmallJs.text.matchAll(/https?:[^"`']{10,80}|\/search[^"`']{0,60}|nsmall[^"`']{0,40}/g)]
    .map((m) => m[0])
    .slice(0, 40);
  console.log("\nnsmall js", nsmallJs.status, nsmallJs.text.length, [...new Set(nsHits)].slice(0, 25));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
