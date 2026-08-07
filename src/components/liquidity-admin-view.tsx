"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Droplets,
  TrendingUp,
  Plus,
  Minus,
  Settings,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Gift,
  History,
  ChevronDown,
  Building2,
  BarChart3,
  X,
  Wallet,
} from "lucide-react";
import { playClickSound, toNumber, useDefi } from "@/components/defi-state";

function UsdtIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="#26A17B" />
      <path
        d="M22.5 17.3v-2.8h5.3v-3.8H12.2v3.8h5.3v2.8C12.1 17.8 8.5 19.3 8.5 21.1c0 1.8 3.6 3.3 9 3.8v8.6h5v-8.6c5.4-.5 9-2 9-3.8 0-1.8-3.6-3.3-9-3.8zm0 5.7v.1c-.2 0-1.2.1-2.5.1s-2.3-.1-2.5-.1v-.1c-4.4-.4-7.7-1.6-7.7-3s3.3-2.6 7.7-3v3.8c.2 0 1.2.1 2.5.1s2.3-.1 2.5-.1v-3.8c4.4.4 7.7 1.6 7.7 3s-3.3 2.6-7.7 3z"
        fill="white"
      />
    </svg>
  );
}

function getPoolHealth(utilPct: number) {
  if (utilPct <= 60)
    return {
      label: "Healthy",
      desc: "Pool has ample liquidity. No action needed.",
      color: "bg-green-500/10 border-green-500/20",
      barColor: "bg-green-500",
      textColor: "text-green-600",
      Icon: CheckCircle2,
    };
  if (utilPct <= 80)
    return {
      label: "Moderate",
      desc: "Utilisation is elevated. Consider adding liquidity soon.",
      color: "bg-yellow-500/10 border-yellow-500/20",
      barColor: "bg-yellow-500",
      textColor: "text-yellow-600",
      Icon: AlertTriangle,
    };
  return {
    label: "Critical",
    desc: "Pool is over-utilised. Add liquidity immediately.",
    color: "bg-red-500/10 border-red-500/20",
    barColor: "bg-red-500",
    textColor: "text-red-600",
    Icon: XCircle,
  };
}

