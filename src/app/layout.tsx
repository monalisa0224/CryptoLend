import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeInitializer } from "@/components/theme-initializer";
import { DefiProvider } from "@/components/defi-state";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "CryptoLend",
  description: "Decentralized lending demo with Hardhat, Next.js and MockUSDT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Toaster position="top-right" richColors />
        <ThemeInitializer />
        <DefiProvider>
          <AppShell>{children}</AppShell>
        </DefiProvider>
      </body>
    </html>
  );
}
