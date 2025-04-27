export function formatSats(amount: number): string {
  if (isNaN(amount) || amount <= 0) return "";
  if (amount < 1000) return amount.toString();
  if (amount < 1000000) return (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + "k";
  return (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + "M";
}
