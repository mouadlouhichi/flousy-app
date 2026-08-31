export function formatMoney(amount: number, digits = 2): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
