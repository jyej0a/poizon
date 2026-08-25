/**
 * 수집 몰 파서 회귀 감시.
 *
 * 사용:
 *   pnpm check:offers
 *   pnpm check:offers -- CW2288-111 TLTCM26521
 *   pnpm check:offers -- --json
 *   pnpm check:offers -- --write-db          # .env.local 필요, source_malls 갱신
 *   pnpm check:offers -- --mall=nike,ssg
 *
 * exit 1: 한 몰이라도 `failed`(네트워크/파싱 오류) — 회귀로 간주
 * exit 0: 전부 ok 또는 empty (품번 미판매는 정상일 수 있음)
 */

import { mapWithConcurrency } from "@/lib/api/retry";
import {
  SOURCE_MALL_DEFINITIONS,
  getProviderByKey,
} from "@/lib/sourcing/registry";
import { probeSourceMall } from "@/lib/sourcing/source-malls";
import {
  matchesArticleNumber,
  normalizeArticleNumber,
} from "@/lib/sourcing/utils";
import type { SourceMallCheckStatus } from "@/types/source-mall";

const DEFAULT_ARTICLES = ["CW2288-111", "TLTCM26521"];

interface CliOptions {
  articles: string[];
  json: boolean;
  writeDb: boolean;
  mallKeys: string[] | null;
}

interface MallArticleResult {
  mall: string;
  label: string;
  article: string;
  status: SourceMallCheckStatus;
  message: string;
  offerCount: number;
  lowestPrice: number | null;
  elapsedMs: number;
  reliability: "ok" | "limited";
}

function parseArgs(argv: string[]): CliOptions {
  const articles: string[] = [];
  let json = false;
  let writeDb = false;
  let mallKeys: string[] | null = null;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--write-db") {
      writeDb = true;
      continue;
    }
    if (arg.startsWith("--mall=")) {
      mallKeys = arg
        .slice("--mall=".length)
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith("-")) {
      console.error(`알 수 없는 옵션: ${arg}`);
      process.exit(2);
    }
    articles.push(arg);
  }

  return {
    articles: articles.length > 0 ? articles : DEFAULT_ARTICLES,
    json,
    writeDb,
    mallKeys,
  };
}

async function probeWithoutDb(
  key: string,
  articleNumber: string
): Promise<Omit<MallArticleResult, "mall" | "label" | "reliability">> {
  const provider = getProviderByKey(key);
  if (!provider) {
    return {
      article: articleNumber,
      status: "failed",
      message: "파서 없음",
      offerCount: 0,
      lowestPrice: null,
      elapsedMs: 0,
    };
  }

  const normalized = normalizeArticleNumber(articleNumber);
  const started = Date.now();

  try {
    const result = await provider.fetchOffers(normalized);
    const matched = result.offers.filter(
      (offer) =>
        matchesArticleNumber(offer.title, normalized) ||
        matchesArticleNumber(offer.link, normalized)
    );
    const offerCount = matched.length;
    const lowestPrice =
      matched.length > 0 ? Math.min(...matched.map((offer) => offer.price)) : null;
    return {
      article: articleNumber,
      status: matched.length > 0 ? "ok" : "empty",
      message:
        matched.length > 0
          ? `${matched.length}건 · 최저 ₩${lowestPrice?.toLocaleString()}`
          : "품번 일치 오퍼 없음",
      offerCount,
      lowestPrice,
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    return {
      article: articleNumber,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
      offerCount: 0,
      lowestPrice: null,
      elapsedMs: Date.now() - started,
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const definitions = SOURCE_MALL_DEFINITIONS.filter((definition) =>
    options.mallKeys ? options.mallKeys.includes(definition.provider.key) : true
  );

  if (definitions.length === 0) {
    console.error("점검할 몰이 없습니다.");
    process.exit(2);
  }

  const jobs = definitions.flatMap((definition) =>
    options.articles.map((article) => ({ definition, article }))
  );

  const results = await mapWithConcurrency(jobs, 3, async ({ definition, article }) => {
    const base = {
      mall: definition.provider.key,
      label: definition.provider.label,
      reliability: definition.reliability,
    };

    if (options.writeDb) {
      try {
        const probed = await probeSourceMall(definition.provider.key, article);
        return {
          ...base,
          article,
          status: probed.status,
          message: probed.message,
          offerCount: probed.offerCount,
          lowestPrice: probed.lowestPrice,
          elapsedMs: probed.elapsedMs,
        } satisfies MallArticleResult;
      } catch (error) {
        const fallback = await probeWithoutDb(definition.provider.key, article);
        const dbError = error instanceof Error ? error.message : String(error);
        return {
          ...base,
          ...fallback,
          message: `${fallback.message} (DB 미기록: ${dbError})`,
        } satisfies MallArticleResult;
      }
    }

    const probed = await probeWithoutDb(definition.provider.key, article);
    return { ...base, ...probed } satisfies MallArticleResult;
  });

  const failed = results.filter((row) => row.status === "failed");
  const ok = results.filter((row) => row.status === "ok");
  const empty = results.filter((row) => row.status === "empty");

  // 몰별 요약: 한 품번이라도 ok면 healthy, 전부 empty면 empty, failed 포함이면 failed
  const byMall = new Map<string, MallArticleResult[]>();
  for (const row of results) {
    const list = byMall.get(row.mall) ?? [];
    list.push(row);
    byMall.set(row.mall, list);
  }

  const mallSummary = [...byMall.entries()].map(([mall, rows]) => {
    const hasFailed = rows.some((row) => row.status === "failed");
    const hasOk = rows.some((row) => row.status === "ok");
    const rollup: SourceMallCheckStatus = hasFailed ? "failed" : hasOk ? "ok" : "empty";
    return {
      mall,
      label: rows[0]?.label ?? mall,
      reliability: rows[0]?.reliability ?? "limited",
      rollup,
      rows,
    };
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          articles: options.articles,
          writeDb: options.writeDb,
          counts: { ok: ok.length, empty: empty.length, failed: failed.length },
          malls: mallSummary,
          results,
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `\n수집 몰 회귀 점검 — 품번 ${options.articles.length} · 몰 ${definitions.length} · 조합 ${results.length}`
    );
    if (options.writeDb) console.log("DB 기록: source_malls.last_check_* 갱신");

    for (const summary of mallSummary) {
      const mark =
        summary.rollup === "ok" ? "OK" : summary.rollup === "empty" ? "--" : "!!";
      console.log(
        `\n[${mark}] ${summary.label} (${summary.mall}) · ${summary.reliability}`
      );
      for (const row of summary.rows) {
        console.log(
          `  ${row.status.padEnd(6)} ${row.article.padEnd(14)} ${row.message} (${row.elapsedMs}ms)`
        );
      }
    }

    console.log(
      `\n합계 ok=${ok.length} empty=${empty.length} failed=${failed.length}`
    );
    if (failed.length > 0) {
      console.log("실패 몰:", [...new Set(failed.map((row) => row.mall))].join(", "));
    }
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
