import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import { Search, Shield, Activity, Terminal } from "lucide-react";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Sentinel V2 | Command Center",
  description: "Advanced onchain intelligence and threat mitigation.",
};

function Sidebar() {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-16 hover:w-64 transition-all duration-300 h-screen fixed left-0 top-0 bg-[#050505] border-r border-white/5 z-50 overflow-hidden flex-col group">
        <div className="h-16 flex items-center px-5 border-b border-white/5 shrink-0">
          <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
            <span className="absolute w-full h-full rounded-full bg-[#00E5FF] opacity-75 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-[#00E5FF]" />
          </div>
          <span className="ml-4 font-[family-name:var(--font-display)] font-black tracking-widest text-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            SENTINEL_OS
          </span>
        </div>

        <nav className="flex-1 py-8 flex flex-col gap-2 px-2">
          <Link href="/" className="flex items-center px-3 py-3 rounded-md hover:bg-white/5 text-[#888888] hover:text-white transition-colors group/link">
            <Terminal size={20} className="shrink-0 group-hover/link:text-[#00E5FF] transition-colors" />
            <span className="ml-4 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Command_Center
            </span>
          </Link>
          <Link href="/scan/wallet" className="flex items-center px-3 py-3 rounded-md hover:bg-white/5 text-[#888888] hover:text-white transition-colors group/link">
            <Search size={20} className="shrink-0 group-hover/link:text-[#00E5FF] transition-colors" />
            <span className="ml-4 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Wallet_Forensics
            </span>
          </Link>
          <Link href="/scan/token" className="flex items-center px-3 py-3 rounded-md hover:bg-white/5 text-[#888888] hover:text-white transition-colors group/link">
            <Activity size={20} className="shrink-0 group-hover/link:text-[#FFB020] transition-colors" />
            <span className="ml-4 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Market_Intel
            </span>
          </Link>
          <Link href="/monitor" className="flex items-center px-3 py-3 rounded-md hover:bg-white/5 text-[#888888] hover:text-white transition-colors group/link">
            <Shield size={20} className="shrink-0 group-hover/link:text-[#00FF66] transition-colors" />
            <span className="ml-4 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Active_Monitor
            </span>
          </Link>
        </nav>

        <div className="p-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          <div className="font-[family-name:var(--font-mono)] text-[9px] text-[#4a5063] uppercase tracking-widest">
            SYS_VERSION: 2.0.0<br/>NET: BASE_MAINNET
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-[#050505] border-t border-white/5 z-50 flex items-center justify-around px-2 py-3 pb-safe">
        <Link href="/" className="flex flex-col items-center gap-1 text-[#888888] hover:text-[#00E5FF] transition-colors">
          <Terminal size={18} />
          <span className="text-[8px] font-[family-name:var(--font-mono)] uppercase">System</span>
        </Link>
        <Link href="/scan/wallet" className="flex flex-col items-center gap-1 text-[#888888] hover:text-[#00E5FF] transition-colors">
          <Search size={18} />
          <span className="text-[8px] font-[family-name:var(--font-mono)] uppercase">Wallet</span>
        </Link>
        <Link href="/scan/token" className="flex flex-col items-center gap-1 text-[#888888] hover:text-[#FFB020] transition-colors">
          <Activity size={18} />
          <span className="text-[8px] font-[family-name:var(--font-mono)] uppercase">Market</span>
        </Link>
        <Link href="/monitor" className="flex flex-col items-center gap-1 text-[#888888] hover:text-[#00FF66] transition-colors">
          <Shield size={18} />
          <span className="text-[8px] font-[family-name:var(--font-mono)] uppercase">Monitor</span>
        </Link>
      </nav>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} bg-black text-white antialiased m-0 p-0 selection:bg-[#00E5FF]/30 selection:text-white`}>
        {/* CRT Scanline Effects */}
        <div className="scanline-overlay" />
        <div className="scanline-bar" />
        
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 lg:ml-16 h-[calc(100vh-60px)] lg:h-screen overflow-y-auto overflow-x-hidden relative pb-16 lg:pb-0">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}