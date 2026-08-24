import { lotteOnProvider } from "../lib/sourcing/providers/lotteon";
import { extractJsonObjectsContainingKey, normalizeArticleNumber } from "../lib/sourcing/utils";

async function dump(article: string) {
  const normalized = normalizeArticleNumber(article);
  const url = `https://www.lotteon.com/search/search/search.ecn?render=search&platform=pc&q=${encodeURIComponent(normalized)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  const html = await res.text();
  const products = extractJsonObjectsContainingKey<Record<string, unknown>>(html, "priceInfo");
  console.log("\n===", article, "products", products.length);
  for (const p of products.slice(0, 5)) {
    const keys = Object.keys(p);
    console.log("keys", keys.join(","));
    console.log(JSON.stringify(p).slice(0, 500));
  }
}

async function main() {
  for (const a of ["CW2288-111", "DQ8576-100", "TLTCM26521"]) {
    await dump(a);
  }
  // sanity via provider
  const r = await lotteOnProvider.fetchOffers("CW2288-111");
  console.log("provider offers", r.offers.length);
}

main().catch(console.error);
