import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchTopSourceOffers } from "@/lib/sourcing/source-offers";
import { mapWithConcurrency } from "@/lib/api/retry";

/**
 * 최근 검색 잡에 등장한 실제 품번으로 오퍼 확보율을 측정한다.
 * 몰 커버리지가 실제로 얼마나 부족한지 판단하는 데 쓴다.
 */
async function main() {
  const sampleSize = Number(process.argv[2] ?? 30);
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("search_job_items")
    .select("article_number, payload")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const articles = [
    ...new Set(
      (data ?? [])
        .map((row) => (row.article_number ?? (row.payload as any)?.articleNumber) as string | null)
        .filter((value): value is string => Boolean(value) && value !== "N/A")
    ),
  ].slice(0, sampleSize);

  console.log(`샘플 품번 ${articles.length}건 측정 중...\n`);

  const results = await mapWithConcurrency(articles, 3, async (article) => {
    const result = await fetchTopSourceOffers(article);
    return { article, count: result.offers.length, status: result.status };
  });

  const withOffers = results.filter((r) => r.count > 0);
  for (const r of results) {
    console.log(`  ${r.count > 0 ? "O" : "X"} ${r.article.padEnd(16)} ${r.count}건 (${r.status})`);
  }

  console.log(
    `\n오퍼 확보: ${withOffers.length}/${results.length} (${Math.round(
      (withOffers.length / Math.max(results.length, 1)) * 100
    )}%)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
