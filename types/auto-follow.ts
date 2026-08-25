export const FOLLOW_TYPES: { value: number; label: string }[] = [
  { value: 3, label: "최저가 추종" },
  { value: 4, label: "최저가보다 낮게" },
  { value: 5, label: "최저가보다 높게" },
  { value: 6, label: "최저가 유지" },
];

export interface AutoFollowRule {
  sellerBiddingNo: string;
  skuId: number;
  lowestPrice: number;
  followType: number;
  autoSwitch: boolean;
}

export function parseAutoFollowList(response: unknown): AutoFollowRule[] {
  const root = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const list = data.list ?? data.contents ?? data.records ?? root.list;
  if (!Array.isArray(list)) return [];
  return list.map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      sellerBiddingNo: String(item.sellerBiddingNo ?? item.biddingNo ?? ""),
      skuId: Number(item.skuId) || 0,
      lowestPrice: Number(item.lowestPrice ?? item.minPrice) || 0,
      followType: Number(item.followType) || 3,
      autoSwitch: Boolean(item.autoSwitch ?? true),
    };
  });
}
