/**
 * 실데이터 판매 엑셀에서 품번(상품 번호)만 뽑는다.
 * 행은 SKU(옵션) 단위이므로 같은 품번이 반복된다. 조회는 유니크 품번.
 */

import { strFromU8, unzipSync } from "fflate";
import { SEARCH_JOB_MAX_ITEMS } from "@/types/search-job";

const ARTICLE_HEADERS = new Set(
  ["상품 번호", "품번", "货号", "商品货号", "商品编号", "article number", "articlenumber", "article_number"].map(
    normalizeHeader
  )
);

/** 엑셀 셀 값 끝의 한자(鞋 등) — 실데이터 품번에 붙는 분류 접미 */
const TRAILING_HAN = /[\u3400-\u9fff\uf900-\ufaff]+$/u;

export const BULK_EXCEL_MAX_BYTES = 8 * 1024 * 1024;

export interface BulkExcelParseResult {
  articles: string[];
  rowCount: number;
  uniqueCount: number;
  truncated: boolean;
}

export class BulkExcelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkExcelError";
  }
}

export function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeArticleNumber(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** 실데이터 품번 끝에 붙는 한자(鞋 등). 원문이 안 맞으면 워커가 이 형태로 재시도한다. */
export function stripTrailingHan(article: string): string {
  return article.replace(TRAILING_HAN, "").trim();
}

export function normalizeBulkArticles(
  values: string[],
  maxItems = SEARCH_JOB_MAX_ITEMS
): { articles: string[]; truncated: boolean } {
  const seen = new Set<string>();
  const articles: string[] = [];
  for (const value of values) {
    const article = normalizeArticleNumber(value);
    if (!article) continue;
    const key = article.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    articles.push(article);
    if (articles.length >= maxItems) {
      return { articles, truncated: true };
    }
  }
  return { articles, truncated: false };
}

export function parseBulkArticlesFromXlsx(
  bytes: Uint8Array,
  maxItems = SEARCH_JOB_MAX_ITEMS
): BulkExcelParseResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new BulkExcelError("엑셀 파일을 열 수 없습니다. .xlsx 형식인지 확인해 주세요.");
  }

  const lookup = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(files)) {
    lookup.set(name.replace(/^\//, "").toLowerCase(), data);
  }

  const readXml = (path: string): string | null => {
    const data = lookup.get(path.replace(/^\//, "").toLowerCase());
    if (!data) return null;
    return strFromU8(data);
  };

  const workbookXml = readXml("xl/workbook.xml");
  if (!workbookXml) {
    throw new BulkExcelError("엑셀 통합 문서를 읽지 못했습니다.");
  }

  const relsXml = readXml("xl/_rels/workbook.xml.rels") ?? "";
  const ridToTarget = new Map<string, string>();
  for (const match of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/gi)) {
    ridToTarget.set(match[1], match[2].replace(/^\//, ""));
  }
  for (const match of relsXml.matchAll(/Target="([^"]+)"[^>]*Id="([^"]+)"/gi)) {
    if (!ridToTarget.has(match[2])) ridToTarget.set(match[2], match[1].replace(/^\//, ""));
  }

  const sheetMatch = workbookXml.match(
    /<sheet\b[^>]*?(?:r:id|r:Id)="([^"]+)"[^>]*\/?>|<sheet\b[^>]*?(?:r:id|r:Id)="([^"]+)"[^>]*>/i
  );
  const sheetRid = sheetMatch?.[1] ?? sheetMatch?.[2];
  const sheetTarget = sheetRid ? ridToTarget.get(sheetRid) : null;
  const sheetPath = sheetTarget
    ? (sheetTarget.startsWith("xl/") ? sheetTarget : `xl/${sheetTarget.replace(/^\.\.\//, "")}`)
    : "xl/worksheets/sheet1.xml";

  const sheetXml = readXml(sheetPath) ?? readXml("xl/worksheets/sheet1.xml");
  if (!sheetXml) {
    throw new BulkExcelError("첫 시트를 읽지 못했습니다.");
  }

  const sharedXml = readXml("xl/sharedStrings.xml");
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];

  const rows = parseSheetRows(sheetXml, shared);
  if (rows.length === 0) {
    throw new BulkExcelError("시트가 비어 있습니다.");
  }

  let headerRowIndex = -1;
  let articleCol = -1;
  const scanLimit = Math.min(rows.length, 15);
  for (let i = 0; i < scanLimit; i += 1) {
    const col = findArticleColumn(rows[i] ?? []);
    if (col >= 0) {
      headerRowIndex = i;
      articleCol = col;
      break;
    }
  }

  if (headerRowIndex < 0 || articleCol < 0) {
    const headers = (rows[0] ?? []).filter(Boolean).slice(0, 8).join(", ");
    throw new BulkExcelError(
      headers
        ? `「상품 번호」 열을 찾지 못했습니다. 첫 행: ${headers}`
        : "「상품 번호」 열을 찾지 못했습니다."
    );
  }

  const rawArticles: string[] = [];
  let rowCount = 0;
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i] ?? [];
    const hasAny = cells.some((cell) => cell.trim().length > 0);
    if (!hasAny) continue;
    rowCount += 1;
    rawArticles.push(cells[articleCol] ?? "");
  }

  const { articles, truncated } = normalizeBulkArticles(rawArticles, maxItems);
  if (articles.length === 0) {
    throw new BulkExcelError("상품 번호 열에 품번이 없습니다.");
  }

  return {
    articles,
    rowCount,
    uniqueCount: articles.length,
    truncated,
  };
}

function findArticleColumn(cells: string[]): number {
  return cells.findIndex((cell) => ARTICLE_HEADERS.has(normalizeHeader(cell)));
}

function parseSharedStrings(xml: string): string[] {
  const items: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;
  while ((match = siRe.exec(xml))) {
    items.push(collectText(match[1]));
  }
  return items;
}

function parseSheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1] ?? cellMatch[3] ?? "";
      const inner = cellMatch[2] ?? "";
      const ref = attr(attrs, "r");
      const type = attr(attrs, "t");
      const col = ref ? columnIndex(ref) : cells.length;
      if (col < 0) continue;
      while (cells.length <= col) cells.push("");
      cells[col] = cellValue(type, inner, shared);
    }
    rows.push(cells);
  }
  return rows;
}

function cellValue(type: string | null, inner: string, shared: string[]): string {
  if (type === "s") {
    const index = Number(tagText(inner, "v"));
    return Number.isFinite(index) ? (shared[index] ?? "") : "";
  }
  if (type === "inlineStr") {
    return collectText(inner);
  }
  const raw = tagText(inner, "v") || (type === "str" ? collectText(inner) : "");
  return raw;
}

function collectText(xml: string): string {
  const parts: string[] = [];
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
  let match: RegExpExecArray | null;
  while ((match = tRe.exec(xml))) {
    parts.push(decodeXml(match[1]));
  }
  return parts.join("");
}

function tagText(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function attr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i"));
  return match?.[1] ?? null;
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^([A-Z]+)/i)?.[1]?.toUpperCase();
  if (!letters) return -1;
  let n = 0;
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
