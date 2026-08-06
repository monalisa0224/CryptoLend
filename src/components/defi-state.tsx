"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  encodeBytes32String,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "ethers";
import { DEPLOYMENT, LENDING_POOL_ABI, MOCK_USDT_ABI, hasDeployment } from "@/lib/contracts";

export type AssetKind = "native" | "erc20";

export type Asset = {
  id: string;
  name: string;
  symbol: string;
  coingeckoId: string;
  type: AssetKind;
  address?: string;
  decimals: number;
  ltvBps: number;
  liquidationThresholdBps: number;
};

export type BorrowHistory = {
  id: number;
  walletAddress: string;
  collateralSymbol?: string;
  collateralAmount: string;
  borrowAmount: string;
  txHash: string;
  createdAt: string;
};

export type StakingHistory = {
  id: number;
  walletAddress: string;
  action: string;
  amount: string;
  rewardAmount: string;
  txHash: string;
  createdAt: string;
};

export type RepayHistory = {
  id: number;
  walletAddress: string;
  amount: string;
  interestPaid: string;
  principalPaid: string;
  txHash: string;
  createdAt: string;
};

type Position = {
  collateral: string;
  borrowed: string;
  accruedInterest: string;
  totalDebt: string;
  staked: string;
  pendingReward: string;
};

type DefiContextType = {
  account: string;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean | ((v: boolean) => boolean)) => void;
  status: string;
  error: string;
  isShaking: boolean;
  isMessageClosing: boolean;
  isBusy: boolean;
  deploymentReady: boolean;
  isTreasury: boolean;
  connectWallet: () => Promise<void>;
  mintMockTokens: () => Promise<void>;
  disconnectWallet: () => void;
  assets: Asset[];
  setAssetLiquidationThreshold: (assetId: string, thresholdPercent: string) => Promise<void>;
  visibleAssets: Asset[];
  selectedAsset: Asset;
  setSelectedAssetId: (v: string) => void;
  selectedBalance: string;
  selectedAllowance: string;
  selectedLivePrice: number;
  prices: Record<string, number>;
  priceSource: string;
  assetSearch: string;
  setAssetSearch: (v: string) => void;
  collateralAmount: string;
  setCollateralAmount: (v: string) => void;
  borrowAmount: string;
  setBorrowAmount: (v: string) => void;
  repayAmount: string;
  setRepayAmount: (v: string) => void;
  stakeAmount: string;
  setStakeAmount: (v: string) => void;
  unstakeAmount: string;
  setUnstakeAmount: (v: string) => void;
  liquidityAmount: string;
  setLiquidityAmount: (v: string) => void;
  collateralValue: number;
  liveCollateralValue: number;
  maxBorrow: number;
  safeMaxBorrow: number;
  healthFactor: number;
  dailyReward: number;
  yearlyReward: number;
  portfolioValue: number;
  usdtBalance: string;
  usdtAllowance: string;
  poolLiquidity: string;
  poolCollateral: string;
  totalBorrowed: string;
  totalStaked: string;
  protocolStatus: string;
  protocolReserveUsdt: string;
  minReserveUsdt: string;
  minLiquidityBufferBps: string;
  companyTreasury: { staked: string; interest: string; reserve: string };
  stakingApyBps: string;
  reserveFactorBps: string;
  borrowApyBps: string;
  tokenCollateral: Record<string, string>;
  position: Position;
  borrowHistory: BorrowHistory[];
  repayHistory: RepayHistory[];
  stakingHistory: StakingHistory[];
  needsCollateralApproval: boolean;
  needsRepayApproval: boolean;
  needsFullRepayApproval: boolean;
  needsStakeApproval: boolean;
  approveCollateral: () => Promise<void>;
  borrow: () => Promise<void>;
  approveRepay: () => Promise<void>;
  repayPosition: (amount: string) => Promise<void>;
  repayLoan: () => Promise<void>;
  repayFullLoan: () => Promise<void>;
  withdrawCollateral: () => Promise<void>;
  approveStake: (amount?: string) => Promise<void>;
  stake: (amount?: string) => Promise<void>;
  claimRewards: () => Promise<void>;
  unstake: (amount?: string) => Promise<void>;
  approveLiquidity: (amount?: string) => Promise<void>;
  addLiquidity: (amount?: string) => Promise<void>;
  withdrawReserve: (amount: string) => Promise<void>;
};

const DefiContext = createContext<DefiContextType | null>(null);

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_HEX = "0x7a69";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const STAKING_APY = 12;
const GAS_BUFFER_ETH = 0.01;
const SAFE_MAX_BORROW_BPS = 9950;
const FULL_REPAY_TOLERANCE_USDT = 0.01;
const TEMP_LIQUIDATION_THRESHOLDS_BPS: Record<string, number> = {
  ETH: 8500,
  BTC: 8500,
  SOL: 8000,
};

const DEFAULT_ASSETS: Asset[] = [
  { id: "ETH", name: "ETH", symbol: "ETH", coingeckoId: "ethereum", type: "native", decimals: 18, ltvBps: 7000, liquidationThresholdBps: TEMP_LIQUIDATION_THRESHOLDS_BPS.ETH },
  { id: "BTC", name: "BTC", symbol: "BTC", coingeckoId: "bitcoin", type: "erc20", decimals: 8, ltvBps: 7000, liquidationThresholdBps: TEMP_LIQUIDATION_THRESHOLDS_BPS.BTC },
  { id: "SOL", name: "Solana", symbol: "SOL", coingeckoId: "solana", type: "erc20", decimals: 9, ltvBps: 6500, liquidationThresholdBps: TEMP_LIQUIDATION_THRESHOLDS_BPS.SOL },
];

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPositiveDecimal(value: string) {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d*\.\d+)$/.test(trimmed)) return false;
  return Number(trimmed) > 0;
}

function decimalPlaces(value: string) {
  return value.includes(".") ? value.split(".")[1]?.length || 0 : 0;
}

function assetKey(assetId: string) {
  return encodeBytes32String(assetId);
}

export function playClickSound() {
  if (typeof window === "undefined") return;
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtor = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioCtor) return;
  try {
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
    window.setTimeout(() => context.close().catch(() => undefined), 140);
  } catch {
    // Ignore browser audio restrictions.
  }
}

