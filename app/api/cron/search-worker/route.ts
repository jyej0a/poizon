import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { runWorkerTick } from "@/lib/search/worker-run";

/**
 * 검색 잡 워커 크론 엔드포인트.
 *
 * Vercel Cron / 외부 스케줄러가 주기적으로 호출한다.
 * 호출당 대기/`running`(잠금 없음) 잡 1건을 claim하고 브랜드 1페이지를 처리한다.
 *
 * 인증: `Authorization: Bearer $CRON_SECRET`
 * (Vercel Cron은 자동으로 이 헤더를 붙인다 — 프로젝트에 CRON_SECRET 설정 필요)
 *
 * 장시간 잡은 로컬 `pnpm worker`를 권장. 서버리스는 maxDuration 안에서만 완료된다.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 미설정 시 배포 사고를 막기 위해 거부
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `cron-${randomUUID().slice(0, 8)}`;
  const supabase = getServiceRoleClient();

  try {
    const result = await runWorkerTick(supabase, workerId);
    return NextResponse.json({
      ok: true,
      workerId,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/search-worker]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
