const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `yyyy-MM-dd HH:mm` (로컬 시간대). 유효하지 않은 값은 "-"로 표기한다.
 */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
