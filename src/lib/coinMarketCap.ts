import { NextRequest, NextResponse } from 'next/server';

// CoinMarketCap Pi Network coin ID: 29130 (verify at api.coinmarketcap.com)
const PI_CMC_ID = 29130;
const CMC_KEY   = process.env.COIN_MARKET_CAP_API_KEY ?? '';

// Simple in-memory server-side cache (survives across requests in same instance)
let serverCache: { data: unknown; ts: number; currency: string } | null = null;
const SERVER_TTL = 90_000; // 90s — CMC free tier allows ~333 calls/day

export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get('currency') ?? 'USD';

  // Return cached if fresh and same currency
  if (serverCache && serverCache.currency === currency && Date.now() - serverCache.ts < SERVER_TTL) {
    return NextResponse.json(serverCache.data);
  }

  if (!CMC_KEY) {
    // Return a reasonable fallback when no key is configured
    return NextResponse.json(buildFallback(currency), { status: 200 });
  }

  try {
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest` +
      `?id=${PI_CMC_ID}&convert=${currency}`;

    const res = await fetch(url, {
      headers: { 'X-CMC_PRO_API_KEY': CMC_KEY },
      next: { revalidate: 90 },
    });

    if (!res.ok) throw new Error(`CMC ${res.status}`);

    const json = await res.json();
    const quote = json?.data?.[PI_CMC_ID]?.quote;
    if (!quote) throw new Error('Unexpected CMC shape');

    const fiatQ  = quote[currency];
    const usdQ   = quote['USD'] ?? fiatQ;

    const data = {
      usdPrice:  usdQ?.price     ?? 0,
      fiatPrice: fiatQ?.price    ?? 0,
      change24h: fiatQ?.percent_change_24h ?? 0,
      volume24h: fiatQ?.volume_24h ?? 0,
      currency,
      source:    'cmc',
    };

    serverCache = { data, ts: Date.now(), currency };
    return NextResponse.json(data);
  } catch (err) {
    console.error('[pi-price] CMC error:', err);
    const fallback = buildFallback(currency);
    return NextResponse.json(fallback, { status: 200 });
  }
}

function buildFallback(currency: string) {
  const USD_RATES: Record<string, number> = {
    NGN: 1610, KES: 130, GHS: 15.7, ZAR: 18.5, USD: 1,
  };
  const usdPrice  = 0.70; // reasonable Pi estimate
  const fiatPrice = usdPrice * (USD_RATES[currency] ?? 1);
  return {
    usdPrice,
    fiatPrice,
    change24h: 0,
    volume24h: 0,
    currency,
    source: 'fallback',
  };
}