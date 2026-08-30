import Link from "next/link";
import { Wallet, Coins, Image as ImageIcon, ChevronLeft, TerminalSquare, Cpu, ShieldCheck } from "lucide-react";

export default function ScanSelector() {
  return (
    <main className="h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#050505] p-6">
      {/* Background Cyber-grid */}
      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" style={{ backgroundSize: '30px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#00E5FF] opacity-[0.05] blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-4xl w-full relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link
          href="/"
          className="group flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[#4a5063] hover:text-[#00E5FF] transition-colors mb-12 w-fit mx-auto border border-white/5 bg-black px-4 py-2 hover:border-[#00E5FF]/30"
        >
          <ChevronLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> 
          RETURN_TO_COMMAND_CENTER
        </Link>

        <div className="flex flex-col items-center gap-2 mb-12 text-center">
          <TerminalSquare size={32} className="text-[#00E5FF] mb-4 opacity-80" />
          <h1 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-black uppercase tracking-widest text-[#E6E8EC]">
            SELECT_FORENSICS_MODULE
          </h1>
          <p className="font-[family-name:var(--font-mono)] text-[#4a5063] text-xs uppercase tracking-widest max-w-lg mx-auto mt-2">
            INITIALIZE DETERMINISTIC ONCHAIN ANALYSIS
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/scan/wallet"
            className="group bg-black/40 border border-white/10 hover:border-[#00E5FF]/50 p-6 text-center transition-colors relative overflow-hidden flex flex-col items-center"
          >
            <div className="w-12 h-12 mb-4 bg-[#050505] border border-white/5 flex items-center justify-center group-hover:border-[#00E5FF]/30 transition-colors">
              <Wallet size={20} className="text-[#00E5FF]" />
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[#E6E8EC] text-xs mb-2 font-bold tracking-widest uppercase">
              WALLET_FORENSICS
            </div>
            <p className="text-[#4a5063] text-[10px] font-[family-name:var(--font-mono)] leading-relaxed uppercase">
              Investigate wallet activity, approvals, phishing threats, and fund flow history.
            </p>
          </Link>

          <Link
            href="/scan/token"
            className="group bg-black/40 border border-white/10 hover:border-[#FFB020]/50 p-6 text-center transition-colors relative overflow-hidden flex flex-col items-center"
          >
            <div className="w-12 h-12 mb-4 bg-[#050505] border border-white/5 flex items-center justify-center group-hover:border-[#FFB020]/30 transition-colors">
              <Coins size={20} className="text-[#FFB020]" />
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[#E6E8EC] text-xs mb-2 font-bold tracking-widest uppercase">
              TOKEN_FORENSICS
            </div>
            <p className="text-[#4a5063] text-[10px] font-[family-name:var(--font-mono)] leading-relaxed uppercase">
              Analyze a token contract for honeypots, liquidity risks, and structural threats.
            </p>
          </Link>

          <Link
            href="/scan/nft"
            className="group bg-black/40 border border-white/10 hover:border-[#00FF66]/50 p-6 text-center transition-colors relative overflow-hidden flex flex-col items-center"
          >
            <div className="w-12 h-12 mb-4 bg-[#050505] border border-white/5 flex items-center justify-center group-hover:border-[#00FF66]/30 transition-colors">
              <ImageIcon size={20} className="text-[#00FF66]" />
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[#E6E8EC] text-xs mb-2 font-bold tracking-widest uppercase">
              NFT_FORENSICS
            </div>
            <p className="text-[#4a5063] text-[10px] font-[family-name:var(--font-mono)] leading-relaxed uppercase">
              Investigate an NFT collection's deployer footprint and contract approval risks.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}