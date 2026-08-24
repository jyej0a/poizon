const UA = "Mozilla/5.0";
const article = process.argv[2] || "CW2288-111";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  console.log(res.status, JSON.stringify(body).slice(0, 120), text.slice(0, 280).replace(/\n/g, " "));
}

async function main() {
  const url = "https://hiver-api.brandi.biz/v1/web/products";
  const bodies = [
    { query: { type: "search", keyword: article } },
    { query: { type: "keyword", keyword: article } },
    { query: { type: "product_search", keyword: article } },
    { type: "search", keyword: article },
    { query: article },
    { keyword: article, query: { type: "search" } },
    { query: { type: "search", text: article } },
    { query: { type: "search", q: article } },
    { query: { type: "search", search_keyword: article } },
    { query: { type: "search", name: article } },
    {
      query: { type: "search", keyword: article },
      offset: 0,
      limit: 40,
    },
    {
      query: { type: "search", keyword: article },
      page: 1,
      size: 40,
    },
  ];

  for (const body of bodies) {
    await post(url, body);
  }

  // Also try GET with encoded JSON query param
  const encoded = encodeURIComponent(JSON.stringify({ type: "search", keyword: article }));
  for (const u of [
    `${url}?query=${encoded}`,
    `https://hiver-api.brandi.biz/v1/web/search/products?query=${encoded}`,
    `https://hiver-api.brandi.biz/v1/search/products?query=${encoded}`,
  ]) {
    const res = await fetch(u, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    console.log("GET", res.status, u.slice(40, 100), text.slice(0, 220).replace(/\n/g, " "));
  }
}

main().catch(console.error);
