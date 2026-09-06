import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Exchange-rate proxy for the converter widget (MAD ⇄ EUR/USD/… for the
 * diaspora). Uses the free, keyless Frankfurter API (ECB reference rates,
 * MAD included), cached for 12 hours at the edge/CDN. Only currency codes the
 * app supports are accepted so the route cannot be used as an open proxy.
 */
const ALLOWED = new Set(['MAD', 'EUR', 'USD', 'GBP', 'CAD', 'CHF', 'AED', 'SAR', 'EGP', 'TND', 'DZD', 'XOF']);
// Frankfurter (ECB) lacks a few regional currencies; fall back to open.er-api.
const PRIMARY = 'https://api.frankfurter.app/latest';
const FALLBACK = 'https://open.er-api.com/v6/latest';

export async function GET(request: NextRequest) {
  const base = (request.nextUrl.searchParams.get('base') || 'MAD').toUpperCase();
  if (!ALLOWED.has(base)) {
    return NextResponse.json({ error: 'unsupported' }, { status: 400 });
  }
  const symbols = Array.from(ALLOWED).filter((c) => c !== base);
  const headers = { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' };
  try {
    const res = await fetch(`${PRIMARY}?from=${base}&to=${symbols.join(',')}`, { next: { revalidate: 43200 } });
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number>; date?: string };
      if (data.rates && Object.keys(data.rates).length >= 3) {
        return NextResponse.json({ base, date: data.date, rates: data.rates, source: 'ecb' }, { headers });
      }
    }
  } catch { /* try fallback */ }
  try {
    const res = await fetch(`${FALLBACK}/${base}`, { next: { revalidate: 43200 } });
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
      const rates: Record<string, number> = {};
      for (const code of symbols) if (data.rates?.[code]) rates[code] = data.rates[code];
      return NextResponse.json({ base, date: data.time_last_update_utc?.slice(0, 16) || null, rates, source: 'er-api' }, { headers });
    }
  } catch { /* fall through */ }
  return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
