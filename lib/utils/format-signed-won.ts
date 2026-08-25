/** 수익/손실 화면 표기. 색각 보조로 삼각형과 부호를 같이 쓴다. */
export function formatSignedWon(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded).toLocaleString();
  if (rounded > 0) return `▲ +₩${abs}`;
  if (rounded < 0) return `▼ -₩${abs}`;
  return "₩0";
}
