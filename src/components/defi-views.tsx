"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  DollarSign,
  Loader2,
  Search,
  Shield,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { DEPLOYMENT } from "@/lib/contracts";
import { playClickSound, shortAddress, toNumber, useDefi } from "@/components/defi-state";

export function HomeRouteView() {
  const { account } = useDefi();

  const features = [
    { icon: <TrendingUp className="h-7 w-7 text-slate-800" />, title: "High APY Returns", description: "Earn up to 15% APY on your crypto assets" },
    { icon: <Shield className="h-7 w-7 text-slate-800" />, title: "Secure & Trustless", description: "Smart contract secured, non-custodial platform" },
    { icon: <DollarSign className="h-7 w-7 text-slate-800" />, title: "Instant Liquidity", description: "Access funds anytime with collateral-based lending" },
  ];

  if (!account) {
    return (
      <div className="space-y-10 pt-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-slate-100">
            <Wallet className="h-14 w-14 text-[#0b0b23]" />
          </div>
          <h2 className="mb-3 text-4xl font-semibold text-slate-900">Welcome to CryptoLend</h2>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-500">
            Connect your MetaMask wallet to start earning passive income through lending and staking
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">{feature.icon}</div>
              <h3 className="mb-3 text-3xl font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-base leading-relaxed text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-3 text-4xl font-semibold text-slate-900">Choose Your DeFi Strategy</h2>
        <p className="text-lg text-slate-500">
          Select lending to borrow USDT against your crypto, or staking to earn rewards by locking your assets
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <StrategyCard
          href="/lend"
          icon={<DollarSign className="h-9 w-9 text-blue-600" />}
          title="Lending"
          description="Use your crypto as collateral to borrow USDT instantly. Keep your assets while accessing liquidity."
          rows={[["Interest Rate", "From 4%"], ["Max LTV", "Up to 75%"], ["Supported Assets", "ETH, BTC, SOL"]]}
        />
        <StrategyCard
          href="/stake"
          icon={<TrendingUp className="h-9 w-9 text-purple-600" />}
          title="Staking"
          description="Lock your crypto to earn passive rewards. Rewards are distributed based on daily-basis."
          rows={[["APY Range", "7.8% - 15.2%"], ["Lock Periods", "Flexible"], ["Rewards", "Daily"]]}
        />
      </div>
    </div>
  );
}

export function LendingRouteView() {
  const state = useDefi();
  if (!state.account) return <WalletConnectionPrompt title="Connect Your Wallet" message="Please connect your wallet to access lending services" icon={<DollarSign className="h-14 w-14 text-[#0b0b23]" />} />;
  const healthFactor = state.healthFactor > 0 ? state.healthFactor.toFixed(2) : "-";
  return (
    <div className="space-y-6">
      <SectionTitle title="Lending" subtitle="Borrow USDT with ETH, BTC, or SOL collateral." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Select Collateral">
          <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input value={state.assetSearch} onChange={(event) => state.setAssetSearch(event.target.value)} placeholder="Search ETH, BTC, or Solana" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {state.visibleAssets.map((asset) => (
              <button key={asset.id} onClick={() => { playClickSound(); state.setSelectedAssetId(asset.id); }} className={`rounded-xl border p-4 text-left ${asset.id === state.selectedAsset.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"}`}>
                <p className="text-xl font-semibold text-slate-900">{asset.name}</p>
                <p className="text-sm text-slate-500">Wallet: {asset.id === state.selectedAsset.id ? state.selectedBalance : "0"} {asset.symbol}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label={`Collateral Amount (${state.selectedAsset.name})`} value={state.collateralAmount} onChange={state.setCollateralAmount} />
            <Input label="Loan Amount (USDT)" value={state.borrowAmount} onChange={state.setBorrowAmount} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ValueRow label="Collateral Value" value={`$${state.collateralValue.toFixed(2)}`} />
            <ValueRow label="Max Borrow" value={`${state.maxBorrow.toFixed(2)} USDT`} />
            <ValueRow label="Health Factor" value={healthFactor} />
          </div>
          {state.needsCollateralApproval && <ActionButton disabled={!state.account || state.isBusy} busy={state.isBusy} onClick={state.approveCollateral}>Approve {state.selectedAsset.name}</ActionButton>}
          <ActionButton disabled={!state.account || state.isBusy || state.needsCollateralApproval} busy={state.isBusy} onClick={state.borrow}>Borrow USDT</ActionButton>
        </Card>

        <Card title="Manage Loan">
          <Input label="Repay Amount (USDT)" value={state.repayAmount} onChange={state.setRepayAmount} />
          <div className="space-y-2">
            <ValueRow label="Borrowed" value={`${state.position.borrowed} USDT`} />
            <ValueRow label="Accrued Interest" value={`${state.position.accruedInterest} USDT`} />
            <ValueRow label="Total Debt" value={`${state.position.totalDebt} USDT`} />
          </div>
          <ActionButton disabled={!state.account || state.isBusy || (!state.needsRepayApproval && !state.needsFullRepayApproval)} busy={state.isBusy} onClick={state.approveRepay}>Approve Repay</ActionButton>
          <ActionButton disabled={!state.account || state.isBusy || state.needsRepayApproval || toNumber(state.position.borrowed) <= 0} busy={state.isBusy} onClick={state.repayLoan}>Repay Amount</ActionButton>
          <ActionButton disabled={!state.account || state.isBusy || state.needsFullRepayApproval || toNumber(state.position.borrowed) <= 0} busy={state.isBusy} onClick={state.repayFullLoan}>Repay Full Loan</ActionButton>
        </Card>
      </div>
    </div>
  );
}

export function StakingRouteView() {
  const state = useDefi();
  if (!state.account) return <WalletConnectionPrompt title="Connect Your Wallet" message="Please connect your wallet to access staking services" icon={<TrendingUp className="h-14 w-14 text-[#0b0b23]" />} />;
  return (
    <div className="space-y-6">
      <SectionTitle title="Stake USDT" subtitle="Supply liquidity to the protocol and claim rewards." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Investor Staking">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <ValueRow label="Wallet USDT" value={`${state.usdtBalance} USDT`} />
            <ValueRow label="Staked" value={`${state.position.staked} USDT`} />
            <ValueRow label="Pending Reward" value={`${state.position.pendingReward} USDT`} />
          </div>
          <Input label="Stake Amount (USDT)" value={state.stakeAmount} onChange={state.setStakeAmount} />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <ValueRow label="APY" value="12%" />
            <ValueRow label="Est. Daily Reward" value={`${state.dailyReward.toFixed(4)} USDT`} />
            <ValueRow label="Est. Yearly Reward" value={`${state.yearlyReward.toFixed(2)} USDT`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton disabled={!state.account || state.isBusy || !state.needsStakeApproval} busy={state.isBusy && state.needsStakeApproval} onClick={state.approveStake}>Approve USDT</ActionButton>
            <ActionButton disabled={!state.account || state.isBusy || state.needsStakeApproval} busy={state.isBusy && !state.needsStakeApproval} onClick={state.stake}>Stake USDT</ActionButton>
          </div>
        </Card>

        <Card title="Manage Stake">
          <Input label="Unstake Amount (USDT)" value={state.unstakeAmount} onChange={state.setUnstakeAmount} />
          <ActionButton disabled={!state.account || state.isBusy || toNumber(state.position.pendingReward) <= 0} busy={state.isBusy} onClick={state.claimRewards}>Claim Rewards</ActionButton>
          <ActionButton disabled={!state.account || state.isBusy || toNumber(state.position.staked) <= 0} busy={state.isBusy} onClick={state.unstake}>Unstake</ActionButton>
        </Card>
      </div>
    </div>
  );
}

export function DashboardProtocolView() {
  const { account, poolLiquidity, totalBorrowed } = useDefi();
  if (!account) return <WalletConnectionPrompt title="Connect Your Wallet" message="Please connect your wallet to access protocol dashboard" icon={<Database className="h-14 w-14 text-[#0b0b23]" />} />;
  const liquidity = toNumber(poolLiquidity);
  const borrowed = toNumber(totalBorrowed);
  const available = Math.max(liquidity - borrowed, 0);
  const utilPct = liquidity > 0 ? Math.min(Math.round((borrowed / liquidity) * 100), 100) : 0;
  const collateralRows = [
    { symbol: "BTC", name: "Bitcoin", amount: "48.32 BTC", usdValue: "$3,140,800", share: 33, color: "bg-orange-500" },
    { symbol: "ETH", name: "Ethereum", amount: "1,240.5 ETH", usdValue: "$3,969,600", share: 41, color: "bg-indigo-500" },
    { symbol: "SOL", name: "Solana", amount: "22,800 SOL", usdValue: "$2,508,000", share: 26, color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-semibold text-slate-900">Protocol Overview</h2>
        <p className="mt-2 text-lg text-slate-500">Lending pool liquidity and collateral breakdown</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-3xl font-semibold text-slate-900">USDT Lending Pool</h3>
            <p className="text-sm text-slate-500">Tether USD · ERC-20 · Borrow asset</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Contract <span className="ml-2 font-mono text-slate-900">{`${DEPLOYMENT.mockUsdt.slice(0, 8)}...${DEPLOYMENT.mockUsdt.slice(-6)}`}</span>
          </div>
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Liquidity" value={`$${(liquidity / 1_000_000).toFixed(2)}M`} sub="USDT" />
          <StatCard label="Available to Borrow" value={`$${(available / 1_000_000).toFixed(2)}M`} sub="USDT" valueClass="text-green-600" />
          <StatCard label="Total Borrowed" value={`$${(borrowed / 1_000_000).toFixed(2)}M`} sub="USDT" valueClass="text-orange-600" />
          <StatCard label="Borrow APY" value="12.5%" sub="Variable" valueClass="text-emerald-600" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500"><span>Pool Utilisation</span><span>{utilPct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-green-500" style={{ width: `${utilPct}%` }} /></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-semibold text-slate-900">Accepted Collateral</h3>
          <p className="text-sm text-slate-500">Total collateral value: <span className="font-semibold text-slate-900">$9,618,400</span></p>
        </div>
        <div className="divide-y divide-slate-200">
          {collateralRows.map((row) => (
            <div key={row.symbol} className="grid items-center gap-4 px-6 py-4 md:grid-cols-[100px_1fr_1fr_1fr]">
              <div><p className="text-2xl font-semibold text-slate-900">{row.symbol}</p><p className="text-sm text-slate-500">{row.name}</p></div>
              <div><p className="text-sm text-slate-500">Amount Locked</p><p className="text-lg font-semibold text-slate-900">{row.amount}</p></div>
              <div><p className="text-sm text-slate-500">USD Value</p><p className="text-lg font-semibold text-slate-900">{row.usdValue}</p></div>
              <div><p className="mb-2 text-sm text-slate-500">Pool Share</p><div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${row.color}`} style={{ width: `${row.share}%` }} /></div><span className="w-10 text-right text-sm font-semibold text-slate-700">{row.share}%</span></div></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function DashboardTransactionsView() {
  const state = useDefi();
  if (!state.account) return <WalletConnectionPrompt title="Connect Your Wallet" message="Please connect your wallet to access transaction dashboard" icon={<Wallet className="h-14 w-14 text-[#0b0b23]" />} />;
  const totalDebt = toNumber(state.position.borrowed) + toNumber(state.position.accruedInterest);
  const collateralUsd = toNumber(state.position.collateral) * 100;
  const healthFactor = totalDebt > 0 ? collateralUsd / totalDebt : 0;

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-100 to-violet-100 p-6">
        <h2 className="text-3xl font-semibold text-slate-900">Portfolio Overview</h2>
        <p className="mb-6 text-lg text-slate-600">All your active positions in one place</p>
        <div className="grid gap-6 sm:grid-cols-4">
          <div><p className="text-sm text-slate-500">Total Value</p><p className="text-3xl font-semibold text-slate-900">${Math.round(state.portfolioValue).toLocaleString()}</p></div>
          <div><p className="text-sm text-slate-500">Borrowed USDT</p><p className="text-3xl font-semibold text-slate-900">{toNumber(state.position.borrowed) > 0 ? "1" : "0"}</p></div>
          <div><p className="text-sm text-slate-500">Staked USDT</p><p className="text-3xl font-semibold text-slate-900">${toNumber(state.position.staked).toLocaleString()}</p></div>
          <div><p className="text-sm text-slate-500">Unclaimed Rewards</p><p className="text-3xl font-semibold text-slate-900">${toNumber(state.position.pendingReward).toFixed(2)}</p></div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-3xl font-semibold text-slate-900">Current Staking</h3>
            <Link href="/stake" className="text-sm text-slate-500 hover:text-slate-900">View pool →</Link>
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <StatCard label="Staked USDT" value={toNumber(state.position.staked).toLocaleString()} sub={`≈ $${toNumber(state.position.staked).toLocaleString()}`} />
            <StatCard label="Unclaimed Rewards" value={toNumber(state.position.pendingReward).toFixed(4)} sub="USDT" valueClass="text-green-600" />
          </div>
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex justify-between border-b border-slate-200 px-4 py-3"><span className="text-slate-600">Pool</span><span className="font-semibold text-slate-900">USDT Liquidity Pool</span></div>
            <div className="flex justify-between px-4 py-3"><span className="text-slate-600">APY</span><span className="font-semibold text-green-600">12.5%</span></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => void state.claimRewards()} disabled={!state.account || state.isBusy || toNumber(state.position.pendingReward) <= 0} className="rounded-xl bg-green-500 px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Claim Rewards</button>
            <button onClick={() => void state.unstake()} disabled={!state.account || state.isBusy || toNumber(state.position.staked) <= 0} className="rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Unstake</button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-3xl font-semibold text-slate-900">Current Lending</h3>
            <Link href="/lend" className="text-sm text-slate-500 hover:text-slate-900">View loan →</Link>
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <StatCard label="Collateral" value={`${state.position.collateral} ETH`} sub={`≈ $${collateralUsd.toLocaleString()}`} />
            <StatCard label="Total Debt" value={`$${totalDebt.toFixed(2)}`} sub="USDT" valueClass="text-orange-600" />
          </div>
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex justify-between border-b border-slate-200 px-4 py-3"><span className="text-slate-600">Loan Amount</span><span className="font-semibold text-slate-900">${toNumber(state.position.borrowed).toLocaleString()} USDT</span></div>
            <div className="flex justify-between border-b border-slate-200 px-4 py-3"><span className="text-slate-600">Interest (4.0% APR)</span><span className="font-semibold text-slate-900">${toNumber(state.position.accruedInterest).toFixed(2)}</span></div>
            <div className="flex justify-between px-4 py-3"><span className="text-slate-600">Health Factor</span><span className={`font-semibold ${healthFactor > 1.2 ? "text-green-600" : "text-rose-600"}`}>{healthFactor > 0 ? healthFactor.toFixed(2) : "-"}</span></div>
          </div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Repay Amount (USDT)</label>
          <div className="flex items-center gap-2">
            <input value={state.repayAmount} onChange={(event) => state.setRepayAmount(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base" />
            <button onClick={() => state.setRepayAmount(toNumber(state.position.totalDebt).toFixed(4))} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Max</button>
            <button onClick={() => void state.repayLoan()} disabled={!state.account || state.isBusy || state.needsRepayApproval || toNumber(state.position.borrowed) <= 0} className="rounded-xl bg-slate-500 px-5 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Repay</button>
          </div>
          {state.needsRepayApproval && <button onClick={() => void state.approveRepay()} disabled={!state.account || state.isBusy} className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100">Approve USDT First</button>}
        </section>
      </div>
    </div>
  );
}

export function DashboardHistoryView() {
  const { account, borrowHistory, repayHistory, stakingHistory } = useDefi();
  if (!account) return <WalletConnectionPrompt title="Connect Your Wallet" message="Please connect your wallet to access history dashboard" icon={<Database className="h-14 w-14 text-[#0b0b23]" />} />;
  const txRows = [
    ...borrowHistory.map((item) => ({ id: `borrow-${item.id}`, type: "Borrow", sign: "+", amount: `${toNumber(item.borrowAmount).toFixed(2)} USDT`, amountColor: "text-orange-600", detail: `Collateral ${item.collateralAmount} ${item.collateralSymbol || "ETH"} - Borrowed ${item.borrowAmount} USDT`, txHash: item.txHash, createdAt: item.createdAt })),
    ...repayHistory.map((item) => ({ id: `repay-${item.id}`, type: "Repay", sign: "-", amount: `${toNumber(item.amount).toFixed(2)} USDT`, amountColor: "text-blue-600", detail: `Paid ${item.amount} USDT - Interest ${item.interestPaid} USDT - Principal ${item.principalPaid} USDT`, txHash: item.txHash, createdAt: item.createdAt })),
    ...stakingHistory.map((item) => ({ id: `stake-${item.id}`, type: item.action === "CLAIM" ? "Claim Rewards" : "Stake", sign: "+", amount: item.action === "CLAIM" ? `${toNumber(item.rewardAmount).toFixed(2)} USDT` : `${toNumber(item.amount).toFixed(2)} USDT`, amountColor: item.action === "CLAIM" ? "text-purple-600" : "text-green-600", detail: `Amount ${item.amount} USDT - Reward ${item.rewardAmount} USDT`, txHash: item.txHash, createdAt: item.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalBorrowed = borrowHistory.reduce((sum, item) => sum + toNumber(item.borrowAmount), 0);
  const totalStaked = stakingHistory.filter((item) => item.action === "STAKE").reduce((sum, item) => sum + toNumber(item.amount), 0);
  const totalRepaid = repayHistory.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const rewardsClaimed = stakingHistory.filter((item) => item.action === "CLAIM").reduce((sum, item) => sum + toNumber(item.rewardAmount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-4xl font-semibold text-slate-900">History</h2>
        <p className="mt-2 text-lg text-slate-500">Full record of all on-chain activity for your wallet</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <HistoryStat label="Total Borrowed" value={`$${totalBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="text-orange-600" />
        <HistoryStat label="Total Staked" value={`$${totalStaked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="text-green-600" />
        <HistoryStat label="Total Repaid" value={`$${totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="text-blue-600" />
        <HistoryStat label="Rewards Claimed" value={`$${rewardsClaimed.toFixed(2)}`} color="text-purple-600" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Tx Hash</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Details</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3">Date & Time</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {txRows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No records yet.</td></tr>
            ) : (
              txRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{`${row.txHash.slice(0, 8)}...${row.txHash.slice(-6)}`}</td>
                  <td className="px-5 py-4 text-base font-semibold text-slate-900">{row.type}</td>
                  <td className="px-5 py-4 text-slate-500">{row.detail}</td>
                  <td className={`px-5 py-4 text-right text-base font-semibold ${row.amountColor}`}>{row.sign}{row.amount}</td>
                  <td className="px-5 py-4 text-slate-500"><p>{new Date(row.createdAt).toLocaleDateString()}</p><p>{new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></td>
                  <td className="px-5 py-4"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-600">Confirmed</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-4xl font-semibold text-slate-900">{title}</h2><p className="mt-2 text-lg text-slate-500">{subtitle}</p></div>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="mb-4 text-2xl font-semibold text-slate-900">{title}</h3>{children}</section>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base" inputMode="decimal" />
    </label>
  );
}

function ActionButton({ children, disabled, busy, onClick }: { children: ReactNode; disabled: boolean; busy?: boolean; onClick: () => Promise<void> | void }) {
  return (
    <button onClick={() => { if (!disabled) playClickSound(); void onClick(); }} disabled={disabled} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b0b23] px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-100 px-4 py-3"><p className="text-sm text-slate-500">{label}</p><p className="text-base font-semibold text-slate-900">{value}</p></div>;
}

function StrategyCard({ href, icon, title, description, rows }: { href: string; icon: ReactNode; title: string; description: string; rows: string[][] }) {
  return (
    <Link href={href} onClick={() => playClickSound()} className="rounded-2xl border border-slate-200 bg-white p-8 transition hover:shadow-md">
      <div className="mb-8 flex items-start justify-between">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100">{icon}</div>
        <ArrowRight className="h-6 w-6 text-slate-500" />
      </div>
      <h3 className="mb-3 text-3xl font-semibold text-slate-900">{title}</h3>
      <p className="mb-6 text-base leading-relaxed text-slate-500">{description}</p>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
            <span className="text-sm text-slate-600">{label}</span>
            <span className="text-sm font-semibold text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

function StatCard({ label, value, sub, valueClass }: { label: string; value: string; sub: string; valueClass?: string }) {
  return <div className="rounded-xl bg-slate-100 px-4 py-4"><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-2xl font-semibold text-slate-900 ${valueClass || ""}`}>{value}</p><p className="text-sm text-slate-500">{sub}</p></div>;
}

function HistoryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-3xl font-semibold ${color}`}>{value}</p></div>;
}

function WalletConnectionPrompt({ title, message, icon }: { title: string; message: string; icon: ReactNode }) {
  return (
    <div className="flex min-h-[58vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-slate-100">{icon}</div>
      <h2 className="mb-3 text-4xl font-semibold text-slate-900">{title}</h2>
      <p className="text-xl text-slate-500">{message}</p>
    </div>
  );
}

export function GlobalAlerts() {
  const { status, error, isMessageClosing, isShaking } = useDefi();
  return (
    <>
      {(status || error) && (
        <div className={`mb-6 grid gap-3 transition duration-700 ${isShaking ? "animate-shake" : ""} ${isMessageClosing ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}>
          {status && <Alert tone="success" text={status} />}
          {error && <Alert tone="error" text={error} />}
        </div>
      )}
    </>
  );
}

function Alert({ tone, text }: { tone: "success" | "error"; text: string }) {
  const isSuccess = tone === "success";
  return <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}><CheckCircle2 className="h-5 w-5" />{text}</div>;
}
