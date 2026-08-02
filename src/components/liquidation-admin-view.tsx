"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BrowserProvider, Contract, JsonRpcProvider, encodeBytes32String, formatEther, formatUnits, parseUnits } from "ethers";
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldOff, X, Zap } from "lucide-react";
import { playClickSound, useDefi } from "@/components/defi-state";
import { DEPLOYMENT, LENDING_POOL_ABI, MOCK_USDT_ABI } from "@/lib/contracts";

const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const TARGET_HEALTH_FACTOR = 1.21;
const LIQUIDATION_ELIGIBLE_HEALTH_FACTOR = 1.1;

type RiskStatus = "risk" | "warning" | "healthy";

interface LiquidationPreview {
  assetId: string;
  assetSymbol: string;
  repayAmount: number;
  seizeAmount: number;
  seizeValueUsd: number;
  bonusUsd: number;
  expectedHealthFactor: number;
}

interface Position {
  id: string;
  wallet: string;
  walletLabel: string;
  collateral: string;
  collateralSymbol: string;
  collateralUsd: number;
  debt: number;
  healthFactor: number;
  ltv: number;
  status: RiskStatus;
  liquidatable: boolean;
  preview?: LiquidationPreview;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function riskStatus(healthFactor: number): RiskStatus {
  if (healthFactor <= LIQUIDATION_ELIGIBLE_HEALTH_FACTOR) return "risk";
  if (healthFactor <= 1.2) return "warning";
  return "healthy";
}

function statusLabel(status: RiskStatus) {
  if (status === "risk") return "At Risk";
  if (status === "warning") return "Warning";
  return "Healthy";
}

function HfBadge({ hf }: { hf: number }) {
  const status = riskStatus(hf);
  const color =
    status === "risk"
      ? "bg-red-500/10 text-red-600 border-red-500/20"
      : status === "warning"
        ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
        : "bg-green-500/10 text-green-600 border-green-500/20";

  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>{hf.toFixed(2)}</span>;
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function getBrowserProvider() {
  if (!window.ethereum) throw new Error("MetaMask is not available. Please install MetaMask first.");
  return new BrowserProvider(window.ethereum);
}

export function NewLiquidationAdminView() {
  const state = useDefi();
  const { account, isTreasury } = state;

  const [positions, setPositions] = useState<Position[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [liquidating, setLiquidating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const loadPositions = useCallback(async () => {
    setIsLoading(true);
    setNotice(null);

    try {
      const provider = new JsonRpcProvider(LOCAL_RPC_URL);
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, provider);
      const [ethBorrowLogs, tokenBorrowLogs, closeFactorRaw, bonusRaw, thresholdEntries] = await Promise.all([
        pool.queryFilter(pool.filters.Borrowed(), 0, "latest"),
        pool.queryFilter(pool.filters.TokenBorrowed(), 0, "latest"),
        pool.LIQUIDATION_CLOSE_FACTOR_BPS(),
        pool.LIQUIDATION_BONUS_BPS(),
        Promise.all(
          state.assets.map(async (asset) => {
            if (asset.id === "ETH") {
              return [asset.id, Number(await pool.ethLiquidationThresholdBps())] as const;
            }

            const configured = await pool.collateralAssets(encodeBytes32String(asset.id));
            return [asset.id, Number(configured.liquidationThresholdBps ?? configured[3])] as const;
          }),
        ),
      ]);

      const closeFactor = Number(closeFactorRaw) / 10000;
      const bonusFactor = Number(bonusRaw) / 10000;
      const liquidationThresholds = Object.fromEntries(thresholdEntries);
      const thresholdForAsset = (assetId: string) => (liquidationThresholds[assetId] ?? 0) / 10000;
      const borrowers = new Set<string>();

      for (const log of [...ethBorrowLogs, ...tokenBorrowLogs]) {
        const eventLog = log as unknown as { args?: { borrower?: string } };
        if (eventLog.args?.borrower) borrowers.add(eventLog.args.borrower);
      }

      const nextPositions = await Promise.all(
        [...borrowers].map(async (wallet) => {
          const [loan, riskData] = await Promise.all([
            pool.positions(wallet),
            pool.getBorrowerRiskData(wallet),
          ]);

          const collateralUsd = Number(formatUnits(riskData.collateralValueUsdt, 6));
          const liquidationValueUsd = Number(formatUnits(riskData.liquidationValueUsdt, 6));
          const debt = Number(formatUnits(riskData.debtUsdt, 6));
          if (debt <= 0 || collateralUsd <= 0) return null;

          const collateralParts: string[] = [];
          const collateralSymbols: string[] = [];
          const options: { assetId: string; symbol: string; valueUsd: number; threshold: number }[] = [];

          const ethCollateral = Number(formatEther(loan.collateralWei));
          if (ethCollateral > 0) {
            const ethValue = Number(formatUnits(await pool.getCollateralValueUsdt(loan.collateralWei), 6));
            collateralParts.push(`${ethCollateral.toFixed(4)} ETH`);
            collateralSymbols.push("ETH");
            options.push({ assetId: "ETH", symbol: "ETH", valueUsd: ethValue, threshold: thresholdForAsset("ETH") });
          }

          for (const asset of state.assets.filter((item) => item.type === "erc20")) {
            const assetKey = encodeBytes32String(asset.id);
            const collateralRaw = await pool.tokenCollateral(wallet, assetKey);
            const collateralAmount = Number(formatUnits(collateralRaw, asset.decimals));
            if (collateralAmount <= 0) continue;

            const tokenValue = Number(formatUnits(await pool.getTokenCollateralValueUsdt(assetKey, collateralRaw), 6));
            collateralParts.push(`${collateralAmount.toFixed(4)} ${asset.symbol}`);
            collateralSymbols.push(asset.symbol);
            options.push({ assetId: asset.id, symbol: asset.symbol, valueUsd: tokenValue, threshold: thresholdForAsset(asset.id) });
          }

          const healthFactor = Number(riskData.healthFactorBps) / 10000;
          const status = riskStatus(healthFactor);
          const liquidationAsset = [...options].sort((a, b) => b.valueUsd - a.valueUsd)[0];
          let preview: LiquidationPreview | undefined;

          if (status === "risk" && liquidationAsset) {
            const maxDebtRepay = debt * closeFactor;
            const maxCollateralRepay = liquidationAsset.valueUsd / (1 + bonusFactor);
            const seizeLiquidationWeight = (1 + bonusFactor) * liquidationAsset.threshold;
            const targetRepay = TARGET_HEALTH_FACTOR > seizeLiquidationWeight
              ? ((TARGET_HEALTH_FACTOR * debt) - liquidationValueUsd) / (TARGET_HEALTH_FACTOR - seizeLiquidationWeight)
              : maxDebtRepay;
            const repayAmount = Math.max(Math.min(Math.max(targetRepay, 0), maxDebtRepay, maxCollateralRepay), 0);

            if (repayAmount > 0.000001) {
              const repayRaw = parseUnits(repayAmount.toFixed(6), 6);
              const assetKey = encodeBytes32String(liquidationAsset.assetId);
              const [seizeRaw, seizeValueRaw, bonusUsdtRaw] = await pool.previewLiquidation(wallet, assetKey, repayRaw);
              const seizeValueUsd = Number(formatUnits(seizeValueRaw, 6));
              const bonusUsd = Number(formatUnits(bonusUsdtRaw, 6));
              const remainingDebt = debt - repayAmount;
              const expectedLiquidationValue = liquidationValueUsd - seizeValueUsd * liquidationAsset.threshold;
              const expectedHealthFactor = remainingDebt > 0 ? expectedLiquidationValue / remainingDebt : Number.POSITIVE_INFINITY;
              const assetMeta = state.assets.find((asset) => asset.id === liquidationAsset.assetId);
              const seizeAmount = liquidationAsset.assetId === "ETH"
                ? Number(formatEther(seizeRaw))
                : Number(formatUnits(seizeRaw, assetMeta?.decimals ?? 18));

              preview = {
                assetId: liquidationAsset.assetId,
                assetSymbol: liquidationAsset.symbol,
                repayAmount,
                seizeAmount,
                seizeValueUsd,
                bonusUsd,
                expectedHealthFactor,
              };
            }
          }

          return {
            id: wallet,
            wallet,
            walletLabel: shortAddress(wallet),
            collateral: collateralParts.join(", "),
            collateralSymbol: collateralSymbols.length === 1 ? collateralSymbols[0] : "Mixed",
            collateralUsd,
            debt,
            healthFactor,
            ltv: (debt / collateralUsd) * 100,
            status,
            liquidatable: status === "risk" && Boolean(preview),
            preview,
          } satisfies Position;
        }),
      );

      const activePositions: Position[] = [];
      for (const position of nextPositions) {
        if (position) activePositions.push(position);
      }
      setPositions(activePositions);
    } catch (caught) {
      setNotice({ tone: "error", text: caught instanceof Error ? caught.message : "Unable to load on-chain borrowing positions." });
      setPositions([]);
    } finally {
      setIsLoading(false);
    }
  }, [state.assets]);

  useEffect(() => {
    if (!account || !isTreasury) return;
    void loadPositions();
  }, [account, isTreasury, loadPositions]);

  const filtered = positions.filter(
    (p) => p.wallet.toLowerCase().includes(search.toLowerCase()) || p.collateralSymbol.toLowerCase().includes(search.toLowerCase())
  );

  const atRisk = useMemo(() => positions.filter((p) => p.status === "risk"), [positions]);
  const warning = useMemo(() => positions.filter((p) => p.status === "warning"), [positions]);
  const healthy = useMemo(() => positions.filter((p) => p.status === "healthy"), [positions]);

  const confirmLiquidation = async () => {
    if (!selectedPosition?.preview) return;

    try {
      playClickSound();
      setLiquidating(selectedPosition.id);
      setNotice(null);

      const provider = await getBrowserProvider();
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const usdt = new Contract(DEPLOYMENT.mockUsdt, MOCK_USDT_ABI, signer);
      const pool = new Contract(DEPLOYMENT.lendingPool, LENDING_POOL_ABI, signer);
      const repayRaw = parseUnits(selectedPosition.preview.repayAmount.toFixed(6), 6);
      const allowance = await usdt.allowance(walletAddress, DEPLOYMENT.lendingPool);

      if (allowance < repayRaw) {
        setNotice({ tone: "success", text: "USDT approval submitted. Waiting for confirmation..." });
        await (await usdt.approve(DEPLOYMENT.lendingPool, repayRaw)).wait();
      }

      setNotice({ tone: "success", text: "Liquidation submitted. Waiting for confirmation..." });
      await (
        await pool.liquidate(
          selectedPosition.wallet,
          encodeBytes32String(selectedPosition.preview.assetId),
          repayRaw,
        )
      ).wait();

      setSelectedPosition(null);
      setNotice({ tone: "success", text: `Liquidated ${selectedPosition.walletLabel}. Collateral received: ${selectedPosition.preview.seizeAmount.toFixed(6)} ${selectedPosition.preview.assetSymbol}.` });
      await loadPositions();
    } catch (caught) {
      setNotice({ tone: "error", text: caught instanceof Error ? caught.message : "Liquidation failed." });
    } finally {
      setLiquidating(null);
    }
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-primary/10 rounded-full mb-6">
          <ShieldOff className="w-16 h-16 text-primary" />
        </div>
        <h2 className="mb-3">Connect Your Wallet</h2>
        <p className="text-muted-foreground max-w-md">Connect your wallet to access liquidation tools</p>
      </div>
    );
  }

  if (!isTreasury) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-destructive/10 rounded-full mb-6">
          <ShieldOff className="w-16 h-16 text-destructive" />
        </div>
        <h2 className="mb-3">Access Restricted</h2>
        <p className="text-muted-foreground max-w-md">Only the treasury wallet can trigger collateral liquidation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500 font-medium border border-red-500/20">Admin</span>
          <h2>Trigger Collateral Liquidation</h2>
        </div>
        <p className="text-sm text-muted-foreground">Monitor on-chain borrowing positions and identify liquidation risk</p>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {notice.tone === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-red-500">
            <ShieldOff className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">At Risk</span>
          </div>
          <p className="text-2xl font-semibold text-red-500">{atRisk.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Health factor &lt;= 1.1</p>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-yellow-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Warning Zone</span>
          </div>
          <p className="text-2xl font-semibold text-yellow-600">{warning.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Health factor &gt; 1.1 and &lt;= 1.2</p>
        </div>
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-green-500">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Healthy</span>
          </div>
          <p className="text-2xl font-semibold text-green-500">{healthy.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Health factor &gt; 1.2</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search wallet or asset..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/40 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => { playClickSound(); void loadPositions(); }}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground text-sm rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3">Wallet</th>
              <th className="text-left px-5 py-3">Collateral</th>
              <th className="text-right px-5 py-3">Value (USD)</th>
              <th className="text-right px-5 py-3">Debt (USDT)</th>
              <th className="text-right px-5 py-3">LTV</th>
              <th className="text-center px-5 py-3">Health Factor</th>
              <th className="text-center px-5 py-3">Status</th>
              <th className="text-center px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((pos) => {
              const isLiquidating = liquidating === pos.id;
              return (
                <tr key={pos.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground" title={pos.wallet}>{pos.walletLabel}</td>
                  <td className="px-5 py-4 font-medium">{pos.collateral}</td>
                  <td className="px-5 py-4 text-right">${formatMoney(pos.collateralUsd)}</td>
                  <td className="px-5 py-4 text-right">${formatMoney(pos.debt)}</td>
                  <td className={`px-5 py-4 text-right font-medium ${pos.ltv > 80 ? "text-red-500" : pos.ltv > 65 ? "text-yellow-500" : "text-green-500"}`}>
                    {pos.ltv.toFixed(2)}%
                  </td>
                  <td className="px-5 py-4 text-center"><HfBadge hf={pos.healthFactor} /></td>
                  <td className="px-5 py-4 text-center text-xs font-medium">{statusLabel(pos.status)}</td>
                  <td className="px-5 py-4 text-center">
                    {pos.liquidatable ? (
                      <button
                        onClick={() => { playClickSound(); setSelectedPosition(pos); }}
                        disabled={!!liquidating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        <Zap className="w-3 h-3" />
                        {isLiquidating ? "Processing..." : "Liquidate"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not eligible</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-center text-sm text-muted-foreground" colSpan={8}>
                  No active on-chain borrowing positions found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td className="px-5 py-8 text-center text-sm text-muted-foreground" colSpan={8}>
                  Loading on-chain borrowing positions...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={Boolean(selectedPosition)} onOpenChange={(open) => !open && setSelectedPosition(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <Dialog.Title className="text-lg font-semibold">Confirm Liquidation</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Review the repay amount and collateral reward before submitting.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            {selectedPosition?.preview && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Borrower</p>
                  <p className="font-mono text-sm">{selectedPosition.wallet}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Current Health Factor</p>
                    <p className="text-xl font-semibold text-red-500">{selectedPosition.healthFactor.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Expected Health Factor</p>
                    <p className="text-xl font-semibold text-yellow-500">{selectedPosition.preview.expectedHealthFactor.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Repay Amount</p>
                    <p className="text-xl font-semibold">${formatMoney(selectedPosition.preview.repayAmount)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Liquidation Bonus</p>
                    <p className="text-xl font-semibold text-green-500">${formatMoney(selectedPosition.preview.bonusUsd)}</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-red-500/10 p-4">
                    <p className="text-xs text-muted-foreground">Collateral Received</p>
                    <p className="text-xl font-semibold text-red-500">
                      {selectedPosition.preview.seizeAmount.toFixed(6)} {selectedPosition.preview.assetSymbol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Estimated value ${formatMoney(selectedPosition.preview.seizeValueUsd)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => void confirmLiquidation()}
                  disabled={Boolean(liquidating)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  {liquidating ? "Processing Liquidation..." : "Confirm Liquidation"}
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
