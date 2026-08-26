"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useSearchJobPush } from "@/hooks/use-search-job-push";

export function SearchJobPushBanner() {
  const { state, busy, message, enable, disable, sendTest } = useSearchJobPush();

  if (state === "loading" || state === "unsupported") return null;

  if (state === "unconfigured") {
    return (
      <div className="bg-secondary/30 border border-secondary/40 text-muted-foreground rounded-xl px-4 py-3 text-sm">
        <p className="font-bold text-foreground">완료 알림을 쓰려면 VAPID 키가 필요합니다.</p>
        <p className="text-[13px] mt-1 leading-relaxed">
          <code className="font-mono font-bold">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>와{" "}
          <code className="font-mono font-bold">VAPID_PRIVATE_KEY</code>를 설정한 뒤 개발 서버와 워커를
          다시 켜세요.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="bg-secondary/30 border border-secondary/40 text-muted-foreground rounded-xl px-4 py-3 text-sm">
        <p className="font-bold text-foreground">브라우저가 알림을 차단했습니다.</p>
        <p className="text-[13px] mt-1 leading-relaxed">
          사이트 설정에서 알림을 허용하면 화면을 닫아 둔 채 검색 완료·가격 도달을 받을 수 있습니다.
        </p>
      </div>
    );
  }

  if (state === "subscribed") {
    return (
      <div className="bg-emerald-500/8 border border-emerald-500/20 text-emerald-900 rounded-xl px-4 py-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <Bell size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">검색 완료와 가격 도달을 이 브라우저로 보냅니다.</p>
            <p className="text-[13px] mt-0.5 leading-relaxed text-emerald-900/75">
              탭을 닫아 두어도 잡 종료·가격 워치 도달이 도착합니다. iOS는 홈 화면에 추가한 뒤에만 동작합니다.
            </p>
            {message && <p className="text-[13px] mt-1">{message}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={busy}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600/10 hover:bg-emerald-600/15 text-emerald-800 disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : "테스트"}
          </button>
          <button
            type="button"
            onClick={() => void disable()}
            disabled={busy}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-secondary/50 hover:bg-secondary text-foreground/70 disabled:opacity-50"
          >
            끄기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sky-500/8 border border-sky-500/25 text-sky-950 rounded-xl px-4 py-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-2">
        <BellOff size={16} className="mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-bold">화면을 닫아 둬도 검색 완료·가격 도달 알림을 받을 수 있습니다.</p>
          <p className="text-[13px] mt-0.5 leading-relaxed text-sky-950/75">
            이 브라우저에서 알림을 허용하세요. 가격 워치는 워커가 약 5분마다 노출가를 확인합니다.
          </p>
          {message && <p className="text-[13px] mt-1 text-sky-900">{message}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void enable()}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-sky-600 text-white hover:bg-sky-600/90 disabled:opacity-50 shrink-0"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
        알림 허용
      </button>
    </div>
  );
}
