"use client";

import { useState } from "react";
import { AlertTriangle, Search, Zap, ShieldOff, CheckCircle2 } from "lucide-react";
import { playClickSound, toNumber, useDefi } from "@/components/defi-state";

interface Position {
  id: string;
  wallet: string;
  collateral: string;
  collateralSymbol: string;
  collateralUsd: number;
  debt: number;
  healthFactor: number;
  ltv: number;
  liquidatable: boolean;
}

const MOCK_POSITIONS: Position[] = [
  { id: "pos-1", wallet: "0x3f4A…9b12", collateral: "0.82 ETH", collateralSymbol: "ETH", collateralUsd: 2624, debt: 2250, healthFactor: 1.08, ltv: 85, liquidatable: true },
  { id: "pos-2", wallet: "0x7c2B…4d88", collateral: "0.03 BTC", collateralSymbol: "BTC", collateralUsd: 1950, debt: 1600, healthFactor: 1.14, ltv: 82, liquidatable: true },
  { id: "pos-3", wallet: "0xa1D5…2f01", collateral: "2.1 ETH", collateralSymbol: "ETH", collateralUsd: 6720, debt: 3800, healthFactor: 1.65, ltv: 56, liquidatable: false },
  { id: "pos-4", wallet: "0x55eF…8c34", collateral: "140 SOL", collateralSymbol: "SOL", collateralUsd: 15400, debt: 12800, healthFactor: 1.11, ltv: 83, liquidatable: true },
  { id: "pos-5", wallet: "0x9b3C…7a56", collateral: "0.05 BTC", collateralSymbol: "BTC", collateralUsd: 3250, debt: 1200, healthFactor: 2.41, ltv: 36, liquidatable: false },
];

function HfBadge({ hf }: { hf: number }) {
  const color = hf > 1.5 ? "bg-green-500/10 text-green-600 border-green-500/20"
    : hf > 1.2 ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    : "bg-red-500/10 text-red-600 border-red-500/20";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>{hf.toFixed(2)}</span>;
}

export function NewLiquidationAdminView() {
  const state = useDefi();
  const { account } = state;

  const [positions, setPositions] = useState(MOCK_POSITIONS);
  const [search, setSearch] = useState("");
  const [liquidating, setLiquidating] = useState<string | null>(null);
  const [liquidated, setLiquidated] = useState<Set<string>>(new Set());

  const filtered = positions.filter(
    (p) => p.wallet.toLowerCase().includes(search.toLowerCase()) || p.collateralSymbol.toLowerCase().includes(search.toLowerCase())
  );
  const atRisk = positions.filter((p) => p.liquidatable && !liquidated.has(p.id));

  const handleLiquidate = async (pos: Position) => {
    if (!pos.liquidatable) return;
    playClickSound();
    setLiquidating(pos.id);
    await new Promise((r) => setTimeout(r, 1500));
    setLiquidated((prev) => new Set([...prev, pos.id]));
    setLiquidating(null);
  };

  const handleLiquidateAll = async () => {
    const eligible = atRisk;
    if (eligible.length === 0) return;
    for (const pos of eligible) {
      setLiquidating(pos.id);
      await new Promise((r) => setTimeout(r, 800));
      setLiquidated((prev) => new Set([...prev, pos.id]));
    }
    setLiquidating(null);
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

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500 font-medium border border-red-500/20">Admin</span>
          <h2>Trigger Collateral Liquidation</h2>
        </div>
        <p className="text-sm text-muted-foreground">Monitor and liquidate under-collateralised positions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-red-500">
            <ShieldOff className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">At Risk</span>
          </div>
          <p className="text-2xl font-semibold text-red-500">{atRisk.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Positions eligible for liquidation</p>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-yellow-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Warning Zone</span>
          </div>
          <p className="text-2xl font-semibold text-yellow-600">
            {positions.filter((p) => p.healthFactor > 1.2 && p.healthFactor <= 1.5).length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Health factor 1.2 – 1.5</p>
        </div>
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-green-500">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Healthy</span>
          </div>
          <p className="text-2xl font-semibold text-green-500">
            {positions.filter((p) => p.healthFactor > 1.5).length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Health factor above 1.5</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search wallet or asset…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/40 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {atRisk.length > 0 && (
          <button
            onClick={() => { playClickSound(); void handleLiquidateAll(); }}
            disabled={!!liquidating}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shrink-0"
          >
            <Zap className="w-4 h-4" />
            Liquidate All At-Risk ({atRisk.length})
          </button>
        )}
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
              <th className="text-center px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((pos) => {
              const done = liquidated.has(pos.id);
              const isLiquidating = liquidating === pos.id;
              return (
                <tr key={pos.id} className={`transition-colors ${done ? "opacity-40" : "hover:bg-muted/30"}`}>
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{pos.wallet}</td>
                  <td className="px-5 py-4 font-medium">{pos.collateral}</td>
                  <td className="px-5 py-4 text-right">${pos.collateralUsd.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">${pos.debt.toLocaleString()}</td>
                  <td className={`px-5 py-4 text-right font-medium ${pos.ltv > 80 ? "text-red-500" : pos.ltv > 65 ? "text-yellow-500" : "text-green-500"}`}>
                    {pos.ltv}%
                  </td>
                  <td className="px-5 py-4 text-center"><HfBadge hf={pos.healthFactor} /></td>
                  <td className="px-5 py-4 text-center">
                    {done ? (
                      <span className="flex items-center justify-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done
                      </span>
                    ) : pos.liquidatable ? (
                      <button
                        onClick={() => { playClickSound(); void handleLiquidate(pos); }}
                        disabled={!!liquidating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        <Zap className="w-3 h-3" />
                        {isLiquidating ? "Processing…" : "Liquidate"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Safe</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
