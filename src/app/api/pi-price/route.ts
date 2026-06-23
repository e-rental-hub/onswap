import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory server-side cache (survives across requests in same instance)
let serverCache: { data: unknown; ts: number; currency: string } | null = null;
const SERVER_TTL = 90_000; // 90s — CMC free tier allows ~333 calls/day

// app/api/pi-price/route.ts  (updated)
const GECKO_COIN_ID = 'pi-network';

export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get('currency')?.toLowerCase() ?? 'usd';

  if (serverCache && serverCache.currency === currency && Date.now() - serverCache.ts < SERVER_TTL) {
    return NextResponse.json(serverCache.data);
  }

  try {
    //Coingecko supported currencies ngn,kes,etb,ghs,ugx,tzs,rwf,cdf,zmw,usd,cdf,zar,egp,mad
    const url = `https://api.coingecko.com/api/v3/simple/price` +
      `?ids=${GECKO_COIN_ID}&vs_currencies=${currency},ngn,kes,usd&include_24hr_change=true`;

    // No API key needed for public tier — add header only if you have a Demo key
    // const headers: Record<string, string> = {};
    // if (process.env.COINGECKO_API_KEY) {
    //   headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
    // }

    const res = await fetch(url, { next: { revalidate: 90 } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);

    const json = await res.json();
    const coin = json[GECKO_COIN_ID];

    const data = {
      usdPrice:  coin['usd']                    ?? 0,
      ngnPrice:   coin['ngn']                     ?? 0,
      kesPrice:   coin['kes']                     ?? 0,
      fiatPrice: coin[currency]                 ?? 0,
      change24h: coin[`${currency}_24h_change`] ?? coin['usd_24h_change'] ?? 0,
      volume24h: 0, // not in /simple/price — use /coins/pi-network if needed
      currency:  currency.toUpperCase(),
      source:    'coingecko',
    };

    serverCache = { data, ts: Date.now(), currency };
    return NextResponse.json(data);
  } catch (err) {
    // console.error('[pi-price] CoinGecko error:', err);
    return NextResponse.json(buildFallback(currency.toUpperCase()), { status: 200 });
  }
}

function buildFallback(currency: string) {
  
  return {
    usdPrice: 0.00,
    ngnPrice: 0.00,
    kesPrice: 0.00,
    fiatPrice: 0.00,
    change24h: 0,
    volume24h: 0,
    currency,
    source: 'fallback',
  };
}