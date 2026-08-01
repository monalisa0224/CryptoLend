"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Droplets, TrendingUp, Plus, Minus, Settings, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Gift, History, ChevronDown, Building2, BarChart3, X, Wallet,
} from "lucide-react";
import { playClickSound, toNumber, useDefi } from "@/components/defi-state";

function UsdtIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="#26A17B" />
      <path d="M22.5 17.3v-2.8h5.3v-3.8H12.2v3.8h5.3v2.8C12.1 17.8 8.5 19.3 8.5 21.1c0 1.8 3.6 3.3 9 3.8v8.6h5v-8.6c5.4-.5 9-2 9-3.8 0-1.8-3.6-3.3-9-3.8zm0 5.7v.1c-.2 0-1.2.1-2.5.1s-2.3-.1-2.5-.1v-.1c-4.4-.4-7.7-1.6-7.7-3s3.3-2.6 7.7-3v3.8c.2 0 1.2.1 2.5.1s2.3-.1 2.5-.1v-3.8c4.4.4 7.7 1.6 7.7 3s-3.3 2.6-7.7 3z" fill="white" />
    </svg>
  );
}

function getPoolHealth(utilPct: number) {
  if (utilPct <= 60) return { label: "Healthy", desc: "Pool has ample liquidity. No action needed.", color: "bg-green-500/10 border-green-500/20", barColor: "bg-green-500", textColor: "text-green-600", Icon: CheckCircle2 };
  if (utilPct <= 80) return { label: "Moderate", desc: "Utilisation is elevated. Consider adding liquidity soon.", color: "bg-yellow-500/10 border-yellow-500/20", barColor: "bg-yellow-500", textColor: "text-yellow-600", Icon: AlertTriangle };
  return { label: "Critical", desc: "Pool is over-utilised. Add liquidity immediately.", color: "bg-red-500/10 border-red-500/20", barColor: "bg-red-500", textColor: "text-red-600", Icon: XCircle };
}

type Tab = "liquidity" | "withdrawal" | "parameters";

