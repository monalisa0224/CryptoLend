const hre = require("hardhat");
const deployment = require("../src/lib/deployment.json");

const COINGECKO_IDS = {
  ETH: "ethereum",
  BTC: "bitcoin",
  SOL: "solana"
};

function assetId(symbol) {
  return hre.ethers.encodeBytes32String(symbol);
}

function priceToUsdtUnits(price) {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid CoinGecko price: ${price}`);
  }
  return BigInt(Math.round(price * 1_000_000));
}

async function fetchCoinGeckoPrices() {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const response = await fetch(url, { headers: { accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`CoinGecko request failed with status ${response.status}`);
  }

  const data = await response.json();
  return Object.entries(COINGECKO_IDS).map(([symbol, coingeckoId]) => {
    const price = Number(data[coingeckoId]?.usd);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Missing CoinGecko price for ${symbol}`);
    }
    return { symbol, priceUsdt: priceToUsdtUnits(price) };
  });
}

async function main() {
  if (!deployment.priceOracle) {
    throw new Error("Missing priceOracle in deployment.json. Redeploy contracts first.");
  }

  const [owner] = await hre.ethers.getSigners();
  const oracle = await hre.ethers.getContractAt("PriceOracle", deployment.priceOracle, owner);
  const prices = await fetchCoinGeckoPrices();

  await (
    await oracle.setPricesUsdt(
      prices.map((price) => assetId(price.symbol)),
      prices.map((price) => price.priceUsdt)
    )
  ).wait();

  console.log("Oracle prices updated from CoinGecko");
  for (const price of prices) {
    console.log(`${price.symbol}: ${hre.ethers.formatUnits(price.priceUsdt, 6)} USDT`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