const deploymentAssets = (DEPLOYMENT as unknown as { assets?: Asset[] }).assets;
const SUPPORTED_ASSETS = (deploymentAssets?.length ? deploymentAssets : DEFAULT_ASSETS).map((asset) => ({
  ...asset,
  liquidationThresholdBps: asset.liquidationThresholdBps ?? TEMP_LIQUIDATION_THRESHOLDS_BPS[asset.id] ?? 8000,
  address:
    asset.address ||
    (asset.id === "BTC"
      ? (DEPLOYMENT as unknown as { mockBtc?: string }).mockBtc
      : asset.id === "SOL"
        ? (DEPLOYMENT as unknown as { mockSol?: string }).mockSol
        : undefined),
}));

export function DefiProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState("");
  const [ethBalance, setEthBalance] = useState("0");
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [usdtAllowance, setUsdtAllowance] = useState("0");
  const [assetBalances, setAssetBalances] = useState<Record<string, string>>({});
  const [assetAllowances, setAssetAllowances] = useState<Record<string, string>>({});
  const [tokenCollateral, setTokenCollateral] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceSource, setPriceSource] = useState("unavailable");
  const [poolLiquidity, setPoolLiquidity] = useState("0");
  const [poolCollateral, setPoolCollateral] = useState("0");
  const [totalBorrowed, setTotalBorrowed] = useState("0");
  const [totalStaked, setTotalStaked] = useState("0");
  const [protocolReserveUsdt, setProtocolReserveUsdt] = useState("0");
  const [minReserveUsdt, setMinReserveUsdt] = useState("0");
  const [minLiquidityBufferBps, setMinLiquidityBufferBps] = useState("3000");
  const [companyTreasury, setCompanyTreasury] = useState({ staked: "0", interest: "0", reserve: "0" });
  const [stakingApyBps, setStakingApyBps] = useState("1200");
  const [reserveFactorBps, setReserveFactorBps] = useState("1000");
  const [borrowApyBps, setBorrowApyBps] = useState("400");
  const [protocolStatus, setProtocolStatus] = useState("Connect Hardhat node to load protocol data.");
  const [position, setPosition] = useState<Position>({ collateral: "0", borrowed: "0", accruedInterest: "0", totalDebt: "0", staked: "0", pendingReward: "0" });
  const [selectedAssetId, setSelectedAssetId] = useState("ETH");
  const [assetSearch, setAssetSearch] = useState("");
  const [collateralAmount, setCollateralAmount] = useState("0.01");
  const [borrowAmount, setBorrowAmount] = useState("0.7");
  const [repayAmount, setRepayAmount] = useState("1");
  const [stakeAmount, setStakeAmount] = useState("100");
  const [unstakeAmount, setUnstakeAmount] = useState("100");
  const [liquidityAmount, setLiquidityAmount] = useState("100");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isMessageClosing, setIsMessageClosing] = useState(false);
  const [borrowHistory, setBorrowHistory] = useState<BorrowHistory[]>([]);
  const [repayHistory, setRepayHistory] = useState<RepayHistory[]>([]);
  const [stakingHistory, setStakingHistory] = useState<StakingHistory[]>([]);
  const [assetLiquidationThresholds, setAssetLiquidationThresholds] = useState<Record<string, number>>({});

  const deploymentReady = hasDeployment();
  const assets = useMemo(
    () =>
      SUPPORTED_ASSETS.map((asset) => ({
        ...asset,
        liquidationThresholdBps: assetLiquidationThresholds[asset.id] ?? asset.liquidationThresholdBps,
      })),
    [assetLiquidationThresholds],
  );
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || assets[0];
  const selectedBalance = assetBalances[selectedAsset.id] || "0";
  const selectedAllowance = assetAllowances[selectedAsset.id] || "0";
  const selectedLivePrice = prices[selectedAsset.coingeckoId] ?? 0;
  const collateralValue = useMemo(() => toNumber(collateralAmount) * selectedLivePrice, [collateralAmount, selectedLivePrice]);
  const liveCollateralValue = collateralValue;
  const maxBorrow = useMemo(() => (collateralValue * selectedAsset.ltvBps) / 10000, [collateralValue, selectedAsset.ltvBps]);
  const safeMaxBorrow = useMemo(() => (maxBorrow * SAFE_MAX_BORROW_BPS) / 10000, [maxBorrow]);
  const healthFactor = useMemo(() => {
    const borrow = toNumber(borrowAmount);
    return borrow > 0 ? ((collateralValue * selectedAsset.liquidationThresholdBps) / 10000) / borrow : 0;
  }, [borrowAmount, collateralValue, selectedAsset.liquidationThresholdBps]);
  const needsStakeApproval = toNumber(stakeAmount) > toNumber(usdtAllowance);
  const needsRepayApproval = toNumber(repayAmount) > toNumber(usdtAllowance);
  const needsFullRepayApproval = toNumber(position.totalDebt) + 0.01 > toNumber(usdtAllowance);
  const needsCollateralApproval = selectedAsset.type === "erc20" && toNumber(collateralAmount) > toNumber(selectedAllowance);
  const dailyReward = (toNumber(stakeAmount) * STAKING_APY) / 100 / 365;
  const yearlyReward = (toNumber(stakeAmount) * STAKING_APY) / 100;
  const portfolioValue = assets.reduce((sum, asset) => {
    const price = prices[asset.coingeckoId] ?? 0;
    return sum + toNumber(assetBalances[asset.id] || "0") * price;
  }, toNumber(usdtBalance));
  const isTreasury = account && account.toLowerCase() === DEPLOYMENT.deployer.toLowerCase();

  const visibleAssets = assets.filter((asset) => {
    const matchesSearch = `${asset.name} ${asset.symbol}`.toLowerCase().includes(assetSearch.toLowerCase());
    const hasBalance = !account || toNumber(assetBalances[asset.id] || "0") > 0;
    return matchesSearch && hasBalance;
  });

  const refreshLiquidationThresholds = useCallback(async () => {
    if (!deploymentReady) return;

    const provider = new JsonRpcProvider(LOCAL_RPC_URL);
    const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, provider);
    const entries = await Promise.all(
      SUPPORTED_ASSETS.map(async (asset) => {
        if (asset.id === "ETH") {
          return [asset.id, Number(await pool.ethLiquidationThresholdBps())] as const;
        }

        const configured = await pool.collateralAssets(assetKey(asset.id));
        return [asset.id, Number(configured.liquidationThresholdBps ?? configured[3])] as const;
      }),
    );
    const nextThresholds = Object.fromEntries(entries);
    setAssetLiquidationThresholds(nextThresholds);
    localStorage.setItem("liquidation-thresholds-bps", JSON.stringify(nextThresholds));
  }, [deploymentReady]);

  const setAssetLiquidationThreshold = useCallback(async (assetId: string, thresholdPercent: string) => {
    const nextPercent = Number(thresholdPercent);
    if (!Number.isFinite(nextPercent) || nextPercent <= 0 || nextPercent > 100) {
      throw new Error("Liquidation threshold must be between 0 and 100.");
    }

    const asset = assets.find((item) => item.id === assetId);
    if (!asset) throw new Error("Unsupported collateral asset.");

    const nextBps = Math.round(nextPercent * 100);
    if (nextBps < asset.ltvBps) {
      throw new Error(`Liquidation threshold must be at least ${(asset.ltvBps / 100).toFixed(0)}% for ${asset.symbol}.`);
    }

    if (!window.ethereum) throw new Error("MetaMask is not available. Please install MetaMask first.");
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
    const tx = assetId === "ETH"
      ? await pool.setEthLiquidationThresholdBps(nextBps)
      : await pool.setCollateralLiquidationThresholdBps(assetKey(assetId), nextBps);

    await tx.wait();
    await refreshLiquidationThresholds();
  }, [assets, refreshLiquidationThresholds]);

  const showError = useCallback((message: string) => {
    setError(message);
    setIsShaking(false);
    window.setTimeout(() => setIsShaking(true), 0);
    window.setTimeout(() => setIsShaking(false), 460);
  }, []);

  const getBrowserProvider = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask is not available. Please install MetaMask first.");
    return new BrowserProvider(window.ethereum);
  }, []);

  const ensureHardhatNetwork = useCallback(async (provider: BrowserProvider) => {
    const network = await provider.getNetwork();
    if (Number(network.chainId) === HARDHAT_CHAIN_ID) return;
    if (!window.ethereum) throw new Error("MetaMask is not available. Please install MetaMask first.");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_HEX }],
      });
    } catch (caught) {
      const switchError = caught as { code?: number };
      if (switchError.code !== 4902) {
        throw caught;
      }
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_HEX, chainName: "Hardhat Local", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [LOCAL_RPC_URL], blockExplorerUrls: [] }],
      });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_HEX }],
      });
    }

    const refreshedProvider = new BrowserProvider(window.ethereum);
    const switchedNetwork = await refreshedProvider.getNetwork();
    if (Number(switchedNetwork.chainId) !== HARDHAT_CHAIN_ID) {
      throw new Error("Please switch MetaMask to Hardhat Local (Chain ID 31337).");
    }
  }, []);

  const refreshPrices = useCallback(async () => {
    try {
      const response = await fetch("/api/prices", { cache: "no-store" });
      if (!response.ok) throw new Error("Price API failed");
      const data = await response.json();
      setPrices(data.prices || {});
      setPriceSource(data.source || "unavailable");
    } catch {
      setPrices({});
      setPriceSource("unavailable");
    }
  }, []);

  const refreshBorrowHistory = useCallback(
    async (walletAddress = account) => {
      if (!walletAddress) {
        setBorrowHistory([]);
        return;
      }
      const response = await fetch(`/api/borrow-history?wallet=${walletAddress}`, { cache: "no-store" });
      if (response.ok) setBorrowHistory(await response.json());
    },
    [account],
  );

  const refreshStakingHistory = useCallback(
    async (walletAddress = account) => {
      if (!walletAddress) {
        setStakingHistory([]);
        return;
      }
      const response = await fetch(`/api/staking-history?wallet=${walletAddress}`, { cache: "no-store" });
      if (response.ok) setStakingHistory(await response.json());
    },
    [account],
  );

  const refreshRepayHistory = useCallback(
    async (walletAddress = account) => {
      if (!walletAddress) {
        setRepayHistory([]);
        return;
      }
      const response = await fetch(`/api/repay-history?wallet=${walletAddress}`, { cache: "no-store" });
      if (response.ok) setRepayHistory(await response.json());
    },
    [account],
  );

  const refreshProtocol = useCallback(async () => {
    if (!deploymentReady) return;
    try {
      const provider = new JsonRpcProvider(LOCAL_RPC_URL);
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, provider);
      const [liquidityRaw, poolEth, borrowedRaw, stakedRaw, reserveRaw, minReserveRaw, bufferBps, treasuryAddress, apyBps, factorBps, interestBps] = await Promise.all([
        pool.getPoolLiquidityUsdt(),
        provider.getBalance(DEPLOYMENT.lendingPool),
        pool.totalBorrowedUsdt(),
        pool.totalStakedUsdt(),
        pool.protocolReserveUsdt(),
        pool.minReserveUsdt(),
        pool.minLiquidityBufferBps(),
        pool.treasury(),
        pool.STAKING_APY_BPS(),
        pool.RESERVE_FACTOR_BPS(),
        pool.INTEREST_BPS(),
      ]);
      const [treasuryStakedRaw, treasuryInterestRaw] = await Promise.all([
        pool.stakedUsdt(treasuryAddress),
        pool.pendingRewardUsdt(treasuryAddress),
      ]);
      setPoolLiquidity(Number(formatUnits(liquidityRaw, 6)).toFixed(2));
      setPoolCollateral(Number(formatEther(poolEth)).toFixed(4));
      setTotalBorrowed(Number(formatUnits(borrowedRaw, 6)).toFixed(2));
      setTotalStaked(Number(formatUnits(stakedRaw, 6)).toFixed(2));
      setProtocolReserveUsdt(Number(formatUnits(reserveRaw, 6)).toFixed(2));
      setMinReserveUsdt(Number(formatUnits(minReserveRaw, 6)).toFixed(2));
      setMinLiquidityBufferBps(bufferBps.toString());
      setStakingApyBps(apyBps.toString());
      setReserveFactorBps(factorBps.toString());
      setBorrowApyBps(interestBps.toString());
      const claimableReserveRaw = reserveRaw >= minReserveRaw ? reserveRaw - minReserveRaw : BigInt(0);
      setCompanyTreasury({
        staked: Number(formatUnits(treasuryStakedRaw, 6)).toFixed(2),
        interest: Number(formatUnits(treasuryInterestRaw, 6)).toFixed(4),
        reserve: formatUnits(claimableReserveRaw, 6),
      });
      setProtocolStatus("Protocol data loaded from Hardhat local chain.");
    } catch {
      setProtocolStatus("Hardhat node is not reachable. Run npm.cmd run hardhat:node and npm.cmd run deploy:local.");
    }
  }, [deploymentReady]);

  const refreshBalances = useCallback(
    async (walletAddress = account) => {
      if (!walletAddress || !deploymentReady) return;
      const provider = await getBrowserProvider();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== HARDHAT_CHAIN_ID) {
        throw new Error("Please switch MetaMask to Hardhat Local (Chain ID 31337).");
      }
      const usdt = new Contract(DEPLOYMENT.mockUsdt, MOCK_USDT_ABI, provider);
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, provider);
      const [eth, usdtRaw, allowanceRaw, loan, accruedInterestRaw, totalDebtRaw, stakedRaw, pendingRaw] = await Promise.all([
        provider.getBalance(walletAddress),
        usdt.balanceOf(walletAddress),
        usdt.allowance(walletAddress, DEPLOYMENT.lendingPool),
        pool.positions(walletAddress),
        pool.getAccruedInterestUsdt(walletAddress),
        pool.getTotalDebtUsdt(walletAddress),
        pool.stakedUsdt(walletAddress),
        pool.pendingRewardUsdt(walletAddress),
      ]);

      const nextBalances: Record<string, string> = { ETH: Number(formatEther(eth)).toFixed(4) };
      const nextAllowances: Record<string, string> = {};
      const nextTokenCollateral: Record<string, string> = {};

      await Promise.all(
        assets.filter((asset) => asset.type === "erc20" && asset.address).map(async (asset) => {
          const token = new Contract(asset.address!, MOCK_USDT_ABI, provider);
          const [balanceRaw, assetAllowanceRaw, collateralRaw] = await Promise.all([
            token.balanceOf(walletAddress),
            token.allowance(walletAddress, DEPLOYMENT.lendingPool),
            pool.tokenCollateral(walletAddress, assetKey(asset.id)),
          ]);
          nextBalances[asset.id] = Number(formatUnits(balanceRaw, asset.decimals)).toFixed(4);
          nextAllowances[asset.id] = Number(formatUnits(assetAllowanceRaw, asset.decimals)).toFixed(4);
          nextTokenCollateral[asset.id] = Number(formatUnits(collateralRaw, asset.decimals)).toFixed(4);
        }),
      );

      setEthBalance(Number(formatEther(eth)).toFixed(4));
      setUsdtBalance(Number(formatUnits(usdtRaw, 6)).toFixed(2));
      setUsdtAllowance(Number(formatUnits(allowanceRaw, 6)).toFixed(2));
      setAssetBalances(nextBalances);
      setAssetAllowances(nextAllowances);
      setTokenCollateral(nextTokenCollateral);
      setPosition({
        collateral: Number(formatEther(loan.collateralWei)).toFixed(4),
        borrowed: Number(formatUnits(loan.borrowedUsdt, 6)).toFixed(2),
        accruedInterest: Number(formatUnits(accruedInterestRaw, 6)).toFixed(4),
        totalDebt: Number(formatUnits(totalDebtRaw, 6)).toFixed(4),
        staked: Number(formatUnits(stakedRaw, 6)).toFixed(2),
        pendingReward: Number(formatUnits(pendingRaw, 6)).toFixed(4),
      });
      await refreshProtocol();
    },
    [account, assets, deploymentReady, getBrowserProvider, refreshProtocol],
  );

  const requireWallet = useCallback(() => {
    if (!account) throw new Error("Please connect your MetaMask wallet first.");
    if (!deploymentReady) throw new Error("Contracts are not deployed yet. Run npm.cmd run deploy:local first.");
  }, [account, deploymentReady]);

  const validateBorrow = useCallback(() => {
    requireWallet();
    if (toNumber(position.borrowed) > 0 || toNumber(position.totalDebt) > 0) {
      throw new Error("You already have an active loan. Repay it fully before borrowing again.");
    }
    if (!isPositiveDecimal(collateralAmount)) throw new Error("Collateral amount must be a valid number greater than 0.");
    if (!isPositiveDecimal(borrowAmount)) throw new Error("Borrow amount must be a valid number greater than 0.");
    if (decimalPlaces(collateralAmount) > selectedAsset.decimals) throw new Error(`${selectedAsset.name} supports up to ${selectedAsset.decimals} decimal places.`);
    if (decimalPlaces(borrowAmount) > 6) throw new Error("USDT borrow amount supports up to 6 decimal places.");
    const collateral = toNumber(collateralAmount);
    const borrow = toNumber(borrowAmount);
    const maxSpendableEth = Math.max(toNumber(ethBalance) - GAS_BUFFER_ETH, 0);
    if (selectedAsset.type === "native" && collateral > maxSpendableEth) throw new Error(`Collateral exceeds wallet ETH balance after gas buffer. Max: ${maxSpendableEth.toFixed(4)} ETH.`);
    if (selectedAsset.type === "erc20" && !selectedAsset.address) throw new Error(`${selectedAsset.name} token address is missing. Redeploy contracts first.`);
    if (selectedAsset.type === "erc20" && collateral > toNumber(selectedBalance)) throw new Error(`Collateral exceeds wallet ${selectedAsset.name} balance.`);
    if (selectedLivePrice <= 0) throw new Error(`CoinGecko price is unavailable for ${selectedAsset.symbol}.`);
    if (borrow > safeMaxBorrow) {
      throw new Error(`Borrow amount exceeds the displayed max borrow of ${safeMaxBorrow.toFixed(2)} USDT.`);
    }
    if (borrow > toNumber(poolLiquidity)) throw new Error("Borrow amount exceeds protocol USDT liquidity.");
  }, [borrowAmount, collateralAmount, ethBalance, poolLiquidity, position.borrowed, position.totalDebt, requireWallet, safeMaxBorrow, selectedAsset, selectedBalance, selectedLivePrice]);

  const validateStake = useCallback((amountValue?: string) => {
    const amount = amountValue ?? stakeAmount;
    requireWallet();
    if (!isPositiveDecimal(amount)) throw new Error("Stake amount must be a valid number greater than 0.");
    if (decimalPlaces(amount) > 6) throw new Error("USDT stake amount supports up to 6 decimal places.");
    if (toNumber(amount) > toNumber(usdtBalance)) throw new Error("Stake amount exceeds your wallet USDT balance.");
  }, [requireWallet, stakeAmount, usdtBalance]);

  const validateLiquidity = useCallback((amountValue?: string) => {
    const amount = amountValue ?? liquidityAmount;
    requireWallet();
    if (!isTreasury) throw new Error("Only the treasury wallet can add liquidity.");
    if (!isPositiveDecimal(amount)) throw new Error("Liquidity amount must be a valid number greater than 0.");
    if (decimalPlaces(amount) > 6) throw new Error("USDT liquidity amount supports up to 6 decimal places.");
    if (toNumber(amount) > toNumber(usdtBalance)) throw new Error(`Liquidity amount exceeds treasury wallet USDT balance. Wallet has ${usdtBalance} USDT.`);
  }, [isTreasury, liquidityAmount, requireWallet, usdtBalance]);

  const validateRepay = useCallback(() => {
    requireWallet();
    if (toNumber(position.borrowed) <= 0) throw new Error("You do not have an active loan to repay.");
    if (!isPositiveDecimal(repayAmount)) throw new Error("Repay amount must be a valid number greater than 0.");
    if (decimalPlaces(repayAmount) > 6) throw new Error("USDT repay amount supports up to 6 decimal places.");
    if (toNumber(repayAmount) < toNumber(position.accruedInterest)) throw new Error(`Repay amount must cover accrued interest first. Interest due: ${position.accruedInterest} USDT.`);
    if (toNumber(repayAmount) > toNumber(position.totalDebt)) throw new Error("Repay amount exceeds your total debt. Use Repay Full Loan instead.");
    if (toNumber(repayAmount) > toNumber(usdtBalance)) throw new Error("Repay amount exceeds your wallet USDT balance.");
  }, [position, repayAmount, requireWallet, usdtBalance]);

  const validateWithdrawCollateral = useCallback(() => {
    requireWallet();
    if (toNumber(position.borrowed) > 0 || toNumber(position.totalDebt) > 0) throw new Error("Repay your full loan before withdrawing collateral.");
    const hasEthCollateral = toNumber(position.collateral) > 0;
    const hasTokenCollateral = Object.values(tokenCollateral).some((amount) => toNumber(amount) > 0);
    if (!hasEthCollateral && !hasTokenCollateral) throw new Error("No collateral is available to withdraw.");
  }, [position, requireWallet, tokenCollateral]);

  const approveUsdt = useCallback(async (amount: string) => {
    const provider = await getBrowserProvider();
    const signer = await provider.getSigner();
    const usdt = new Contract(DEPLOYMENT.mockUsdt, MOCK_USDT_ABI, signer);
    const tx = await usdt.approve(DEPLOYMENT.lendingPool, parseUnits(amount, 6));
    await tx.wait();
    await refreshBalances(await signer.getAddress());
  }, [getBrowserProvider, refreshBalances]);

  const connectWallet = useCallback(async () => {
    try {
      setError("");
      setStatus("Connecting MetaMask...");
      const provider = await getBrowserProvider();
      await provider.send("eth_requestAccounts", []);
      await ensureHardhatNetwork(provider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      setStatus("Wallet connected successfully.");
      await refreshBalances(address);
      await refreshBorrowHistory(address);
      await refreshRepayHistory(address);
      await refreshStakingHistory(address);
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Failed to connect wallet.");
      setStatus("");
    }
  }, [ensureHardhatNetwork, getBrowserProvider, refreshBalances, refreshBorrowHistory, refreshRepayHistory, refreshStakingHistory, showError]);

  const mintMockTokens = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      requireWallet();
      const btcAsset = assets.find((asset) => asset.id === "BTC");
      const solAsset = assets.find((asset) => asset.id === "SOL");
      if (!btcAsset?.address || !solAsset?.address) {
        throw new Error("Mock token addresses are missing. Redeploy contracts first.");
      }

      const provider = await getBrowserProvider();
      await ensureHardhatNetwork(provider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const usdt = new Contract(DEPLOYMENT.mockUsdt, MOCK_USDT_ABI, signer);
      const btc = new Contract(btcAsset.address, MOCK_USDT_ABI, signer);
      const sol = new Contract(solAsset.address, MOCK_USDT_ABI, signer);

      setStatus("Minting demo USDT...");
      await (await usdt.mint(address, parseUnits("1000", 6))).wait();
      setStatus("Minting demo BTC...");
      await (await btc.mint(address, parseUnits("0.1", btcAsset.decimals))).wait();
      setStatus("Minting demo SOL...");
      await (await sol.mint(address, parseUnits("10", solAsset.decimals))).wait();

      setStatus("Mock tokens minted to your wallet.");
      await refreshBalances(address);
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Mock token mint failed.");
    } finally {
      setIsBusy(false);
    }
  }, [assets, ensureHardhatNetwork, getBrowserProvider, refreshBalances, requireWallet, showError]);

  const approveCollateral = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      validateBorrow();
      if (selectedAsset.type !== "erc20" || !selectedAsset.address) throw new Error("Selected collateral does not need approval.");
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const token = new Contract(selectedAsset.address, MOCK_USDT_ABI, signer);
      const tx = await token.approve(DEPLOYMENT.lendingPool, parseUnits(collateralAmount, selectedAsset.decimals));
      setStatus(`${selectedAsset.name} approval submitted. Waiting for confirmation...`);
      await tx.wait();
      setStatus(`${selectedAsset.name} approved for borrowing.`);
      await refreshBalances(await signer.getAddress());
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Collateral approval failed.");
    } finally {
      setIsBusy(false);
    }
  }, [collateralAmount, getBrowserProvider, refreshBalances, selectedAsset, showError, validateBorrow]);

  const borrow = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      validateBorrow();
      if (needsCollateralApproval) throw new Error(`Please approve ${selectedAsset.name} before borrowing.`);
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const borrowRaw = parseUnits(borrowAmount, 6);
      await (
        selectedAsset.type === "native"
          ? pool.borrowWithEthCollateral.staticCall(borrowRaw, { value: parseEther(collateralAmount) })
          : pool.borrowWithTokenCollateral.staticCall(assetKey(selectedAsset.id), parseUnits(collateralAmount, selectedAsset.decimals), borrowRaw)
      );
      const tx =
        selectedAsset.type === "native"
          ? await pool.borrowWithEthCollateral(borrowRaw, { value: parseEther(collateralAmount) })
          : await pool.borrowWithTokenCollateral(assetKey(selectedAsset.id), parseUnits(collateralAmount, selectedAsset.decimals), borrowRaw);
      setStatus("Borrow transaction submitted. Waiting for confirmation...");
      const receipt = await tx.wait();
      if (receipt?.status !== 1) throw new Error("Borrow transaction reverted.");
      await refreshBalances(walletAddress);
      try {
        await fetch("/api/borrow-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, collateralSymbol: selectedAsset.name, collateralAmount, borrowAmount, txHash: receipt.hash }),
        });
        await refreshBorrowHistory(walletAddress);
      } catch {
        // Borrow succeeded on-chain; history sync can be retried on refresh.
      }
      setStatus(`Borrow successful. mUSDT balance refreshed in the app. Token: ${DEPLOYMENT.mockUsdt}`);
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Borrow transaction failed.");
    } finally {
      setIsBusy(false);
    }
  }, [borrowAmount, collateralAmount, getBrowserProvider, needsCollateralApproval, refreshBalances, refreshBorrowHistory, selectedAsset, showError, validateBorrow]);

  const approveRepay = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      requireWallet();
      if (toNumber(position.borrowed) <= 0) throw new Error("You do not have an active loan to repay.");
      const approvalAmount = Math.max(toNumber(repayAmount), toNumber(position.totalDebt) + 1);
      setStatus("USDT repay approval submitted. Waiting for confirmation...");
      await approveUsdt(approvalAmount.toFixed(6));
      setStatus("USDT approved for loan repayment.");
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Repay approval failed.");
    } finally {
      setIsBusy(false);
    }
  }, [approveUsdt, position, repayAmount, requireWallet, showError]);

  const repayLoan = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      validateRepay();
      if (needsRepayApproval) throw new Error("Approve USDT before repaying this amount.");
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const interestBefore = Math.min(toNumber(repayAmount), toNumber(position.accruedInterest));
      const principalBefore = Math.max(toNumber(repayAmount) - interestBefore, 0);
      const tx = await pool.repayUsdt(parseUnits(repayAmount, 6));
      setStatus("Repay transaction submitted. Waiting for confirmation...");
      const receipt = await tx.wait();
      await fetch("/api/repay-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: await signer.getAddress(), amount: repayAmount, interestPaid: interestBefore.toFixed(4), principalPaid: principalBefore.toFixed(4), txHash: receipt.hash }) });
      setStatus("Repayment successful. Loan balance refreshed.");
      await refreshBalances(await signer.getAddress());
      await refreshRepayHistory();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Repay transaction failed.");
    } finally {
      setIsBusy(false);
    }
  }, [getBrowserProvider, needsRepayApproval, position.accruedInterest, refreshBalances, refreshRepayHistory, repayAmount, showError, validateRepay]);

  const repayFullLoan = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      requireWallet();
      if (toNumber(position.borrowed) <= 0) throw new Error("You do not have an active loan to repay.");
      if (toNumber(position.totalDebt) > toNumber(usdtBalance)) throw new Error("Total debt exceeds your wallet USDT balance.");
      if (needsFullRepayApproval) throw new Error("Approve USDT before repaying the full loan.");
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const debtBefore = position.totalDebt;
      const interestBefore = position.accruedInterest;
      const principalBefore = position.borrowed;
      const tx = await pool.repayFullLoan();
      setStatus("Full repayment submitted. Waiting for confirmation...");
      const receipt = await tx.wait();
      await fetch("/api/repay-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: await signer.getAddress(), amount: debtBefore, interestPaid: interestBefore, principalPaid: principalBefore, txHash: receipt.hash }) });
      setStatus("Full loan repaid. You can now withdraw collateral.");
      await refreshBalances(await signer.getAddress());
      await refreshRepayHistory();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Full repayment failed.");
    } finally {
      setIsBusy(false);
    }
  }, [getBrowserProvider, needsFullRepayApproval, position, refreshBalances, refreshRepayHistory, requireWallet, showError, usdtBalance]);

  const repayPosition = useCallback(async (amount: string) => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      requireWallet();

      const repaymentAmount = amount.trim();
      if (toNumber(position.borrowed) <= 0) throw new Error("You do not have an active loan to repay.");
      if (!isPositiveDecimal(repaymentAmount)) throw new Error("Repay amount must be a valid number greater than 0.");
      if (decimalPlaces(repaymentAmount) > 6) throw new Error("USDT repay amount supports up to 6 decimal places.");

      const repayValue = toNumber(repaymentAmount);
      const interestDue = toNumber(position.accruedInterest);
      const totalDebt = toNumber(position.totalDebt);
      const isFullRepayment = totalDebt > 0 && repayValue + FULL_REPAY_TOLERANCE_USDT >= totalDebt;

      if (!isFullRepayment && repayValue < interestDue) throw new Error(`Repay amount must cover accrued interest first. Interest due: ${position.accruedInterest} USDT.`);
      if (repayValue > totalDebt + FULL_REPAY_TOLERANCE_USDT) throw new Error("Repay amount exceeds your total debt.");
      if (repayValue > toNumber(usdtBalance)) throw new Error("Repay amount exceeds your wallet USDT balance.");

      const approvalAmount = isFullRepayment ? (totalDebt + 1).toFixed(6) : repaymentAmount;
      if (toNumber(approvalAmount) > toNumber(usdtAllowance)) {
        setStatus("USDT repay approval submitted. Waiting for confirmation...");
        await approveUsdt(approvalAmount);
      }

      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);

      if (isFullRepayment) {
        const debtBefore = position.totalDebt;
        const interestBefore = position.accruedInterest;
        const principalBefore = position.borrowed;

        setStatus("Full repayment submitted. Waiting for confirmation...");
        const repayTx = await pool.repayFullLoan();
        const repayReceipt = await repayTx.wait();

        try {
          await fetch("/api/repay-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, amount: debtBefore, interestPaid: interestBefore, principalPaid: principalBefore, txHash: repayReceipt.hash }),
          });
          await refreshRepayHistory(walletAddress);
        } catch {
          // Repayment succeeded on-chain; history sync can be retried on refresh.
        }

        setStatus("Full repayment confirmed. Returning collateral...");
        const withdrawTx = await pool.withdrawAllCollateral();
        await withdrawTx.wait();
        setStatus("Full repayment complete. Collateral returned to your wallet.");
        await refreshBalances(walletAddress);
        return;
      }

      const interestBefore = Math.min(repayValue, interestDue);
      const principalBefore = Math.max(repayValue - interestBefore, 0);
      setStatus("Repay transaction submitted. Waiting for confirmation...");
      const repayTx = await pool.repayUsdt(parseUnits(repaymentAmount, 6));
      const repayReceipt = await repayTx.wait();

      try {
        await fetch("/api/repay-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, amount: repaymentAmount, interestPaid: interestBefore.toFixed(4), principalPaid: principalBefore.toFixed(4), txHash: repayReceipt.hash }),
        });
        await refreshRepayHistory(walletAddress);
      } catch {
        // Repayment succeeded on-chain; history sync can be retried on refresh.
      }

      setStatus("Repayment successful. Loan balance refreshed.");
      await refreshBalances(walletAddress);
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Repayment failed.");
    } finally {
      setIsBusy(false);
    }
  }, [approveUsdt, getBrowserProvider, position, refreshBalances, refreshRepayHistory, requireWallet, showError, usdtAllowance, usdtBalance]);

  const withdrawCollateral = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      validateWithdrawCollateral();
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const tx = await pool.withdrawAllCollateral();
      setStatus("Collateral withdrawal submitted. Waiting for confirmation...");
      await tx.wait();
      setStatus("Collateral withdrawn back to your wallet.");
      await refreshBalances(await signer.getAddress());
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Collateral withdrawal failed.");
    } finally {
      setIsBusy(false);
    }
  }, [getBrowserProvider, refreshBalances, showError, validateWithdrawCollateral]);

  const approveStake = useCallback(async (amount?: string) => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      const amountValue = amount ?? stakeAmount;
      validateStake(amountValue);
      setStatus("USDT approval submitted. Waiting for confirmation...");
      await approveUsdt(amountValue);
      setStatus("USDT approved. You can now stake.");
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Approval failed.");
    } finally {
      setIsBusy(false);
    }
  }, [approveUsdt, showError, stakeAmount, validateStake]);

  const stake = useCallback(async (amount?: string) => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      const amountValue = amount ?? stakeAmount;
      validateStake(amountValue);
      if (toNumber(amountValue) > toNumber(usdtAllowance)) throw new Error("Please approve USDT before staking.");
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const tx = await pool.stakeUsdt(parseUnits(amountValue, 6));
      setStatus("Stake transaction submitted. Waiting for confirmation...");
      const receipt = await tx.wait();
      await fetch("/api/staking-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: await signer.getAddress(), action: "STAKE", amount: amountValue, rewardAmount: "0", txHash: receipt.hash }) });
      setStatus("Stake successful. Your USDT is now earning rewards.");
      await refreshBalances(await signer.getAddress());
      await refreshStakingHistory();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Stake failed.");
    } finally {
      setIsBusy(false);
    }
  }, [getBrowserProvider, refreshBalances, refreshStakingHistory, showError, stakeAmount, usdtAllowance, validateStake]);

  const claimRewards = useCallback(async () => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      requireWallet();
      if (toNumber(position.pendingReward) <= 0) throw new Error("No rewards available to claim yet.");
      const rewardBefore = position.pendingReward;
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const tx = await pool.claimRewards();
      setStatus("Claim transaction submitted. Waiting for confirmation...");
      const receipt = await tx.wait();
      await fetch("/api/staking-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: await signer.getAddress(), action: "CLAIM", amount: "0", rewardAmount: rewardBefore, txHash: receipt.hash }) });
      setStatus("Rewards claimed successfully.");
      await refreshBalances(await signer.getAddress());
      await refreshStakingHistory();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Claim failed.");
    } finally {
      setIsBusy(false);
    }
  }, [getBrowserProvider, position.pendingReward, refreshBalances, refreshStakingHistory, requireWallet, showError]);

  const unstake = useCallback(async (amount?: string) => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      const amountValue = amount ?? unstakeAmount;
      requireWallet();
      if (!isPositiveDecimal(amountValue)) throw new Error("Unstake amount must be a valid number greater than 0.");
      if (decimalPlaces(amountValue) > 6) throw new Error("USDT unstake amount supports up to 6 decimal places.");
      if (toNumber(amountValue) > toNumber(position.staked)) throw new Error("Unstake amount exceeds your staked USDT.");
      if (isTreasury) {
        const outflow = toNumber(amountValue) + toNumber(position.pendingReward);
        const poolBalance = toNumber(poolLiquidity);
        const available = Math.max(poolBalance - toNumber(protocolReserveUsdt), 0);
        const availableAfter = available - outflow;
        if (availableAfter < toNumber(totalBorrowed)) throw new Error("Unstake would leave the pool unable to cover outstanding loans.");
        if (availableAfter < (poolBalance * toNumber(minLiquidityBufferBps)) / 10000) throw new Error("Unstake would breach the pool liquidity buffer.");
      }
      const rewardBefore = position.pendingReward;
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const tx = await pool.unstakeUsdt(parseUnits(amountValue, 6));
      setStatus("Unstake transaction submitted. Waiting for confirmation...");
      const receipt = await tx.wait();
      await fetch("/api/staking-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: await signer.getAddress(), action: "UNSTAKE", amount: amountValue, rewardAmount: rewardBefore, txHash: receipt.hash }) });
      setStatus("Unstake successful. Principal and rewards returned.");
      await refreshBalances(await signer.getAddress());
      await refreshStakingHistory();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Unstake failed.");
    } finally {
      setIsBusy(false);
    }
  }, [getBrowserProvider, isTreasury, minLiquidityBufferBps, poolLiquidity, position.pendingReward, position.staked, protocolReserveUsdt, refreshBalances, refreshStakingHistory, requireWallet, showError, totalBorrowed, unstakeAmount]);

  const approveLiquidity = useCallback(async (amount?: string) => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      const amountValue = amount ?? liquidityAmount;
      validateLiquidity(amountValue);
      setStatus("Liquidity approval submitted. Waiting for confirmation...");
      await approveUsdt(amountValue);
      setStatus("USDT approved for liquidity funding.");
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Liquidity approval failed.");
    } finally {
      setIsBusy(false);
    }
  }, [approveUsdt, liquidityAmount, showError, validateLiquidity]);

  const addLiquidity = useCallback(async (amount?: string) => {
    try {
      setError("");
      setStatus("");
      setIsBusy(true);
      const amountValue = amount ?? liquidityAmount;
      validateLiquidity(amountValue);
      if (toNumber(amountValue) > toNumber(usdtAllowance)) throw new Error("Approve USDT before adding liquidity.");
      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const tx = await pool.addLiquidity(parseUnits(amountValue, 6));
      setStatus("Add liquidity transaction submitted. Waiting for confirmation...");
      await tx.wait();
      setStatus("Liquidity added to the protocol.");
      await refreshBalances(await signer.getAddress());
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Add liquidity failed.");
    } finally {
      setIsBusy(false);
    }
  }, [getBrowserProvider, liquidityAmount, refreshBalances, showError, usdtAllowance, validateLiquidity]);

  const withdrawReserve = useCallback(
    async (amount: string) => {
      try {
        setError("");
        setStatus("");
        setIsBusy(true);
        requireWallet();
        if (!isTreasury) throw new Error("Only the company treasury wallet can withdraw reserve earnings.");
        if (!isPositiveDecimal(amount)) throw new Error("Withdraw amount must be a valid number greater than 0.");
        if (decimalPlaces(amount) > 6) throw new Error("USDT withdraw amount supports up to 6 decimal places.");
        if (toNumber(amount) > toNumber(companyTreasury.reserve)) throw new Error(`Claimable reserve is ${companyTreasury.reserve} USDT.`);
        const provider = await getBrowserProvider();
        const signer = await provider.getSigner();
        const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
        const tx = await pool.withdrawProtocolReserve(parseUnits(amount, 6));
        setStatus("Reserve withdrawal submitted. Waiting for confirmation...");
        await tx.wait();
        setStatus("Reserve earnings withdrawn to the company treasury.");
        await refreshProtocol();
        await refreshBalances(await signer.getAddress());
      } catch (caught) {
        showError(caught instanceof Error ? caught.message : "Reserve withdrawal failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [companyTreasury.reserve, getBrowserProvider, isTreasury, refreshBalances, refreshProtocol, requireWallet, showError],
  );

  const disconnectWallet = useCallback(() => {
    setAccount("");
    setEthBalance("0");
    setUsdtBalance("0");
    setUsdtAllowance("0");
    setAssetBalances({});
    setAssetAllowances({});
    setTokenCollateral({});
    setBorrowHistory([]);
    setRepayHistory([]);
    setStakingHistory([]);
    setPosition({ collateral: "0", borrowed: "0", accruedInterest: "0", totalDebt: "0", staked: "0", pendingReward: "0" });
    setProtocolReserveUsdt("0");
    setMinReserveUsdt("0");
    setMinLiquidityBufferBps("3000");
    setCompanyTreasury({ staked: "0", interest: "0", reserve: "0" });
    setStakingApyBps("1200");
    setReserveFactorBps("1000");
    setBorrowApyBps("400");
    setStatus("");
    setError("");
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const theme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : document.documentElement.getAttribute("data-theme") || "light";
    setIsDarkMode(theme === "dark");

    try {
      const savedThresholds = localStorage.getItem("liquidation-thresholds-bps");
      if (savedThresholds) setAssetLiquidationThresholds(JSON.parse(savedThresholds));
    } catch {
      localStorage.removeItem("liquidation-thresholds-bps");
    }
  }, []);

  useEffect(() => {
    const theme = isDarkMode ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [isDarkMode]);

  useEffect(() => {
    refreshPrices().catch(() => undefined);
    const priceTimer = window.setInterval(() => {
      refreshPrices().catch(() => undefined);
    }, 60000);
    refreshProtocol().catch(() => undefined);
    refreshLiquidationThresholds().catch(() => undefined);
    return () => window.clearInterval(priceTimer);
  }, [refreshLiquidationThresholds, refreshPrices, refreshProtocol]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccount = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      setAccount(nextAccount);
      if (nextAccount) {
        refreshBalances(nextAccount).catch(() => undefined);
        refreshBorrowHistory(nextAccount).catch(() => undefined);
        refreshRepayHistory(nextAccount).catch(() => undefined);
        refreshStakingHistory(nextAccount).catch(() => undefined);
      } else {
        disconnectWallet();
      }
    };
    const handleChainChanged = (chainId: unknown) => {
      if (typeof chainId !== "string") return;
      if (chainId.toLowerCase() !== HARDHAT_CHAIN_HEX) {
        showError("Please switch MetaMask back to Hardhat Local (Chain ID 31337).");
        disconnectWallet();
        return;
      }
      if (!account) return;
      refreshBalances(account).catch(() => undefined);
      refreshBorrowHistory(account).catch(() => undefined);
      refreshRepayHistory(account).catch(() => undefined);
      refreshStakingHistory(account).catch(() => undefined);
    };
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [account, disconnectWallet, refreshBalances, refreshBorrowHistory, refreshRepayHistory, refreshStakingHistory, showError]);

  useEffect(() => {
    if (!status && !error) return;
    setIsMessageClosing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const fadeTimer = window.setTimeout(() => setIsMessageClosing(true), 4500);
    const clearTimer = window.setTimeout(() => {
      setStatus("");
      setError("");
      setIsMessageClosing(false);
    }, 5200);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [status, error]);

  const value: DefiContextType = {
    account,
    isDarkMode,
    setIsDarkMode,
    status,
    error,
    isShaking,
    isMessageClosing,
    isBusy,
    deploymentReady,
    isTreasury: Boolean(isTreasury),
    connectWallet,
    mintMockTokens,
    disconnectWallet,
    assets,
    setAssetLiquidationThreshold,
    visibleAssets,
    selectedAsset,
    setSelectedAssetId,
    selectedBalance,
    selectedAllowance,
    selectedLivePrice,
    prices,
    priceSource,
    assetSearch,
    setAssetSearch,
    collateralAmount,
    setCollateralAmount,
    borrowAmount,
    setBorrowAmount,
    repayAmount,
    setRepayAmount,
    stakeAmount,
    setStakeAmount,
    unstakeAmount,
    setUnstakeAmount,
    liquidityAmount,
    setLiquidityAmount,
    collateralValue,
    liveCollateralValue,
    maxBorrow,
    safeMaxBorrow,
    healthFactor,
    dailyReward,
    yearlyReward,
    portfolioValue,
    usdtBalance,
    usdtAllowance,
    poolLiquidity,
    poolCollateral,
    totalBorrowed,
    totalStaked,
    protocolStatus,
    protocolReserveUsdt,
    minReserveUsdt,
    minLiquidityBufferBps,
    companyTreasury,
    stakingApyBps,
    reserveFactorBps,
    borrowApyBps,
    tokenCollateral,
    position,
    borrowHistory,
    repayHistory,
    stakingHistory,
    needsCollateralApproval,
    needsRepayApproval,
    needsFullRepayApproval,
    needsStakeApproval,
    approveCollateral,
    borrow,
    approveRepay,
    repayPosition,
    repayLoan,
    repayFullLoan,
    withdrawCollateral,
    approveStake,
    stake,
    claimRewards,
    unstake,
    approveLiquidity,
    addLiquidity,
    withdrawReserve,
  };

  return <DefiContext.Provider value={value}>{children}</DefiContext.Provider>;
}

export function useDefi() {
  const context = useContext(DefiContext);
  if (!context) throw new Error("useDefi must be used within DefiProvider.");
  return context;
}