export function NewLiquidityAdminView() {
  const state = useDefi();
  const { poolLiquidity, totalBorrowed, account, isDarkMode, isTreasury } = state;

  const [activeTab, setActiveTab] = useState<Tab>("liquidity");
  const [depositInput, setDepositInput] = useState("");
  const [reserveInput] = useState("10");
  const [apyInput] = useState("12.5");
  const [collateralThresholds] = useState({ ETH: "82", BTC: "80", SOL: "75" });

  const liquidity = toNumber(poolLiquidity);
  const borrowed = toNumber(totalBorrowed);
  const available = Math.max(liquidity - borrowed, 0);
  const utilPct = liquidity > 0 ? Math.min(Math.round((borrowed / liquidity) * 100), 100) : 0;
  const health = getPoolHealth(utilPct);

  const handleAddLiquidity = () => {
    playClickSound();
    state.setLiquidityAmount(depositInput);
    void state.addLiquidity();
    setDepositInput("");
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-primary/10 rounded-full mb-6">
          <Droplets className="w-16 h-16 text-primary" />
        </div>
        <h2 className="mb-3">Connect Your Wallet</h2>
        <p className="text-muted-foreground max-w-md">Connect your wallet to manage pool liquidity</p>
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
        <p className="text-muted-foreground max-w-md">Only the treasury wallet can manage pool liquidity.</p>
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
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500 font-medium border border-red-500/20">Admin</span>
            <h2>Liquidity Pool Management</h2>
          </div>
          <p className="text-sm text-muted-foreground">Manage USDT pool liquidity and protocol parameters</p>
        </div>
      </div>

      {/* Pool identity */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-4">
          <UsdtIcon size={48} />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Lending Pool</p>
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
            { label: "Total Liquidity", value: `$${(liquidity / 1_000_000).toFixed(2)}M`, sub: "USDT deposited", icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Available", value: `$${(available / 1_000_000).toFixed(2)}M`, sub: "Ready to borrow", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "Total Borrowed", value: `$${(borrowed / 1_000_000).toFixed(2)}M`, sub: "Outstanding loans", icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10" },
            { label: "Borrow APY", value: `${apyInput}%`, sub: "Current rate", icon: Settings, color: "text-primary", bg: "bg-primary/10" },
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
            <span className={`font-semibold ${health.textColor}`}>{utilPct}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${health.barColor}`} style={{ width: `${utilPct}%` }} />
          </div>
          <div className="relative h-4 text-xs text-muted-foreground">
            <span className="absolute left-0">0%</span>
            <span className="absolute text-yellow-500" style={{ left: "60%", transform: "translateX(-50%)" }}>60%</span>
            <span className="absolute text-red-500" style={{ left: "80%", transform: "translateX(-50%)" }}>80%</span>
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
              onClick={() => { playClickSound(); setActiveTab(tab.id); }}
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
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${health.color}`}>
                <health.Icon className={`w-5 h-5 mt-0.5 shrink-0 ${health.textColor}`} />
                <div>
                  <p className={`text-sm font-semibold ${health.textColor}`}>Pool Health: {health.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{health.desc}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>Utilisation: <span className={`font-medium ${health.textColor}`}>{utilPct}%</span></span>
                    <span>Available: <span className="font-medium text-foreground">${available.toLocaleString()} USDT</span></span>
                    <span>Borrowed: <span className="font-medium text-foreground">${borrowed.toLocaleString()} USDT</span></span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[30%_65%] gap-6 items-start">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Pool Health</h3>
                  <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-sm font-medium">Healthy</span></div>
                      <span className="text-sm font-medium text-green-500">0–60%</span>
                    </div>
                    <div className="flex items-start justify-between px-4 py-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                        <div className="flex flex-col"><span className="text-sm font-medium">Moderate</span><span className="text-xs text-muted-foreground">Consider adding liquidity</span></div>
                      </div>
                      <span className="text-sm font-medium text-yellow-500">61–80%</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500 mt-0.5" /><div className="flex flex-col"><span className="text-sm font-medium">Critical</span><span className="text-xs text-muted-foreground">Add liquidity immediately</span></div></div>
                      <span className="text-sm font-medium text-red-500">81–100%</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-xl font-semibold">Add Liquidity</h3>
                      <p className="text-sm text-muted-foreground mt-1">Deposit USDT to increase pool capacity.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Supply APY</p>
                      <p className="text-3xl font-bold text-green-500">8.5%</p>
                    </div>
                  </div>
                  <div className="relative mb-5">
                    <div className="absolute inset-y-0 left-4 flex items-center gap-2 pointer-events-none">
                      <UsdtIcon size={20} />
                      <span className="font-medium text-sm">USDT</span>
                    </div>
                    <input
                      type="number" min="0" placeholder="0.00"
                      value={depositInput}
                      onChange={(e) => setDepositInput(e.target.value)}
                      className="w-full h-14 rounded-xl border border-border bg-muted/30 pl-28 pr-5 text-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    onClick={handleAddLiquidity}
                    disabled={state.isBusy || !depositInput}
                    className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    {state.isBusy ? "Adding Liquidity..." : "Add Liquidity"}
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" /> Protocol Stats
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground">Total Collateral (ETH)</p>
                    <p className="text-xl font-semibold">{toNumber(state.poolCollateral).toFixed(2)} ETH</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground">Total Staked USDT</p>
                    <p className="text-xl font-semibold">${toNumber(state.totalStaked).toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground">Wallet USDT</p>
                    <p className="text-xl font-semibold">${toNumber(state.usdtBalance).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "withdrawal" && (
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg"><BarChart3 className="w-4 h-4 text-blue-500" /></div>
                  <div>
                    <h4 className="text-sm font-semibold">Protocol Reserve</h4>
                    <p className="text-xs text-muted-foreground">Reserve earnings are managed by the treasury wallet</p>
                  </div>
                </div>
                <button
                  onClick={() => { playClickSound(); void state.claimRewards(); }}
                  disabled={state.isBusy || toNumber(state.position.pendingReward) <= 0}
                  className="w-full py-3 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Claim Rewards (${toNumber(state.position.pendingReward).toFixed(2)})
                </button>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg"><Building2 className="w-4 h-4 text-purple-500" /></div>
                  <div>
                    <h4 className="text-sm font-semibold">Treasury Staking</h4>
                    <p className="text-xs text-muted-foreground">Manage staked position</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Staked USDT</p>
                    <p className="text-xl font-semibold">${toNumber(state.position.staked).toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-green-500/5 border border-green-500/15 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Pending Rewards</p>
                    <p className="text-xl font-semibold text-green-500">${toNumber(state.position.pendingReward).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "parameters" && (
            <div className="space-y-8 max-w-lg">
              <div>
                <h4 className="text-sm font-semibold">Pool Parameters</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Protocol-level parameters for the USDT lending pool</p>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Borrow APY</p>
                  <p className="text-xl font-semibold">{apyInput}%</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Reserve Factor</p>
                  <p className="text-xl font-semibold">{reserveInput}%</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Max LTV (ETH)</p>
                  <p className="text-xl font-semibold">75%</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Parameter changes require smart contract updates via the deployed admin functions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
