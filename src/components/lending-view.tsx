"use client";

import { useState } from "react";
import { DollarSign, ShieldCheck, TrendingDown, Info, Droplets, Percent, CircleAlert, ReceiptText } from "lucide-react";
import { playClickSound, toNumber, useDefi } from "@/components/defi-state";

function EthIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="#627EEA" />
      <path d="M20 8l-8 12 8 5 8-5-8-12z" fill="white" fillOpacity="0.9" />
      <path d="M12 20l8 12 8-12-8 5-8-5z" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

function BtcIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="#F7931A" />
      <text x="20" y="27" textAnchor="middle" fontSize="18" fill="white" fontWeight="bold">₿</text>
    </svg>
  );
}

function SolIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="#9945FF" />
      <path d="M12 14h14l-2 3H12v-3zm0 4.5h12l-2 3H12v-3zm2 4.5h12l-2 3H14v-3z" fill="white" />
    </svg>
  );
}

const COLLATERAL_ICONS = {
  ETH: EthIcon,
  BTC: BtcIcon,
  SOL: SolIcon,
};
const REPAY_DISPLAY_TOLERANCE_USDT = 0.01;

function formatUsd(value: number) {
  if (value <= 0) return "-";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value >= 1 ? 2 : 6 })}`;
}

function healthColor(hf: number) {
  if (hf <= 1) return "text-red-500";
  if (hf <= 1.2) return "text-yellow-500";
  return "text-green-500";
}

export function NewLendingView() {
  const state = useDefi();
  const { account, isDarkMode } = state;

  const [repayInput, setRepayInput] = useState("");

  const collateralNum = toNumber(state.collateralAmount);
  const borrowNum = toNumber(state.borrowAmount);
  const collateralUsdValue = collateralNum * state.selectedLivePrice;
  const maxLoanValue = state.safeMaxBorrow;
  const selectedLtvPercent = state.selectedAsset.ltvBps / 100;
  const selectedLiquidationThreshold = state.selectedAsset.liquidationThresholdBps / 10000;
  const liquidationPrice = selectedLiquidationThreshold > 0 ? borrowNum / ((collateralNum || 1) * selectedLiquidationThreshold) : 0;

  const totalDebt = toNumber(state.position.borrowed) + toNumber(state.position.accruedInterest);
  const hasActiveBorrowing = toNumber(state.position.borrowed) > 0 || toNumber(state.position.totalDebt) > 0;
  const repayAmt = toNumber(repayInput);
  const repayExceedsDisplayTolerance = repayAmt > totalDebt + REPAY_DISPLAY_TOLERANCE_USDT;
  const isFullRepayPreview = repayAmt > 0 && repayAmt + REPAY_DISPLAY_TOLERANCE_USDT >= totalDebt;
  const remainingDebt = isFullRepayPreview ? 0 : Math.max(0, totalDebt - repayAmt);
  const newHealthFactor = remainingDebt > 0 ? (toNumber(state.position.collateral) * state.selectedLivePrice) / remainingDebt : 0;

  const handleBorrowClick = () => {
    playClickSound();
    void state.borrow();
  };

  const handleRepayClick = () => {
    state.setRepayAmount(repayInput);
    playClickSound();
    void state.repayPosition(repayInput);
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-primary/10 rounded-full mb-6">
          <DollarSign className="w-16 h-16 text-primary" />
        </div>
        <h2 className="mb-3">Connect Your Wallet</h2>
        <p className="text-muted-foreground max-w-md">
          Please connect your wallet to access lending services
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2>Borrow USDT</h2>
        <p className="text-sm text-muted-foreground">Use your crypto as collateral to borrow USDT</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Select Collateral */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-base mb-4">Select Collateral</h3>
            <div className="grid grid-cols-2 gap-4">
              {state.assets.map((collateral) => {
                const Icon = COLLATERAL_ICONS[collateral.id as keyof typeof COLLATERAL_ICONS] || EthIcon;
                const collateralPrice = state.prices[collateral.coingeckoId] ?? 0;
                const collateralName = collateral.id === "ETH" ? "Ethereum" : collateral.name;

                return (
                  <div
                    key={collateral.id}
                    onClick={() => { playClickSound(); state.setSelectedAssetId(collateral.id); }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      state.selectedAsset.id === collateral.id
                        ? "border-primary bg-primary/5 shadow-lg"
                        : "border-border hover:border-primary/50 bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Icon />
                      <div>
                        <p className="font-medium">{collateral.symbol}</p>
                        <p className="text-xs text-muted-foreground">{collateralName}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-medium">{formatUsd(collateralPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max LTV</span>
                        <span className="font-medium text-green-500">{collateral.ltvBps / 100}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collateral Details */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-base mb-4">Collateral Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Collateral Amount ({state.selectedAsset.symbol})
                </label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={state.collateralAmount}
                  onChange={(e) => state.setCollateralAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {collateralNum > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    ≈ {formatUsd(collateralUsdValue)}
                  </p>
                )}
              </div>

              {collateralNum > 0 && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">Collateral Value</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Total Value</p>
                      <p className="font-semibold text-lg">
                        {formatUsd(collateralUsdValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Max Loan (LTV {selectedLtvPercent}%)</p>
                      <p className="font-semibold text-lg text-green-500">
                        {formatUsd(maxLoanValue)} USDT
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loan Details Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border p-6 sticky top-24 space-y-6">
            <h3 className="text-base mb-4">Loan Details</h3>

            {collateralNum <= 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Enter collateral amount to see loan details</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5" /> Pool Liquidity
                  </span>
                  <span className="font-medium text-blue-500">
                    ${toNumber(state.poolLiquidity).toLocaleString()} USDT
                  </span>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Loan Amount (USDT)
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={state.borrowAmount}
                    onChange={(e) => state.setBorrowAmount(e.target.value)}
                    max={maxLoanValue}
                    className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Max: {formatUsd(maxLoanValue)} USDT
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" /> Interest Rate
                    </span>
                    <span className="font-medium">4.0% APR</span>
                  </div>

                  {borrowNum > 0 && (
                    <>
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Health Factor</span>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className={`font-medium ${healthColor(state.healthFactor)}`}>
                          {state.healthFactor > 0 ? state.healthFactor.toFixed(2) : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-1">
                          <TrendingDown className="w-4 h-4 text-red-500" />
                          <span className="text-muted-foreground">Liquidation Price</span>
                        </div>
                        <span className="font-medium text-red-500">
                          ${liquidationPrice.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Your collateral will be liquidated if the price falls below the liquidation price to protect the protocol.
                    </p>
                  </div>
                </div>

                {state.needsCollateralApproval && (
                  <button
                    onClick={() => { playClickSound(); void state.approveCollateral(); }}
                    disabled={state.isBusy || hasActiveBorrowing}
                    className="w-full px-4 py-3 bg-muted text-foreground rounded-lg border border-border hover:bg-muted/80 transition-colors disabled:opacity-50"
                  >
                    Approve {state.selectedAsset.symbol}
                  </button>
                )}

                {hasActiveBorrowing && (
                  <div className="flex gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <CircleAlert className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      You already have an active loan. Repay it fully before borrowing again.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleBorrowClick}
                  disabled={hasActiveBorrowing || !borrowNum || borrowNum <= 0 || state.isBusy || state.needsCollateralApproval}
                  className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Borrow USDT
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Your Position */}
      {totalDebt > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-primary" />
            <h3 className="text-base">Your Position</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-xl space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Collateral</p>
              <p className="font-semibold text-lg">
                {state.position.collateral} {state.selectedAsset.symbol}
              </p>
              <p className="text-xs text-muted-foreground">
                ≈ {formatUsd(toNumber(state.position.collateral) * state.selectedLivePrice)}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Loan Amount</p>
              <p className="font-semibold text-lg">${toNumber(state.position.borrowed).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">USDT borrowed</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Interest Rate</p>
              <p className="font-semibold text-lg">4.0%</p>
              <p className="text-xs text-muted-foreground">
                Charged: ${toNumber(state.position.accruedInterest).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Debt</p>
              <p className="font-semibold text-lg text-orange-500">
                ${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Loan + interest</p>
            </div>
          </div>

          {/* Repay section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <h4 className="text-sm font-medium mb-2">Repay Loan</h4>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <span className="text-xs font-medium text-muted-foreground">USDT</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={repayInput}
                    onChange={(e) => setRepayInput(e.target.value)}
                    className="w-full pl-14 pr-14 py-2.5 text-sm bg-muted/40 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setRepayInput(state.position.totalDebt)}
                    className="absolute inset-y-0 right-2.5 my-auto h-6 px-2 text-xs font-semibold text-primary bg-primary/10 rounded hover:bg-primary/20 transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              {repayAmt > 0 && !repayExceedsDisplayTolerance && (
                <div className="flex items-center gap-4 text-sm pb-0.5">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-0.5">Remaining Debt</p>
                    {remainingDebt === 0 ? (
                      <p className="font-semibold text-green-500">Fully Repaid</p>
                    ) : (
                      <p className="font-semibold">
                        <span className="text-muted-foreground line-through mr-1 text-xs">
                          ${totalDebt.toFixed(2)}
                        </span>
                        ${remainingDebt.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Health Factor
                    </p>
                    <p className={`font-semibold ${newHealthFactor === 0 ? "text-green-500" : healthColor(newHealthFactor)}`}>
                      {newHealthFactor === 0 ? "∞" : newHealthFactor.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleRepayClick}
                disabled={state.isBusy || repayAmt <= 0 || repayExceedsDisplayTolerance}
                className="shrink-0 px-5 py-2.5 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Repay
              </button>
            </div>

            {repayExceedsDisplayTolerance && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                <CircleAlert className="w-3.5 h-3.5 flex-shrink-0" />
                Amount exceeds total debt of ${totalDebt.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
