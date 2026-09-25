/** Money is stored in integer cents everywhere; rates (volume cost) may be fractional. */

export function formatMoney(cents: number, symbol = '₱'): string {
  const value = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${value}`;
}

/** Parse a user-entered amount into integer cents. */
export function toCents(input: string | number): number {
  const value = typeof input === 'string' ? parseFloat(input.replace(/,/g, '')) : input;
  if (!isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

/** Cents -> plain numeric string for form inputs. */
export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Display cost for an item, accounting for volume rates (per 100 g/ml). */
export function displayCost(cost: number, soldBy: 'each' | 'volume', symbol = '₱'): string {
  if (soldBy === 'volume') {
    return `${formatMoney(cost * 100, symbol)}/100g·ml`;
  }
  return `${formatMoney(cost, symbol)}/pc`;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
