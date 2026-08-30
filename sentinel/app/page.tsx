"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Activity, ShieldAlert, Database, ChevronRight, Cpu } from "lucide-react";

export default function CommandCenter() {
  const router = useRouter();
  const [inputVal, setInputVal] = useState("");
  const [matrixLog, setMatrixLog] = useState<string[]>([]);
  
  // Simulated background matrix data feed
  useEffect(() => {
    const logs = [
      "ESTABLISHING SECURE CONNECTION... OK",
      "SYNCING WITH BASE MAINNET... OK",
      "MONITORING MEMPOOL... ACTIVE",
      "DETECTING ANOMALOUS CONTRACT DEPLOYMENTS...",
      "BLOCK 1729384: MULTICALL TX INTERCEPTED",
      "FLAG: EIP-2612 PERMIT SIGNATURE DETECTED",
      "ROUTING TRACE TO SENTINEL AI CORE...",
      "AWAITING COMMAND INPUT."
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setMatrixLog(prev => [...prev, logs[i]]);
        i++;
      } else {
        // loop some random hex data
        const randomHex = "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
        setMatrixLog(prev => [...prev.slice(-8), `SCAN_NODE_3: TRACE ${randomHex}`]);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    
    // Simple routing based on input
    if (inputVal.startsWith("0x")) {
      router.push(`/scan/wallet?address=${inputVal}`);
    } else {
      setMatrixLog(prev => [...prev, `ERROR: INVALID ENTITY FORMAT [${inputVal}]`]);
      setInputVal("");
    }
  };

  return (
    <div className="h-screen w-full bg-black text-white overflow-hidden relative flex flex-col">
      
      {/* Background Radar Animation */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] sm:w-[800px] sm:h-[800px] pointer-events-none opacity-20">
        <div className="absolute inset-0 rounded-full border border-[#00E5FF]/20 animate-radar" style={{ animationDelay: '0s' }} />
        <div className="absolute inset-0 rounded-full border border-[#00E5FF]/10 animate-radar" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 rounded-full border border-[#00E5FF]/5 animate-radar" style={{ animationDelay: '2s' }} />
        {/* Crosshairs */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/5" />
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/5" />
      </div>

      {/* Top Header */}
        <header className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-8 border-b border-white/5 relative z-10 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-[#00E5FF]" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] sm:text-xs font-bold tracking-[0.2em] sm:tracking-[0.3em] text-[#00E5FF]">SENTINEL CMD</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 font-[family-name:var(--font-mono)] text-[9px] sm:text-[10px] tracking-widest text-[#888888]">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse"/>ONLINE</span>
          <span className="hidden sm:flex items-center gap-2"><Database size={12} /> LATENCY: 12ms</span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-1 p-1 bg-white/5">
        
        {/* LEFT PANE: Matrix Log */}
        <div className="hidden lg:flex flex-col bg-black border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent opacity-20" />
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#00E5FF] tracking-widest flex items-center gap-2">
              <Activity size={12} className="animate-pulse" /> SYSTEM_LOGS
            </span>
          </div>
          <div className="flex-1 p-4 font-[family-name:var(--font-mono)] text-[10px] text-[#888888] space-y-2 overflow-y-auto custom-scrollbar flex flex-col justify-end">
            {matrixLog.map((log, i) => (
              <div key={i} className="animate-decrypt" style={{ animationDelay: `${i * 0.05}s` }}>
                <span className="text-[#4a5063]">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span> {log}
              </div>
            ))}
          </div>
        </div>

        {/* CENTER PANE: Command Prompt */}
        <div className="col-span-1 lg:col-span-2 bg-black border border-white/5 relative flex flex-col items-center justify-center p-8">
          
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" style={{ backgroundSize: '30px' }} />
          
          <div className="max-w-2xl w-full relative z-10 text-center mb-12 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/5 mb-6 sm:mb-8 shadow-[0_0_30px_rgba(0,229,255,0.1)]">
              <Cpu size={20} className="text-[#00E5FF] glitch-hover" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4 text-white">
              INITIALIZE_SCAN
            </h1>
            <p className="font-[family-name:var(--font-mono)] text-[#888888] text-[10px] sm:text-sm uppercase tracking-widest max-w-lg mx-auto leading-relaxed">
              Input a wallet address, contract, or ENS to begin deterministic onchain forensics.
            </p>
          </div>

          <form onSubmit={handleCommand} className="w-full max-w-2xl relative z-10 group px-4 sm:px-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00E5FF] to-[#FF1E1E] opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500 rounded-none" />
            <div className="relative flex items-center bg-black border border-white/20 p-1 sm:p-2">
              <div className="pl-3 sm:pl-4 pr-2 text-[#00E5FF] font-[family-name:var(--font-mono)] font-bold animate-pulse">
                &gt;
              </div>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="0x..."
                className="flex-1 bg-transparent border-none text-white font-[family-name:var(--font-mono)] text-base sm:text-xl focus:outline-none focus:ring-0 placeholder-[#4a5063] px-2 py-3 sm:py-4"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!inputVal.trim()}
                className="bg-[#00E5FF] hover:bg-white text-black font-black px-4 sm:px-8 py-3 sm:py-4 font-[family-name:var(--font-mono)] text-xs sm:text-sm tracking-widest transition-colors disabled:opacity-50 disabled:hover:bg-[#00E5FF]"
              >
                EXECUTE
              </button>
            </div>
          </form>

        </div>

      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 flex items-center justify-between px-4 border-t border-white/5 bg-black/50 backdrop-blur-md font-[family-name:var(--font-mono)] text-[9px] tracking-widest text-[#4a5063] relative z-10 uppercase">
        <div className="flex items-center gap-3 sm:gap-4">
          <span>SECURE_ENCLAVE: ACTIVE</span>
          <span className="hidden sm:inline">RPC_PROVIDER: ALCHEMY_BASE</span>
        </div>
        <div className="flex items-center gap-2 text-[#FF1E1E]">
          <ShieldAlert size={10} /> <span className="hidden sm:inline">3 CRITICAL THREATS INTERCEPTED TODAY</span><span className="sm:hidden">3 THREATS</span>
        </div>
      </footer>

    </div>
  );
}