function formatUsdtDisplay(value: string | number) {
  return toNumber(String(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Tab = "liquidity" | "withdrawal" | "parameters";
type Notice = { tone: "success" | "error"; text: string };

function ParameterNotice({ notice }: { notice: Notice }) {
  const isSuccess = notice.tone === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{notice.text}</span>
    </div>
  );
}

export function NewLiquidityAdminView() {
  const state = useDefi();
  const {
    poolLiquidity,
    totalBorrowed,
    account,
    isDarkMode,
    isTreasury,
    protocolReserveUsdt,
    minReserveUsdt,
    companyTreasury,
    stakingApyBps,
    reserveFactorBps,
    borrowApyBps,
    minLiquidityBufferBps,
  } = state;

  const [activeTab, setActiveTab] = useState<Tab>("liquidity");
  const [depositInput, setDepositInput] = useState("");
  const [collateralThresholds, setCollateralThresholds] = useState<
    Record<string, string>
  >({});
  const [parameterNotice, setParameterNotice] = useState<Notice | null>(null);
  const [isParameterNoticeClosing, setIsParameterNoticeClosing] =
    useState(false);
  const [updatingThresholdAsset, setUpdatingThresholdAsset] = useState<
    string | null
  >(null);

  const [withdrawSource, setWithdrawSource] = useState<"reserve" | "treasury">(
    "reserve",
  );

  const liquidity = toNumber(poolLiquidity);
  const borrowed = toNumber(totalBorrowed);
  const reserved = toNumber(protocolReserveUsdt);
  const claimableReserveDisplay = formatUsdtDisplay(companyTreasury.reserve);
  const usableLiquidity = Math.max(liquidity - reserved, 0);
  const available = Math.max(usableLiquidity - borrowed, 0);
  const utilPct =
    usableLiquidity > 0
      ? Math.min(Math.round((borrowed / usableLiquidity) * 100), 100)
      : 0;
  const health = getPoolHealth(utilPct);

  const handleAddLiquidity = () => {
    playClickSound();
    void state.addLiquidity(depositInput);
    setDepositInput("");
  };

  const needsLiquidityApproval = depositInput
    ? toNumber(depositInput) > toNumber(state.usdtAllowance)
    : false;

  const handleClaimReserve = () => {
    playClickSound();
    void state.withdrawReserve(state.companyTreasury.reserve);
  };

  const handleUnstakeTreasury = () => {
    playClickSound();
    void state.unstake(state.companyTreasury.staked);
  };

  const handleClaimTreasuryInterest = () => {
    playClickSound();
    void state.claimRewards();
  };

  const handleThresholdInput = (assetId: string, value: string) => {
    setParameterNotice(null);
    setIsParameterNoticeClosing(false);
    setCollateralThresholds((current) => ({ ...current, [assetId]: value }));
  };

  const handleThresholdUpdate = async (assetId: string) => {
    try {
      playClickSound();
      setUpdatingThresholdAsset(assetId);
      setIsParameterNoticeClosing(false);
      setParameterNotice({
        tone: "success",
        text: `${assetId} threshold update submitted. Waiting for confirmation...`,
      });
      await state.setAssetLiquidationThreshold(
        assetId,
        collateralThresholds[assetId] || "",
      );
      setIsParameterNoticeClosing(false);
      setParameterNotice({
        tone: "success",
        text: `${assetId} liquidation threshold updated to ${collateralThresholds[assetId]}%.`,
      });
    } catch (caught) {
      setIsParameterNoticeClosing(false);
      setParameterNotice({
        tone: "error",
        text:
          caught instanceof Error ? caught.message : "Threshold update failed.",
      });
    } finally {
      setUpdatingThresholdAsset(null);
    }
  };

  useEffect(() => {
    setCollateralThresholds(
      Object.fromEntries(
        state.assets.map((asset) => [
          asset.id,
          (asset.liquidationThresholdBps / 100).toString(),
        ]),
      ),
    );
  }, [state.assets]);

  useEffect(() => {
    if (!parameterNotice) return;
    const fadeTimer = window.setTimeout(
      () => setIsParameterNoticeClosing(true),
      4500,
    );
    const clearTimer = window.setTimeout(() => {
      setParameterNotice(null);
      setIsParameterNoticeClosing(false);
    }, 5200);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [parameterNotice]);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-primary/10 rounded-full mb-6">
          <Droplets className="w-16 h-16 text-primary" />
        </div>
        <h2 className="mb-3">Connect Your Wallet</h2>
        <p className="text-muted-foreground max-w-md">
          Connect your wallet to manage pool liquidity
        </p>
      </div>
    );
  }

  if (!isTreasury) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-destructive/10 rounded-full mb-6">
          <ShieldCheck className="w-16 h-16 text-destructive" />
        </div>
        <h2 className="mb-3">Access Restricted</h2>
        <p className="text-muted-foreground max-w-md">
          Only the treasury wallet can manage pool liquidity.
        </p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Droplets }[] = [
    { id: "liquidity", label: "Manage Liquidity", icon: Droplets },
    { id: "withdrawal", label: "Withdrawal", icon: Minus },
    { id: "parameters", label: "Pool Parameters", icon: Settings },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500 font-medium border border-red-500/20">
              Admin
            </span>
            <h2>Liquidity Pool Management</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage USDT pool liquidity and protocol parameters
          </p>
        </div>
      </div>

      {/* Pool identity */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-4">
          <UsdtIcon size={48} />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">
              Lending Pool
            </p>
            <h3 className="text-lg font-semibold leading-tight">Tether USD</h3>
            <p className="text-sm text-muted-foreground">USDT · ERC-20</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Active</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Total Liquidity",
              value: `$${(liquidity / 1_000_000).toFixed(2)}M`,
              sub: "USDT deposited",
              icon: Droplets,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              label: "Available",
              value: `$${(liquidity / 1_000_000).toFixed(2)}M`,
              sub: "Ready to borrow",
              icon: ShieldCheck,
              color: "text-green-500",
              bg: "bg-green-500/10",
            },
            {
              label: "Total Borrowed",
              value: `$${(borrowed / 1_000_000).toFixed(2)}M`,
              sub: "Outstanding loans",
              icon: TrendingUp,
              color: "text-orange-500",
              bg: "bg-orange-500/10",
            },
            {
              label: "Borrow APY",
              value: `${(toNumber(borrowApyBps) / 100).toFixed(2)}%`,
              sub: "Current rate",
              icon: Settings,
              color: "text-primary",
              bg: "bg-primary/10",
            },
          ].map((s) => (
            <div key={s.label} className="p-4 bg-muted/30 rounded-xl">
              <div className={`p-2 rounded-lg w-fit mb-2.5 ${s.bg}`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <p className="text-xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pool Utilisation</span>
            <span className={`font-semibold ${health.textColor}`}>
              {utilPct}%
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${health.barColor}`}
              style={{ width: `${utilPct}%` }}
            />
          </div>
          <div className="relative h-4 text-xs text-muted-foreground">
            <span className="absolute left-0">0%</span>
            <span
              className="absolute text-yellow-500"
              style={{ left: "60%", transform: "translateX(-50%)" }}
            >
              60%
            </span>
            <span
              className="absolute text-red-500"
              style={{ left: "80%", transform: "translateX(-50%)" }}
            >
              80%
            </span>
            <span className="absolute right-0">100%</span>
          </div>
        </div>
      </div>

      {/* Tabbed panel */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                playClickSound();
                setActiveTab(tab.id);
              }}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px
                ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {activeTab === "liquidity" && (
            <>
              <div
                className={`flex items-start gap-3 p-4 rounded-xl border ${health.color}`}
              >
                <health.Icon
                  className={`w-5 h-5 mt-0.5 shrink-0 ${health.textColor}`}
                />
                <div>
                  <p className={`text-sm font-semibold ${health.textColor}`}>
                    Pool Health: {health.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {health.desc}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Utilisation:{" "}
                      <span className={`font-medium ${health.textColor}`}>
                        {utilPct}%
                      </span>
                    </span>
                    <span>
                      Available:{" "}
                      <span className="font-medium text-foreground">
                        ${liquidity.toLocaleString()} USDT
                      </span>
                    </span>
                    <span>
                      Borrowed:{" "}
                      <span className="font-medium text-foreground">
                        ${borrowed.toLocaleString()} USDT
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[30%_65%] gap-6 items-start">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Pool Health
                  </h3>
                  <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Healthy</span>
                      </div>
                      <span className="text-sm font-medium text-green-500">
                        0–60%
                      </span>
                    </div>
                    <div className="flex items-start justify-between px-4 py-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Moderate</span>
                          <span className="text-xs text-muted-foreground">
                            Consider adding liquidity
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-yellow-500">
                        61–80%
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Critical</span>
                          <span className="text-xs text-muted-foreground">
                            Add liquidity immediately
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-red-500">
                        81–100%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-xl font-semibold">Add Liquidity</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Deposit USDT to increase pool capacity.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Supply APY
                      </p>
                      <p className="text-3xl font-bold text-green-500">
                        {(toNumber(stakingApyBps) / 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <div className="relative mb-5">
                    <div className="absolute inset-y-0 left-4 flex items-center gap-2 pointer-events-none">
                      <UsdtIcon size={20} />
                      <span className="font-medium text-sm">USDT</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={depositInput}
                      onChange={(e) => setDepositInput(e.target.value)}
                      className="w-full h-14 rounded-xl border border-border bg-muted/30 pl-28 pr-5 text-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        playClickSound();
                        void state.approveLiquidity(depositInput);
                      }}
                      disabled={
                        state.isBusy || !depositInput || !needsLiquidityApproval
                      }
                      className="h-14 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      {state.isBusy ? "Approving..." : "Approve USDT"}
                    </button>
                    <button
                      onClick={handleAddLiquidity}
                      disabled={
                        state.isBusy || !depositInput || needsLiquidityApproval
                      }
                      className="h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      {state.isBusy ? "Adding Liquidity..." : "Add Liquidity"}
                    </button>
                  </div>
                  {needsLiquidityApproval && (
                    <p className="text-xs text-muted-foreground">
                      Approve USDT first, then add liquidity.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" /> Protocol
                  Stats
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground">
                      Total Collateral (ETH)
                    </p>
                    <p className="text-xl font-semibold">
                      {toNumber(state.poolCollateral).toFixed(2)} ETH
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground">
                      Total Staked USDT
                    </p>
                    <p className="text-xl font-semibold">
                      ${toNumber(state.totalStaked).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground">Wallet USDT</p>
                    <p className="text-xl font-semibold">
                      ${toNumber(state.usdtBalance).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "withdrawal" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Withdrawal Source</label>
                <div className="relative w-full max-w-sm">
                  <select
                    value={withdrawSource}
                    onChange={(e) => {
                      playClickSound();
                      setWithdrawSource(
                        e.target.value as "reserve" | "treasury",
                      );
                    }}
                    className="w-full appearance-none px-4 py-2.5 pr-10 text-sm bg-muted/40 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option value="reserve">Protocol Reserve Earnings</option>
                    <option value="treasury">Company Treasury</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* ── Protocol Reserve Earnings ── */}
              {withdrawSource === "reserve" && (
                <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">
                        Protocol Reserve Earnings
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Revenue collected from borrower repayments via reserve
                        factor
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">
                          Reserve Factor
                        </p>
                        <p className="text-xl font-semibold">
                          {(toNumber(reserveFactorBps) / 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          of borrower interest retained
                        </p>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">
                          Total Reserve Collected
                        </p>
                        <p className="text-xl font-semibold">
                          ${toNumber(protocolReserveUsdt).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          USDT
                        </p>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">
                          Min Reserve Floor
                        </p>
                        <p className="text-xl font-semibold">
                          ${toNumber(minReserveUsdt).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          USDT kept as buffer
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 rounded-lg text-xs text-muted-foreground">
                      Reserve = Reserve Factor × interest from borrower
                      repayments. Amount above the min reserve floor is
                      claimable by the company treasury.
                    </div>

                    <div className="border-t border-border" />

                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">
                          Claimable Reserve Earnings
                        </p>
                        <p className="text-xl font-semibold text-blue-500">
                          ${claimableReserveDisplay}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          USDT above the min reserve floor
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleClaimReserve}
                    disabled={
                      state.isBusy ||
                      !isTreasury ||
                      toNumber(companyTreasury.reserve) <= 0
                    }
                    className="w-full py-3 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    {isTreasury
                      ? `Claim Reserve Earnings ($${claimableReserveDisplay})`
                      : "Treasury wallet required"}
                  </button>
                </div>
              )}

              {/* ── Company Treasury ── */}
              {withdrawSource === "treasury" && (
                <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Building2 className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">
                        Company Treasury
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Company-owned USDT staked in the lending pool
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-muted/30 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">
                        Deposited USDT
                      </p>
                      <p className="text-xl font-semibold">
                        ${toNumber(companyTreasury.staked).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        USDT
                      </p>
                    </div>
                    <div className="p-4 bg-green-500/5 border border-green-500/15 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">
                        Interest Earned
                      </p>
                      <p className="text-xl font-semibold text-green-500">
                        ${toNumber(companyTreasury.interest).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        USDT
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleUnstakeTreasury}
                      disabled={
                        state.isBusy ||
                        !isTreasury ||
                        toNumber(companyTreasury.staked) <= 0
                      }
                      className="py-3 text-sm rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                    >
                      <Minus className="w-4 h-4" />
                      Unstake ($
                      {toNumber(companyTreasury.staked).toLocaleString()})
                    </button>
                    <button
                      onClick={handleClaimTreasuryInterest}
                      disabled={
                        state.isBusy ||
                        !isTreasury ||
                        toNumber(companyTreasury.interest) <= 0
                      }
                      className="py-3 text-sm rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Building2 className="w-4 h-4" />
                      Claim Interest ($
                      {toNumber(companyTreasury.interest).toLocaleString()})
                    </button>
                  </div>
                  {!isTreasury && (
                    <p className="text-xs text-muted-foreground">
                      Treasury wallet required to unstake and claim interest.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "parameters" && (
            <div className="space-y-6">
              {parameterNotice && (
                <div
                  className={`transition duration-700 ${isParameterNoticeClosing ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
                >
                  <ParameterNotice notice={parameterNotice} />
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold">Pool Parameters</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Protocol-level parameters for the USDT lending pool
                  </p>
                </div>
                <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-500">
                  Treasury Controls
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  {
                    label: "Borrow APY",
                    value: `${(toNumber(borrowApyBps) / 100).toFixed(2)}%`,
                    sub: "Read-only",
                    icon: TrendingUp,
                    color: "text-blue-500",
                    bg: "bg-blue-500/10",
                  },
                  {
                    label: "Supply APY",
                    value: `${(toNumber(stakingApyBps) / 100).toFixed(2)}%`,
                    sub: "Read-only",
                    icon: TrendingUp,
                    color: "text-green-500",
                    bg: "bg-green-500/10",
                  },
                  {
                    label: "Reserve Factor",
                    value: `${(toNumber(reserveFactorBps) / 100).toFixed(1)}%`,
                    sub: "Read-only",
                    icon: ShieldCheck,
                    color: "text-purple-500",
                    bg: "bg-purple-500/10",
                  },
                  {
                    label: "Min Liquidity Buffer",
                    value: `${(toNumber(minLiquidityBufferBps) / 100).toFixed(1)}%`,
                    sub: "Read-only",
                    icon: ShieldCheck,
                    color: "text-amber-500",
                    bg: "bg-amber-500/10",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-muted/20 p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`rounded-lg p-2 ${item.bg}`}>
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                        {item.sub}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {item.label}
                    </p>
                    <p className="text-2xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold">
                    Collateral Liquidation Thresholds
                  </h5>
                  <span className="text-xs text-muted-foreground">
                    Editable
                  </span>
                </div>
                {state.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-36 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                          {asset.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {asset.symbol}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Current:{" "}
                            {(asset.liquidationThresholdBps / 100).toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-1 items-end gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">
                            Liquidation Threshold
                          </p>
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-muted-foreground">
                              %
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={collateralThresholds[asset.id] || ""}
                              onChange={(event) =>
                                handleThresholdInput(
                                  asset.id,
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 pr-9 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => void handleThresholdUpdate(asset.id)}
                          disabled={
                            state.isBusy || updatingThresholdAsset === asset.id
                          }
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingThresholdAsset === asset.id
                            ? "Updating..."
                            : "Update"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Borrow APY, supply APY, reserve factor and liquidity buffer are
                read-only. Collateral thresholds update the on-chain liquidation
                risk calculations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
