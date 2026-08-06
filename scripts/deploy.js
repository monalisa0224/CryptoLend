const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

const COINGECKO_IDS = {
  ETH: "ethereum",
  BTC: "bitcoin",
  SOL: "solana"
};

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
  return Object.fromEntries(
    Object.entries(COINGECKO_IDS).map(([symbol, coingeckoId]) => {
      const price = Number(data[coingeckoId]?.usd);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Missing CoinGecko price for ${symbol}`);
      }
      return [symbol, priceToUsdtUnits(price)];
    })
  );
}

async function main() {
  const [deployer, borrower, ...demoUsers] = await hre.ethers.getSigners();
  const parseUsdt = (value) => hre.ethers.parseUnits(value, 6);
  const parseBtc = (value) => hre.ethers.parseUnits(value, 8);
  const parseSol = (value) => hre.ethers.parseUnits(value, 9);
  const assetId = (symbol) => hre.ethers.encodeBytes32String(symbol);

  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUsdt = await MockUSDT.deploy();
  await mockUsdt.waitForDeployment();

  const MockToken = await hre.ethers.getContractFactory("MockToken");
  const mockBtc = await MockToken.deploy("BTC", "BTC", 8);
  await mockBtc.waitForDeployment();
  const mockSol = await MockToken.deploy("Solana", "SOL", 9);
  await mockSol.waitForDeployment();

  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();

  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(await mockUsdt.getAddress(), await priceOracle.getAddress());
  await lendingPool.waitForDeployment();

  await (await mockUsdt.mint(deployer.address, parseUsdt("25000"))).wait();
  await (await mockBtc.mint(deployer.address, parseBtc("1"))).wait();
  await (await mockSol.mint(deployer.address, parseSol("100"))).wait();
  await (await mockUsdt.mint(borrower.address, parseUsdt("10000"))).wait();
  await (await mockBtc.mint(borrower.address, parseBtc("1"))).wait();
  await (await mockSol.mint(borrower.address, parseSol("100"))).wait();
  for (const demoUser of demoUsers.slice(0, 8)) {
    await (await mockUsdt.mint(demoUser.address, parseUsdt("10000"))).wait();
    await (await mockBtc.mint(demoUser.address, parseBtc("1"))).wait();
    await (await mockSol.mint(demoUser.address, parseSol("100"))).wait();
  }
  await (await mockUsdt.transfer(await lendingPool.getAddress(), parseUsdt("5000"))).wait();
  await (
    await deployer.sendTransaction({
      to: await lendingPool.getAddress(),
      value: hre.ethers.parseEther("1000")
    })
  ).wait();

  const oraclePrices = await fetchCoinGeckoPrices();
  await (
    await priceOracle.setPricesUsdt(
      [assetId("ETH"), assetId("BTC"), assetId("SOL")],
      [oraclePrices.ETH, oraclePrices.BTC, oraclePrices.SOL]
    )
  ).wait();

  await (await lendingPool.configureCollateralAsset(assetId("BTC"), await mockBtc.getAddress(), 8, 7000, 8500)).wait();
  await (await lendingPool.configureCollateralAsset(assetId("SOL"), await mockSol.getAddress(), 9, 6500, 8000)).wait();

  const deployment = {
    chainId: 31337,
    networkName: "Hardhat Local",
    deployer: deployer.address,
    demoBorrower: borrower.address,
    demoUsers: [borrower.address, ...demoUsers.slice(0, 8).map((signer) => signer.address)],
    mockUsdt: await mockUsdt.getAddress(),
    mockBtc: await mockBtc.getAddress(),
    mockSol: await mockSol.getAddress(),
    priceOracle: await priceOracle.getAddress(),
    lendingPool: await lendingPool.getAddress(),
    assets: [
      {
        id: "ETH",
        name: "ETH",
        symbol: "ETH",
        coingeckoId: "ethereum",
        type: "native",
        decimals: 18,
        ltvBps: 7000,
        liquidationThresholdBps: 8500
      },
      {
        id: "BTC",
        name: "BTC",
        symbol: "BTC",
        coingeckoId: "bitcoin",
        type: "erc20",
        address: await mockBtc.getAddress(),
        decimals: 8,
        ltvBps: 7000,
        liquidationThresholdBps: 8500
      },
      {
        id: "SOL",
        name: "Solana",
        symbol: "SOL",
        coingeckoId: "solana",
        type: "erc20",
        address: await mockSol.getAddress(),
        decimals: 9,
        ltvBps: 6500,
        liquidationThresholdBps: 8000
      }
    ],
    constants: {
      maxLtvBps: "7000",
      interestBps: "400",
      stakingApyBps: "350",
      usdtDecimals: 6
    }
  };

  const outputPath = path.join(__dirname, "..", "src", "lib", "deployment.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log("CryptoLend deployed");
  console.log(deployment);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
