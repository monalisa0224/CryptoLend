"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Lock, TrendingUp, Wallet, Gift, Droplets, CircleDollarSign, X } from "lucide-react";
import { playClickSound, toNumber, useDefi } from "@/components/defi-state";

const USDT_APY = 3.5;

function UsdtIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="#26A17B" />
      <path d="M22.5 17.3v-2.8h5.3v-3.8H12.2v3.8h5.3v2.8C12.1 17.8 8.5 19.3 8.5 21.1c0 1.8 3.6 3.3 9 3.8v8.6h5v-8.6c5.4-.5 9-2 9-3.8 0-1.8-3.6-3.3-9-3.8zm0 5.7v.1c-.2 0-1.2.1-2.5.1s-2.3-.1-2.5-.1v-.1c-4.4-.4-7.7-1.6-7.7-3s3.3-2.6 7.7-3v3.8c.2 0 1.2.1 2.5.1s2.3-.1 2.5-.1v-3.8c4.4.4 7.7 1.6 7.7 3s-3.3 2.6-7.7 3z" fill="white" />
    </svg>
  );
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="flex-1 min-w-0 p-5 bg-card rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-3 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-semibold ${accent ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export function NewStakingView() {
  const state = useDefi();

  const [stakeInput, setStakeInput] = useState("");
  const [stakeModalOpen, setStakeModalOpen] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const stakeAmount = toNumber(stakeInput);
  const dailyReward = stakeAmount > 0 ? (stakeAmount * USDT_APY) / 100 / 365 : 0;
  const yearlyReward = stakeAmount > 0 ? (stakeAmount * USDT_APY) / 100 : 0;
  const stakedBalance = toNumber(state.position.staked);
  const unclaimedRewards = toNumber(state.position.pendingReward);
  const walletUsdt = toNumber(state.usdtBalance);
  const poolLiquidity = toNumber(state.poolLiquidity);
  const needsStakeApproval = stakeInput ? toNumber(stakeInput) > toNumber(state.usdtAllowance) : false;

  const handleStake = async () => {
    if (!state.account) return;
    setIsStaking(true);
    await state.stake(stakeInput);
    setIsStaking(false);
    setStakeModalOpen(false);
    setStakeInput("");
  };

  const handleApprove = async () => {
    if (!state.account) return;
    setIsApproving(true);
    await state.approveStake(stakeInput);
    setIsApproving(false);
  };

  const handleUnstake = async () => {
    if (stakedBalance <= 0) return;
    setIsUnstaking(true);
    await state.unstake(String(stakedBalance));
    setIsUnstaking(false);
  };

  const handleClaim = async () => {
    if (unclaimedRewards <= 0) return;
    setIsClaiming(true);
    await state.claimRewards();
    setIsClaiming(false);
  };

  if (!state.account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-primary/10 rounded-full mb-6">
          <Lock className="w-16 h-16 text-primary" />
        </div>
        <h2 className="mb-3">Connect Your Wallet</h2>
        <p className="text-muted-foreground max-w-md">
          Please connect your wallet to access the USDT staking pool
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h2>USDT Liquidity Pool</h2>
        <p className="text-sm text-muted-foreground">Stake USDT and earn passive yield</p>
      </div>

      {/* Pool Overview */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-4">
          <UsdtIcon size={48} />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Liquidity Pool</p>
            <h3 className="text-lg font-semibold leading-tight">Tether USD</h3>
            <p className="text-sm text-muted-foreground">USDT · ERC-20</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Active</span>
          </div>
        </div>

        <div className="flex gap-4">
          <StatCard
            label="Pool Liquidity"
            value={`$${poolLiquidity.toLocaleString()}`}
            sub="Total USDT deposited"
            icon={<Droplets className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="APY"
            value={`${USDT_APY}%`}
            sub="Variable — updated daily"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            accent="text-green-500"
          />
          <StatCard
            label="Min. Deposit"
            value="$10 USDT"
            sub="No maximum limit"
            icon={<CircleDollarSign className="w-3.5 h-3.5" />}
          />
        </div>

        <div className="border-t border-border" />

        <button
          onClick={() => { playClickSound(); setStakeModalOpen(true); }}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Stake USDT
        </button>
      </div>

      {/* Stake Modal */}
      <Dialog.Root open={stakeModalOpen} onOpenChange={(open) => { setStakeModalOpen(open); if (!open) setStakeInput(""); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 focus:outline-none">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <UsdtIcon size={32} />
                <div>
                  <Dialog.Title className="font-semibold text-base leading-none">Stake USDT</Dialog.Title>
                  <Dialog.Description className="text-xs text-muted-foreground mt-1">USDT Liquidity Pool</Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Amount to Stake</label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Balance:</span>
                  <span className="font-medium text-foreground">
                    {walletUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </span>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center gap-2 pointer-events-none">
                  <UsdtIcon size={18} />
                  <span className="text-sm font-medium text-muted-foreground">USDT</span>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  autoFocus
                  className="w-full pl-24 pr-16 py-4 text-xl font-semibold bg-muted/40 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setStakeInput(String(walletUsdt))}
                  className="absolute inset-y-0 right-4 my-auto h-7 px-2 text-xs font-semibold text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                >
                  Max
                </button>
              </div>
            </div>

            <span className="text-sm font-medium text-muted-foreground">Overview</span>
            <div className="rounded-xl border border-border divide-y divide-border mb-6">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" /> APY
                </span>
                <span className="text-sm font-semibold text-green-500">{USDT_APY}%</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Est. Daily Return</span>
                <span className="text-sm font-semibold">
                  {stakeAmount > 0 ? `+${dailyReward.toFixed(4)} USDT` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Est. Yearly Return</span>
                <span className="text-sm font-semibold text-green-500">
                  {stakeAmount > 0 ? `+${yearlyReward.toFixed(2)} USDT` : "—"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleApprove}
                disabled={isApproving || state.isBusy || stakeAmount <= 0 || !needsStakeApproval}
                className="py-3.5 rounded-xl border border-border font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? "Approving…" : "Approve USDT"}
              </button>
              <button
                onClick={handleStake}
                disabled={isStaking || state.isBusy || stakeAmount <= 0 || needsStakeApproval}
                className="py-3.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStaking ? "Staking…" : `Stake${stakeAmount > 0 ? ` ${stakeAmount.toLocaleString()} USDT` : ""}`}
              </button>
            </div>
            {needsStakeApproval && (
              <p className="text-xs text-muted-foreground">Approve USDT first, then stake.</p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Investor Position */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Your Position</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="w-3.5 h-3.5" />
            {state.account.slice(0, 6)}…{state.account.slice(-4)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-muted/30 rounded-xl space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Staked USDT</p>
            <p className="text-2xl font-semibold">
              {stakedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">≈ ${stakedBalance.toLocaleString()}</p>
            <button
              onClick={() => { playClickSound(); void handleUnstake(); }}
              disabled={isUnstaking || state.isBusy || stakedBalance <= 0}
              className="mt-3 w-full py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isUnstaking ? "Unstaking…" : "Unstake All"}
            </button>
          </div>

          <div className="p-5 bg-green-500/5 rounded-xl border border-green-500/15 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Unclaimed Rewards</p>
            <p className="text-2xl font-semibold text-green-500">
              {unclaimedRewards.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
            <p className="text-xs text-muted-foreground">USDT</p>
            <button
              onClick={() => { playClickSound(); void handleClaim(); }}
              disabled={isClaiming || state.isBusy || unclaimedRewards <= 0}
              className="mt-3 w-full py-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Gift className="w-3.5 h-3.5" />
              {isClaiming ? "Claiming…" : "Claim Rewards"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
