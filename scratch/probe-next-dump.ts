import { writeFileSync } from "fs";

const UA = "Mozilla/5.0";
const article = process.argv[2] || "JWJGX25211";
const encoded = encodeURIComponent(article);
const hiverToken =
  "3b17176f2eb5fdffb9bafdcc3e4bc192b013813caddccd0aad20c23ed272f076_1423639497";

async function get(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json,*/*", ...(init?.headers as Record<string, string>) },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    ...init,
  });
  return { status: res.status, text: await res.text() };
}

async function main() {
  const brandi = await get(
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
  writeFileSync("scratch/next-malls/brandi-capi.json", brandi.text.slice(0, 80000));
  const parsed = JSON.parse(brandi.text) as {
    meta?: { code?: number; count?: number };
    data?: { products?: unknown[]; total_count?: number };
  };
  console.log("brandi meta", parsed.meta);
  console.log("brandi data keys", parsed.data ? Object.keys(parsed.data) : null);
  const products = (parsed.data as { products?: Record<string, unknown>[] } | undefined)?.products ?? [];
  console.log("brandi products", products.length);
  if (products[0]) console.log("brandi sample", JSON.stringify(products[0]).slice(0, 500));

  const uniqlo = await get(
    "https://www.uniqlo.com/kr/api/commerce/v5/ko/products?q=T-shirt&offset=0&limit=3",
    { headers: { Origin: "https://www.uniqlo.com", Referer: "https://www.uniqlo.com/kr/ko/search?q=T-shirt" } }
  );
  writeFileSync("scratch/next-malls/uniqlo-sample.json", uniqlo.text.slice(0, 40000));
  const u = JSON.parse(uniqlo.text) as { result?: { items?: Record<string, unknown>[] } };
  const items = u.result?.items ?? (u.result as { products?: Record<string, unknown>[] } | undefined)?.products ?? [];
  console.log("uniqlo result keys", u.result ? Object.keys(u.result) : null);
  console.log("uniqlo items", items.length);
  if (items[0]) console.log("uniqlo sample keys", Object.keys(items[0]));

  // Zigzag: call with SearchResultInput
  const query = `query GetSearchResult($input: SearchResultInput!) {
    search_result(input: $input) {
      total_count
      has_next
      end_cursor
      searched_keyword
      item_list {
        ... on CatalogProduct {
          catalog_product_id
          name
          price
          image_url
          product_url
          shop_name
        }
      }
    }
  }`;
  const inputs = [
    { query: article, limit: 20 },
    { keyword: article, limit: 20 },
    { search_keyword: article, limit: 20 },
    { q: article },
  ];
  for (const input of inputs) {
    const r = await get("https://api.zigzag.kr/api/2/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://zigzag.kr",
        Referer: `https://zigzag.kr/search?keyword=${encoded}`,
      },
      body: JSON.stringify({ operationName: "GetSearchResult", query, variables: { input } }),
    });
    console.log("zigzag input", JSON.stringify(input), r.status, r.text.replace(/\s+/g, " ").slice(0, 280));
  }

  const nsmallPaths = [
    "https://mapi.nsmall.com/api/v1/search",
    "https://mapi.nsmall.com/api/search/goods",
    "https://mapi.nsmall.com/search/goods",
    "https://mapi.nsmall.com/goods/search",
    "https://www.nsmall.com/api/search",
    "https://www.nsmall.com/api/v1/search",
  ];
  for (const url of nsmallPaths) {
    try {
      const r = await get(`${url}?searchTerm=${encoded}&pageNum=1&pageSize=10&busChnId=INT`, {
        headers: { Origin: "https://www.nsmall.com", Referer: "https://www.nsmall.com/" },
      });
      if (r.status !== 404) console.log("nsmall", r.status, url, r.text.replace(/\s+/g, " ").slice(0, 160));
    } catch (error) {
      console.log("nsmall ERR", url, (error as Error).message.slice(0, 60));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
