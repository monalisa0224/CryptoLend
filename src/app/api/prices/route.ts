import { NextResponse } from "next/server";

const COINGECKO_IDS = ["ethereum", "bitcoin", "solana"] as const;

export async function GET() {
  const ids = COINGECKO_IDS.join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("CoinGecko unavailable");
    }

    const data = await response.json();
    const prices = Object.fromEntries(
      COINGECKO_IDS.map((id) => [id, Number(data[id]?.usd)])
    );

    if (Object.values(prices).some((price) => !Number.isFinite(price) || price <= 0)) {
      throw new Error("CoinGecko price data incomplete");
    }

    return NextResponse.json({
      source: "coingecko",
      prices
    });
  } catch {
    return NextResponse.json({
      source: "unavailable",
      prices: {}
    }, { status: 502 });
  }
}
