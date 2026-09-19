/** Live exchange rates from a free, keyless API — cached per base currency, degrading to 1:1 if unreachable. */

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();

async function fetchRates(base: string): Promise<Record<string, number>> {
  const cached = cache.get(base);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rates;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const json = await res.json();
    const rates = (json?.rates as Record<string, number>) ?? {};
    cache.set(base, { rates, fetchedAt: Date.now() });
    return rates;
  } catch (e) {
    if (__DEV__) console.warn('[exchangeRates] fetch failed, treating as 1:1', e);
    return {};
  }
}

export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const rates = await fetchRates(from);
  return rates[to] ?? 1;
}

export async function convert(amount: number, from: string, to: string): Promise<number> {
  if (from === to || !amount) return amount;
  const rate = await getRate(from, to);
  return amount * rate;
}
