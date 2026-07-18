"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  ChevronDown,
  Coins,
  LayoutDashboard,
  LineChart,
  LogOut,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { GlobalAlerts } from "@/components/defi-views";
import { playClickSound, shortAddress, useDefi } from "@/components/defi-state";

type NavItem = { label: string; href: string; desc: string };
type NavGroup = { label: string; icon: ComponentType<{ className?: string }>; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { label: "Protocol", href: "/dashboard/protocol", desc: "Lending Pool utilisation" },
      { label: "Transactions", href: "/dashboard/transactions", desc: "On-chain activity" },
      { label: "History", href: "/dashboard/history", desc: "Chronological record" },
    ],
  },
  {
    label: "Markets",
    icon: LineChart,
    items: [
      { label: "Lending", href: "/lend", desc: "Borrow USDT against crypto" },
      { label: "Staking", href: "/stake", desc: "Earn yield on USDT" },
    ],
  },
  {
    label: "Admin",
    icon: ShieldAlert,
    items: [
      { label: "Liquidity Pool Management", href: "/admin/liquidity", desc: "Manage pool funds & parameters" },
      { label: "Trigger Liquidation", href: "/admin/liquidation", desc: "Liquidate at-risk collateral" },
    ],
  },
];

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = group.items.some((item) => pathname === item.href);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          playClickSound();
          setOpen((current) => !current);
        }}
        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
          isActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <group.icon className="h-4 w-4" />
        {group.label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl shadow-slate-900/10">
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  playClickSound();
                  setOpen(false);
                }}
                className={`block px-4 py-3 transition-colors ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { account, connectWallet, disconnectWallet } = useDefi();

  return (
    <main className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-[1380px] items-center gap-6 px-8 py-4">
          <Link href="/" onClick={() => playClickSound()} className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0b0b23] text-white">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight">CryptoLend</h1>
              <p className="text-sm text-slate-500">Decentralized Lending & Staking</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_GROUPS.map((group) => (
              <NavDropdown key={group.label} group={group} pathname={pathname} />
            ))}
          </nav>

          <div className="ml-auto">
            {account ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <span className="font-semibold text-slate-800">{shortAddress(account)}</span>
                <button
                  onClick={() => {
                    playClickSound();
                    disconnectWallet();
                  }}
                  className="text-rose-500 transition-colors hover:text-rose-700"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  playClickSound();
                  void connectWallet();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0b0b23] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#1b1b3f]"
              >
                <Wallet className="h-5 w-5" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1380px] flex-1 px-8 py-8">
        <GlobalAlerts />
        {children}
      </section>

      <footer className="border-t border-slate-200 py-8">
        <p className="text-center text-sm text-slate-500">CryptoLend - Secure Decentralized Finance Platform</p>
      </footer>
    </main>
  );
}
