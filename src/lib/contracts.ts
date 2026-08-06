import deployment from "./deployment.json";

export const DEPLOYMENT = deployment;

export const LENDING_POOL_ABI = [
  "event Borrowed(address indexed borrower, uint256 collateralWei, uint256 borrowAmountUsdt, uint256 collateralValueUsdt, uint256 maxBorrowUsdt)",
  "event TokenBorrowed(address indexed borrower, bytes32 indexed assetId, uint256 collateralAmount, uint256 borrowAmountUsdt, uint256 collateralValueUsdt, uint256 maxBorrowUsdt)",
  "event Liquidated(address indexed liquidator, address indexed borrower, bytes32 indexed assetId, uint256 repayAmountUsdt, uint256 collateralSeized, uint256 bonusUsdt)",
  "event ProtocolReserveWithdrawn(address indexed treasury, uint256 amountUsdt)",
  "event MinReserveUpdated(uint256 minReserveUsdt)",
  "event LiquidityBufferUpdated(uint256 minLiquidityBufferBps)",
  "function borrowWithEthCollateral(uint256 borrowAmountUsdt) payable",
  "function borrowWithTokenCollateral(bytes32 assetId, uint256 collateralAmount, uint256 borrowAmountUsdt)",
  "function liquidate(address borrower, bytes32 assetId, uint256 repayAmountUsdt)",
  "function repayUsdt(uint256 amountUsdt)",
  "function repayFullLoan()",
  "function withdrawAllCollateral()",
  "function addLiquidity(uint256 usdtAmount)",
  "function withdrawProtocolReserve(uint256 amountUsdt)",
  "function setMinReserveUsdt(uint256 minReserveUsdt)",
  "function setMinLiquidityBufferBps(uint256 minLiquidityBufferBps)",
  "function getAccruedInterestUsdt(address borrower) view returns (uint256)",
  "function getTotalDebtUsdt(address borrower) view returns (uint256)",
  "function getCollateralValueUsdt(uint256 collateralWei) view returns (uint256)",
  "function getMaxBorrowUsdt(uint256 collateralWei) view returns (uint256)",
  "function getTokenCollateralValueUsdt(bytes32 assetId, uint256 collateralAmount) view returns (uint256)",
  "function getTokenMaxBorrowUsdt(bytes32 assetId, uint256 collateralAmount) view returns (uint256)",
  "function getBorrowerRiskData(address borrower) view returns (uint256 collateralValueUsdt, uint256 liquidationValueUsdt, uint256 debtUsdt, uint256 healthFactorBps)",
  "function previewLiquidation(address borrower, bytes32 assetId, uint256 repayAmountUsdt) view returns (uint256 seizeAmount, uint256 seizeValueUsdt, uint256 bonusUsdt)",
  "function getPoolLiquidityUsdt() view returns (uint256)",
  "function getAvailableLiquidityUsdt() view returns (uint256)",
  "function getCompanyTreasuryUsdt() view returns (uint256)",
  "function protocolReserveUsdt() view returns (uint256)",
  "function minReserveUsdt() view returns (uint256)",
  "function minLiquidityBufferBps() view returns (uint256)",
  "function RESERVE_FACTOR_BPS() view returns (uint256)",
  "function STAKING_APY_BPS() view returns (uint256)",
  "function INTEREST_BPS() view returns (uint256)",
  "function positions(address) view returns (uint256 collateralWei, uint256 borrowedUsdt, uint256 updatedAt)",
  "function tokenCollateral(address user, bytes32 assetId) view returns (uint256)",
  "function collateralAssets(bytes32 assetId) view returns (address token, uint8 decimals, uint256 ltvBps, uint256 liquidationThresholdBps, bool enabled)",
  "function totalTokenCollateral(bytes32 assetId) view returns (uint256)",
  "function stakedUsdt(address) view returns (uint256)",
  "function pendingRewardUsdt(address investor) view returns (uint256)",
  "function totalBorrowedUsdt() view returns (uint256)",
  "function totalStakedUsdt() view returns (uint256)",
  "function treasury() view returns (address)",
  "function stakeUsdt(uint256 amountUsdt)",
  "function unstakeUsdt(uint256 amountUsdt)",
  "function claimRewards()",
  "function priceOracle() view returns (address)",
  "function MAX_LTV_BPS() view returns (uint256)",
  "function LIQUIDATION_CLOSE_FACTOR_BPS() view returns (uint256)",
  "function LIQUIDATION_BONUS_BPS() view returns (uint256)",
  "function LIQUIDATION_HEALTH_FACTOR_BPS() view returns (uint256)",
  "function ethLiquidationThresholdBps() view returns (uint256)",
  "function setEthLiquidationThresholdBps(uint256 liquidationThresholdBps)",
  "function setCollateralLiquidationThresholdBps(bytes32 assetId, uint256 liquidationThresholdBps)",
  "function INTEREST_BPS() view returns (uint256)",
  "function STAKING_APY_BPS() view returns (uint256)"
] as const;

export const PRICE_ORACLE_ABI = [
  "function owner() view returns (address)",
  "function getPriceUsdt(bytes32 assetId) view returns (uint256)",
  "function setPriceUsdt(bytes32 assetId, uint256 priceUsdt)",
  "function setPricesUsdt(bytes32[] assetIds, uint256[] priceUsdtValues)"
] as const;

export const MOCK_USDT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
] as const;

export function hasDeployment() {
  const deploymentWithOracle = DEPLOYMENT as typeof DEPLOYMENT & { priceOracle?: string };
  return Boolean(deploymentWithOracle.mockUsdt && deploymentWithOracle.priceOracle && deploymentWithOracle.lendingPool);
}
