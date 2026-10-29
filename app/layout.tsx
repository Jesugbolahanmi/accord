import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { WalletStatusPill } from "@/components/WalletStatusPill";
import { AccordMark } from "@/components/AccordMark";

const newsreader = localFont({
  src: [
    { path: "./fonts/Newsreader-Variable.woff2", style: "normal" },
    { path: "./fonts/Newsreader-Italic-Variable.woff2", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Accord — Trade on agreed terms",
  description:
    "Institutional-grade peer-to-peer crypto agreements with versioned terms, Tatum RPC on-chain verification, and persistent Walrus Memory on Mainnet.",
};

function NavigationHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#090A0C]/92 backdrop-blur-md border-b border-white/[0.07]">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <AccordMark className="w-6 h-6 transition-transform duration-200 group-hover:scale-[1.03]" />
            <div className="flex items-baseline gap-2.5">
              <span className="text-[15px] font-medium tracking-[-0.02em] text-[#F4F2ED]">
                Accord
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono-tabular text-[#6E6C65] border-l border-white/[0.08] pl-2.5">
                Trade on agreed terms
              </span>
            </div>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-1 text-[13px] text-[#A6A39B]"
          >
            <Link
              href="/trades"
              className="px-3 py-1.5 rounded-[3px] hover:text-[#F4F2ED] hover:bg-white/[0.03] transition-colors"
            >
              Agreements
            </Link>
            <Link
              href="/trades/new"
              className="px-3 py-1.5 rounded-[3px] hover:text-[#F4F2ED] hover:bg-white/[0.03] transition-colors"
            >
              Draft Trade
            </Link>
            <Link
              href="/trade/ACC-2026-8812"
              className="px-3 py-1.5 rounded-[3px] hover:text-[#F4F2ED] hover:bg-white/[0.03] transition-colors"
            >
              Specimen Room
            </Link>
            <Link
              href="/memory"
              className="px-3 py-1.5 rounded-[3px] hover:text-[#F4F2ED] hover:bg-white/[0.03] transition-colors"
            >
              Memory Vault
            </Link>
            <Link
              href="/tatum-diagnostic"
              className="px-3 py-1.5 rounded-[3px] hover:text-[#F4F2ED] hover:bg-white/[0.03] transition-colors"
            >
              RPC Telemetry
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <WalletStatusPill />
          <Link
            href="/trades/new"
            className="px-3.5 py-1.5 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[12px] font-medium tracking-[-0.01em] transition-colors"
          >
            New Agreement
          </Link>
        </div>
      </div>

      {/* Mobile Secondary Navigation Strip */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-[#0B0D10] text-[12px] font-mono-tabular text-[#A6A39B] overflow-x-auto"
      >
        <Link href="/trades" className="px-2 py-0.5 hover:text-[#F4F2ED] whitespace-nowrap">
          Agreements
        </Link>
        <Link href="/trades/new" className="px-2 py-0.5 hover:text-[#F4F2ED] whitespace-nowrap">
          Draft Trade
        </Link>
        <Link
          href="/trade/ACC-2026-8812"
          className="px-2 py-0.5 hover:text-[#F4F2ED] whitespace-nowrap"
        >
          Room ACC-8812
        </Link>
        <Link href="/memory" className="px-2 py-0.5 hover:text-[#F4F2ED] whitespace-nowrap">
          Memory
        </Link>
        <Link
          href="/tatum-diagnostic"
          className="px-2 py-0.5 hover:text-[#F4F2ED] whitespace-nowrap"
        >
          Tatum RPC
        </Link>
      </nav>
    </header>
  );
}

function InstitutionalFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#090A0C] mt-20">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[12px] text-[#6E6C65]">
        <div className="flex items-center gap-3">
          <AccordMark className="w-5 h-5" />
          <span className="text-[#A6A39B] font-medium">Accord Settlement Infrastructure</span>
          <span className="font-mono-tabular">— On-chain verification via Tatum RPC · Persistent context via Walrus Memory</span>
        </div>
        <div className="flex items-center gap-5 font-mono-tabular text-[11px]">
          <Link href="/trades" className="hover:text-[#F4F2ED] transition-colors">
            Agreements
          </Link>
          <Link href="/memory" className="hover:text-[#F4F2ED] transition-colors">
            Walrus Relayer
          </Link>
          <Link href="/tatum-diagnostic" className="hover:text-[#F4F2ED] transition-colors">
            Tatum Gateway
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${geistSans.variable} ${geistMono.variable} dark`}
    >
      <body className="min-h-screen flex flex-col bg-[#090A0C] text-[#F4F2ED] selection:bg-[#C5A46D]/25 selection:text-[#F4F2ED]">
        <Providers>
          <NavigationHeader />
          <main className="flex-1">{children}</main>
          <InstitutionalFooter />
        </Providers>
      </body>
    </html>
  );
}
