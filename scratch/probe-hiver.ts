const UA = "Mozilla/5.0";
const article = process.argv[2] || "CW2288-111";

async function tryUrl(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  console.log(res.status, url.replace("https://hiver-api.brandi.biz", ""), text.slice(0, 240).replace(/\n/g, " "));
}

async function main() {
  const base = "https://hiver-api.brandi.biz/v1/web/products";
  for (const q of [
    `?query=${article}`,
    `?q=${article}`,
    `?keyword=${article}`,
    `?search=${article}`,
    `?query=${article}&offset=0&limit=40`,
    `?query=${article}&page=1&size=40`,
    `?type=search&keyword=${article}`,
    `?search_type=product&keyword=${article}`,
  ]) {
    await tryUrl(base + q);
  }

  // error said query::type — try nested-style params
  for (const q of [
    `?query[type]=search&query[keyword]=${article}`,
    `?query.type=search&query.keyword=${article}`,
    `?query[keyword]=${article}`,
    `?queries[0][type]=search&queries[0][keyword]=${article}`,
  ]) {
    await tryUrl(base + q);
  }

  const chunkUrls = [
    "https://www.hiver.co.kr/_next/static/chunks/5863-3af0e1a571788f9d.js",
    "https://www.hiver.co.kr/_next/static/chunks/7720-deab693b175f039b.js",
    "https://www.hiver.co.kr/_next/static/chunks/310-7daae689164d0054.js",
    "https://www.hiver.co.kr/_next/static/chunks/pages/search-05dbf23f4c146539.js",
  ];

  for (const u of chunkUrls) {
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    const t = await r.text();
    const hits: string[] = [];
    const re = /hiver-api[^\s"'`]{0,100}|web\/products[^\s"'`]{0,80}|\/v1\/[^\s"'`]{5,80}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) hits.push(m[0]);
    console.log("\n", u.split("/").pop(), [...new Set(hits)].slice(0, 40));
  }
}

main().catch(console.error);
