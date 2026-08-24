import { fetchTopSourceOffers } from "@/lib/sourcing/source-offers";

async function main() {
  const articles = process.argv.slice(2);

  for (const article of articles) {
    const result = await fetchTopSourceOffers(article);
    console.log(`\n=== ${article} | status=${result.status} | offers=${result.offers.length}`);
    if (result.warnings.length > 0) console.log("  warnings:", result.warnings);
    for (const offer of result.offers) {
      console.log(
        `  ${String(offer.price).padStart(8)} ${offer.sourceLabel.padEnd(5)} ${offer.title.slice(0, 52)}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
