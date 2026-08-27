import { readFileSync, writeFileSync } from "fs";

const UA = "Mozilla/5.0";
const article = process.argv[2] || "JWJGX25211";

async function get(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json,*/*", ...(init?.headers as Record<string, string>) },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    ...init,
  });
  return { status: res.status, text: await res.text() };
}

function clip(text: string, n = 260) {
  return text.replace(/\s+/g, " ").slice(0, n);
}

async function main() {
  const zig = readFileSync("scratch/next-malls/zigzag-search.js.txt", "utf8");
  const idx = zig.indexOf("query GetSearchResult");
  console.log("GetSearchResult idx", idx);
  const slice = zig.slice(idx, idx + 2500);
  writeFileSync("scratch/next-malls/zigzag-getsearchresult.txt", slice);
  console.log("query snippet", slice.slice(0, 600));

  const q = article;
  const encoded = encodeURIComponent(article);

  // Zigzag GraphQL guesses
  const zigzagQuery = `
    query GetSearchResult($query: String!) {
      search_result(query: $query) {
        products { catalog_product_id name }
      }
    }
  `;
  const zigzagBodies = [
    { query: zigzagQuery, variables: { query: q } },
    {
      operationName: "GetSearchResult",
      query: zigzagQuery,
      variables: { query: q, keyword: q },
    },
  ];
  for (const [i, body] of zigzagBodies.entries()) {
    const r = await get("https://api.zigzag.kr/api/2/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://zigzag.kr",
        Referer: `https://zigzag.kr/search?keyword=${encoded}`,
      },
      body: JSON.stringify(body),
    });
    console.log("zigzag", i, r.status, clip(r.text));
  }

  const brandiSetting = await get("https://www.brandi.co.kr/static/23.11.01/js/setting_variable.js");
  writeFileSync("scratch/next-malls/brandi-setting.js.txt", brandiSetting.text.slice(0, 30000));
  console.log("\nbrandi setting", brandiSetting.status, brandiSetting.text.length, clip(brandiSetting.text, 400));

  const brandiMain = await get("https://www.brandi.co.kr/static/23.11.01/js/main.9a5ba3df8d07e0b3f279.js");
  const tokenHits = [...brandiMain.text.matchAll(/capi\.|Authorization|guest|CM\s*=|search\/products[^"`']{0,60}/g)].slice(
    0,
    30
  );
  console.log("brandi main", brandiMain.status, brandiMain.text.length, tokenHits.map((m) => m[0]).slice(0, 20));
  const cm = brandiMain.text.match(/CM["']?\s*[:=]\s*["']([a-f0-9_]{20,})["']/i);
  const auth = brandiMain.text.match(/Authorization["']?\s*[:=]\s*["']([^"']{16,})["']/);
  console.log("brandi cm", cm?.[1]?.slice(0, 80), "auth", auth?.[1]?.slice(0, 80));

  const hiverToken =
    "3b17176f2eb5fdffb9bafdcc3e4bc192b013813caddccd0aad20c23ed272f076_1423639497";
  const brandiCapi = await get(
    `https://capi.brandi.co.kr/v1/web/search/products/${encoded}?offset=0&limit=20&version=2301&total-count=true&service-type=brandi`,
    {
      headers: {
        Origin: "https://www.brandi.co.kr",
        Referer: `https://www.brandi.co.kr/search?q=${encoded}`,
        Authorization: hiverToken,
        sid: hiverToken,
      },
    }
  );
  console.log("brandi capi+hiverToken", brandiCapi.status, clip(brandiCapi.text));

  const halfBody = new URLSearchParams({
    siteCd: "1",
    keyword: article,
    tmpKeyword: article,
    device: "pc",
    limit: "0,40",
    sortSeq: "12",
  });
  for (const [name, url, init] of [
    [
      "half-post-display",
      "https://hapix.halfclub.com/display/search",
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: halfBody.toString() },
    ],
    [
      "half-post-json",
      "https://hapix.halfclub.com/display/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://www.halfclub.com" },
        body: JSON.stringify({ siteCd: "1", keyword: article, limit: "0,40", sortSeq: "12", device: "001" }),
      },
    ],
    [
      "nsmall-mapi",
      `https://mapi.nsmall.com/search?searchTerm=${encoded}&pageNum=1&pageSize=20&busChnId=INT&deviceChnId=INTERNET`,
      { headers: { Origin: "https://www.nsmall.com", Referer: "https://www.nsmall.com/" } },
    ],
  ] as Array<[string, string, RequestInit]>) {
    try {
      const r = await get(url, init);
      console.log(name, r.status, clip(r.text));
    } catch (error) {
      console.log(name, "ERR", (error as Error).message.slice(0, 80));
    }
  }

  const nsmallIndex = readFileSync("scratch/next-malls/nsmall-search.js.txt", "utf8");
  // search call is `ke(gl.value)` imported as gf from index — grep index dump if present
  const indexHits = [...(await get("https://www.nsmall.com/assets/index-DQqlC40R.js")).text.matchAll(
    /mapi\.nsmall\.com[^"`']{0,80}|searchGoods|searchTerm[^"`']{0,40}|\/search\/[^"`']{0,50}/g
  )].map((m) => m[0]);
  console.log("nsmall index hits", [...new Set(indexHits)].slice(0, 30));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
