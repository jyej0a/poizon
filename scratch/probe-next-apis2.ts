import { readFileSync, writeFileSync } from "fs";

const UA = "Mozilla/5.0";
const article = process.argv[2] || "JWJGX25211";

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  return { status: res.status, text: await res.text(), url: res.url };
}

function clip(text: string, n = 220) {
  return text.replace(/\s+/g, " ").slice(0, n);
}

async function main() {
  const brandi = readFileSync("scratch/next-malls/brandi-html.txt", "utf8");
  const idx = brandi.indexOf("window.__INITIAL_STATE__");
  console.log("brandi state idx", idx, "len", brandi.length);
  const start = brandi.indexOf("{", idx);
  let depth = 0;
  let end = start;
  for (let i = start; i < brandi.length; i += 1) {
    const ch = brandi[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const json = brandi.slice(start, end);
  const state = JSON.parse(json) as Record<string, unknown>;
  console.log("brandi top keys", Object.keys(state));
  for (const key of Object.keys(state)) {
    const value = JSON.stringify(state[key]);
    console.log(key.padEnd(18), value.length, value.slice(0, 120).replace(/\s+/g, " "));
  }

  const q = encodeURIComponent(article);

  // Halfclub display template + search API guesses
  const halfFiles = [
    "https://cdn2.halfclub.com/rd/static/hpc/_nuxt/js/SearchDisplayTemplate-DI_NZ_sP.js",
    "https://cdn2.halfclub.com/rd/static/hpc/_nuxt/js/ProductSearchItem-DWSbut9P.js",
    "https://cdn2.halfclub.com/rd/static/hpc/_nuxt/js/ProductList-CdYunSWk.js",
  ];
  for (const url of halfFiles) {
    const r = await get(url);
    const hits = [...r.text.matchAll(/["'`](\/[^"'`]{5,80})["'`]/g)]
      .map((m) => m[1])
      .filter((p) => /search|goods|product|display|hapix|hapi/i.test(p));
    console.log("\n", url.split("/").pop(), r.status, [...new Set(hits)].slice(0, 25));
  }

  const halfPaths = [
    `/search/product?keyword=${q}&siteCd=1&limit=0,40&sortSeq=12`,
    `/display/search?keyword=${q}&siteCd=1`,
    `/v1/display/search?keyword=${q}`,
    `/goods/search?keyword=${q}`,
    `/search/goods?keyword=${q}&siteCd=1&limit=0,40`,
    `/api/search?keyword=${q}`,
    `/search?keyword=${q}&siteCd=1&limit=0,40&sortSeq=12`,
  ];
  for (const path of halfPaths) {
    for (const host of ["https://hapix.halfclub.com", "https://cf-hapi.halfclub.com"]) {
      try {
        const r = await get(`${host}${path}`, {
          Origin: "https://www.halfclub.com",
          Referer: "https://www.halfclub.com/",
          Accept: "application/json",
        });
        if (r.status !== 404) {
          console.log("half", r.status, host.replace("https://", ""), path.slice(0, 50), clip(r.text));
        }
      } catch (error) {
        console.log("half ERR", path.slice(0, 40), (error as Error).message.slice(0, 60));
      }
    }
  }

  // Zigzag: extract GraphQL operation names
  const zig = readFileSync("scratch/next-malls/zigzag-search.js.txt", "utf8");
  const ops = [...zig.matchAll(/query [A-Za-z0-9_]+|mutation [A-Za-z0-9_]+|catalog_[a-z_]+|search_[a-z_]+/g)].map(
    (m) => m[0]
  );
  console.log("\nzigzag ops", [...new Set(ops)].slice(0, 40));

  const nsmallSearch = await get("https://www.nsmall.com/assets/search-result-C_EA2Ub8.js");
  writeFileSync("scratch/next-malls/nsmall-search.js.txt", nsmallSearch.text.slice(0, 120000));
  const nsHits = [...nsmallSearch.text.matchAll(/https?:[^"`']{10,90}|mapi\.nsmall[^"`']{0,60}|\/search[^"`']{0,50}/g)]
    .map((m) => m[0])
    .slice(0, 40);
  console.log("\nnsmall search js", nsmallSearch.status, nsmallSearch.text.length, [...new Set(nsHits)].slice(0, 25));

  // Uniqlo with a real-ish query
  const uniqlo = await get("https://www.uniqlo.com/kr/api/commerce/v5/ko/products?q=T-shirt&offset=0&limit=8", {
    Origin: "https://www.uniqlo.com",
    Referer: "https://www.uniqlo.com/kr/ko/search?q=T-shirt",
  });
  console.log("\nuniqlo sample", uniqlo.status, clip(uniqlo.text, 400));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
