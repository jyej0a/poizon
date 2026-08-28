"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { enqueueBulkArticleJob } from "@/app/actions/search-jobs";
import { SearchJobsBoard } from "@/components/dashboard/search-jobs-board";
import {
  BulkExcelError,
  BULK_EXCEL_MAX_BYTES,
  parseBulkArticlesFromXlsx,
  type BulkExcelParseResult,
} from "@/lib/search/bulk-excel";
import { SEARCH_JOB_MAX_ITEMS } from "@/types/search-job";

export function BulkBoard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<BulkExcelParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const resetFile = () => {
    setFileName(null);
    setParsed(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (file: File) => {
    setError(null);
    setParsed(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setFileName(null);
      setError(".xlsx 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > BULK_EXCEL_MAX_BYTES) {
      setFileName(null);
      setError("파일이 8MB를 넘습니다. 나눠서 올려 주세요.");
      return;
    }

    setIsParsing(true);
    setFileName(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = parseBulkArticlesFromXlsx(bytes);
      setParsed(result);
    } catch (caught) {
      setParsed(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      setError(caught instanceof BulkExcelError ? caught.message : "엑셀을 읽지 못했습니다.");
    } finally {
      setIsParsing(false);
    }
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!parsed || parsed.articles.length === 0) {
      setError("엑셀을 먼저 올려 주세요.");
      return;
    }
    setIsEnqueuing(true);
    setError(null);
    try {
      const res = await enqueueBulkArticleJob({
        articles: parsed.articles,
        fileName: fileName ?? undefined,
      });
      if (!res.success) {
        setError(res.error ?? "대량 조회를 등록하지 못했습니다.");
        return;
      }
      setRefreshToken((n) => n + 1);
    } finally {
      setIsEnqueuing(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-2 w-full min-h-0">
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        className="glass-panel border border-secondary/40 rounded-xl p-5 shrink-0"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">대량 조회</h2>
            <p className="text-sm text-muted-foreground">
              실데이터 판매 엑셀을 올리면 「상품 번호」 품번만 모아, 검색과 같은 화면에서 최저가·원가·입찰을 합니다.
            </p>
          </div>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="rounded-lg border border-dashed border-border bg-background px-3 py-3"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={onPick}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-9 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-bold bg-secondary/60 hover:bg-secondary text-foreground motion-safe:active:scale-[0.98]"
            >
              {isParsing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              엑셀 선택
            </button>
            {fileName ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <span className="font-mono max-w-[220px] truncate">{fileName}</span>
                <button
                  type="button"
                  onClick={resetFile}
                  className="p-0.5 rounded hover:bg-secondary text-muted-foreground"
                  aria-label="선택한 파일 지우기"
                >
                  <X size={12} />
                </button>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">.xlsx · 여기로 끌어다 놓아도 됩니다</span>
            )}
            <button
              type="submit"
              disabled={isEnqueuing || isParsing || !parsed}
              className="h-9 ml-auto inline-flex items-center gap-1.5 rounded-lg px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 motion-safe:active:scale-[0.98]"
              aria-label="대량 조회 백그라운드 시작"
            >
              {isEnqueuing ? <Loader2 size={13} className="animate-spin" /> : null}
              백그라운드 시작
            </button>
          </div>
        </div>

        {parsed ? (
          <div className="mt-3">
            <p className="text-[11px] text-muted-foreground">
              {parsed.rowCount.toLocaleString("ko-KR")}행 → 품번{" "}
              <span className="font-bold text-foreground">
                {parsed.uniqueCount.toLocaleString("ko-KR")}개
              </span>
              {parsed.truncated
                ? ` (상한 ${SEARCH_JOB_MAX_ITEMS.toLocaleString("ko-KR")}개만 조회)`
                : ""}
              . 각 품번의 전체 옵션을 올립니다.
            </p>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground leading-relaxed">
              {parsed.articles.slice(0, 16).join(", ")}
              {parsed.articles.length > 16 ? ` 외 ${parsed.articles.length - 16}개` : ""}
            </p>
          </div>
        ) : error ? (
          <p className="mt-3 text-xs font-semibold text-destructive">{error}</p>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            행은 옵션(SKU) 단위여도 품번은 한 번만 조회합니다. 최대 {SEARCH_JOB_MAX_ITEMS.toLocaleString("ko-KR")}개.
          </p>
        )}
        {error && parsed ? (
          <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>
        ) : null}
      </form>

      <div className="flex-1 min-h-0">
        <SearchJobsBoard
          purpose="bulk"
          resultBasePath="/dashboard/bulk"
          title="대량 조회 작업"
          description="화면을 닫아도 워커가 품번을 조회합니다. 결과 보기는 새 탭에서 열리며, 입찰·검토까지 이어갑니다."
          emptyTitle="등록된 대량 조회가 없습니다."
          emptyHint="위에서 실데이터 판매 엑셀을 올리고 시작하세요."
          showPushBanner={false}
          refreshToken={refreshToken}
        />
      </div>
    </div>
  );
}
