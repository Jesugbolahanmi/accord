"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, Activity, ShieldAlert, ShieldCheck, 
  Image as ImageIcon, Fingerprint, Info, AlertTriangle, Shield, CheckCircle2,
  TerminalSquare, Cpu, Send
} from "lucide-react";

const INVESTIGATION_STEPS = [
  "RESOLVING_CONTRACT_BYTECODE",
  "FETCHING_COLLECTION_METADATA",
  "TRACING_DEPLOYER_FOOTPRINT",
  "CHECKING_TRANSFER_PATTERNS",
  "AUDITING_OWNERSHIP_CONCENTRATION",
  "COMPILING_THREAT_REPORT",
];

export default function NFTScan() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setCurrentStep(0);
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= INVESTIGATION_STEPS.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!result) return;
    setDisplayScore(0);
    const timer = setTimeout(() => setDisplayScore(result.report.riskScore), 100);
    return () => clearTimeout(timer);
  }, [result]);

  async function handleInvestigate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/investigate-nft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "SYSTEM_FAILURE");
      } else {
        setResult(data);
      }
    } catch {
      setError("NETWORK_DISCONNECT");
    } finally {
      setLoading(false);
    }
  }

  const severityColor = (level: string) => {
    if (level === "CRITICAL" || level === "HIGH") return "#FF1E1E";
    if (level === "MEDIUM") return "#FFB020";
    return "#00FF66";
  };

  return (
    <main className="h-full flex flex-col bg-black text-white overflow-hidden relative">
      
      {/* Top Header / Search Bar */}
      <header className="h-14 shrink-0 border-b border-white/5 bg-[#050505] flex items-center px-4 justify-between z-20 relative">
        <div className="flex items-center gap-4">
          <TerminalSquare size={16} className="text-[#00E5FF]" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase text-[#888888]">
            MOD: NFT_FORENSICS
          </span>
        </div>
        
        <form onSubmit={handleInvestigate} className="flex-1 max-w-xl mx-auto flex items-center bg-black border border-white/10 group focus-within:border-[#00E5FF]/50 transition-colors">
          <div className="pl-3">
            <Search size={14} className="text-[#4a5063] group-focus-within:text-[#00E5FF]" />
          </div>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Collection Address (0x...)"
            className="flex-1 bg-transparent border-none text-white font-[family-name:var(--font-mono)] text-xs px-3 py-2 focus:outline-none focus:ring-0 placeholder-[#4a5063]"
          />
          <button
            type="submit"
            disabled={loading || !address}
            className="bg-white/5 hover:bg-[#00E5FF] hover:text-black text-[#888888] px-4 py-2 text-[10px] font-bold font-[family-name:var(--font-mono)] transition-colors border-l border-white/10 disabled:opacity-50"
          >
            {loading ? "SCANNING..." : "EXECUTE"}
          </button>
        </form>

        <div className="flex items-center gap-2">
          {error && <span className="text-[10px] text-[#FF1E1E] font-[family-name:var(--font-mono)] tracking-widest mr-4">{error}</span>}
          <div className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-1 overflow-hidden relative">
        {!result && !loading ? (
          // Empty State
          <div className="w-full h-full border border-white/5 bg-[#050505] flex items-center justify-center flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" style={{ backgroundSize: '30px' }} />
            <Cpu size={48} className="text-white/10 mb-4" />
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase tracking-widest text-[#4a5063]">
              AWAITING_INPUT
            </h2>
          </div>
        ) : loading ? (
          // Loading Matrix
          <div className="w-full h-full border border-white/5 bg-[#050505] flex items-center justify-center relative overflow-hidden">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[#00E5FF]/10 animate-radar opacity-50" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-[#00E5FF]/20 animate-radar" style={{animationDelay: '0.5s'}} />
             
             <div className="font-[family-name:var(--font-mono)] text-xs text-[#00E5FF] flex flex-col gap-2 relative z-10 w-80">
               {INVESTIGATION_STEPS.map((step, i) => (
                  <div key={i} className={`flex items-center gap-3 transition-opacity duration-300 ${i <= currentStep ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="w-4 shrink-0">
                      {i < currentStep ? <CheckCircle2 size={14} className="text-[#00FF66]"/> : i === currentStep ? <Activity size={14} className="animate-spin text-[#00E5FF]"/> : ""}
                    </span>
                    <span className={`${i === currentStep ? "text-[#00E5FF] font-bold" : "text-[#888888]"}`}>
                      &gt; {step}
                    </span>
                  </div>
               ))}
             </div>
          </div>
        ) : (
          // Results Dashboard Layout (4 Columns Grid)
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-1 h-full">
            
            {/* COLUMN 1: Threat Score & Feed */}
            <div className="col-span-1 flex flex-col gap-1 overflow-hidden">
              {/* Score Widget */}
              <div className="border border-white/5 bg-[#050505] p-5 shrink-0 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 blur-[50px] opacity-20 pointer-events-none" style={{ backgroundColor: severityColor(result.report.threatLevel) }} />
                
                <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] mb-4 flex items-center gap-2">
                  <ShieldCheck size={12} /> THREAT_ANALYSIS
                </h3>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold font-[family-name:var(--font-mono)] px-2 py-0.5 inline-block mb-2 border" 
                      style={{ color: severityColor(result.report.threatLevel), borderColor: `${severityColor(result.report.threatLevel)}40`, backgroundColor: `${severityColor(result.report.threatLevel)}10` }}>
                      {result.report.threatLevel}_RISK
                    </div>
                    <div className="font-[family-name:var(--font-display)] text-5xl font-black" style={{ color: severityColor(result.report.threatLevel) }}>
                      {displayScore}
                    </div>
                  </div>
                </div>
                
                <p className="mt-4 text-[11px] text-[#AAAAAA] leading-relaxed line-clamp-4 font-[family-name:var(--font-mono)]">
                  {result.report.summary}
                </p>
              </div>

              {/* Detected Flags Feed */}
              <div className="border border-white/5 bg-[#050505] flex-1 flex flex-col overflow-hidden relative">
                <div className="p-3 border-b border-white/5 shrink-0">
                  <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#FF1E1E] flex items-center gap-2">
                    <ShieldAlert size={12} /> THREAT_LOGS [{result.flags?.length || 0}]
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {result.flags?.map((flag: any, i: number) => (
                    <div key={i} className="bg-black/40 border border-white/5 p-3 text-[10px] font-[family-name:var(--font-mono)] hover:border-white/20 transition-colors group">
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: flag.severity === "high" ? "#FF1E1E" : flag.severity === "medium" ? "#FFB020" : "#00E5FF" }} />
                        <span className="text-[#AAAAAA] leading-relaxed">{flag.message}</span>
                      </div>
                    </div>
                  ))}
                  {(!result.flags || result.flags.length === 0) && (
                    <div className="text-[#00FF66] text-[10px] font-[family-name:var(--font-mono)] text-center mt-10">
                      NO_THREATS_DETECTED
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 2 & 3: Collection Info & Deployer */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-1 overflow-hidden">
              
              <div className="flex gap-1 h-1/2">
                {/* Collection Info Card */}
                <div className="border border-white/5 bg-[#050505] flex-1 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-white/5 shrink-0 flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                      <Info size={12} /> COLLECTION_INFO
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 text-[10px] font-[family-name:var(--font-mono)] flex flex-col justify-center">
                    {result.metadata ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888]">NAME</span>
                          <span className="text-white font-bold">{result.metadata.name || result.metadata.openSeaMetadata?.collectionName || "UNKNOWN"}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888]">SYMBOL</span>
                          <span className="bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 px-2 py-0.5">{result.metadata.symbol || "UNKNOWN"}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888]">TOKEN_TYPE</span>
                          <span className="text-white">{result.metadata.tokenType || "UNKNOWN"}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888]">TOTAL_SUPPLY</span>
                          <span className="text-white">{result.metadata.totalSupply || "UNKNOWN"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#4a5063]">DATA_UNAVAILABLE</div>
                    )}
                  </div>
                </div>

                {/* Deployer Footprint Card */}
                <div className="border border-white/5 bg-[#050505] flex-1 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-white/5 shrink-0">
                    <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                      <Fingerprint size={12} /> DEPLOYER_FOOTPRINT
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 text-[10px] font-[family-name:var(--font-mono)]">
                    {result.deployerReport ? (
                      <>
                        <div className="mb-4 bg-black/40 border border-white/5 p-3">
                          <span className="text-[#888888] block mb-1">DEPLOYER_ADDRESS:</span>
                          <a
                            href={"https://basescan.org/address/" + result.deployerReport.address}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00E5FF] hover:underline font-bold"
                          >
                            {result.deployerReport.address} ↗
                          </a>
                        </div>
                        
                        {result.deployerReport.flags.length > 0 ? (
                          <div className="space-y-2">
                            {result.deployerReport.flags.map((flag: any, i: number) => (
                              <div key={i} className="bg-black/40 border border-white/5 p-3 flex items-start gap-2">
                                <span className="mt-0.5" style={{ color: flag.severity === "high" ? "#FF1E1E" : flag.severity === "medium" ? "#FFB020" : "#888888" }}>
                                  <AlertTriangle size={12} />
                                </span>
                                <span className="text-[#AAAAAA]">{flag.message}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center py-6 gap-2 text-[#00FF66]">
                            <Shield size={20} className="text-[#00FF66]" />
                            <p>DEPLOYER_HISTORY_CLEAN</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#4a5063]">FOOTPRINT_DATA_UNAVAILABLE</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Pane (Graph/Transfer patterns placeholder if needed later) */}
              <div className="flex gap-1 h-1/2">
                <div className="border border-white/5 bg-[#050505] flex-1 overflow-hidden flex flex-col relative items-center justify-center">
                  <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" />
                  <ImageIcon size={32} className="text-[#4a5063] mb-2 opacity-50" />
                  <span className="text-[10px] text-[#4a5063] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                    VISUAL_FORENSICS_OFFLINE
                  </span>
                </div>
              </div>

            </div>

            {/* COLUMN 4: AI Chat Copilot (Placeholder for NFT) */}
            <div className="col-span-1 border border-white/5 bg-[#050505] flex flex-col overflow-hidden relative opacity-50">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent to-[#00E5FF] opacity-20" />
              <div className="p-3 border-b border-white/5 shrink-0 bg-black/50 backdrop-blur-sm relative z-10">
                <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#00E5FF] flex items-center gap-2">
                  <Cpu size={12} /> SENTINEL_AI_CORE
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex items-center justify-center flex-col text-center">
                 <TerminalSquare size={24} className="text-[#4a5063] mb-2" />
                 <span className="text-[10px] text-[#4a5063] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                   AI_CORE_OFFLINE<br/>FOR_NFT_ANALYSIS
                 </span>
              </div>

              <div className="p-2 border-t border-white/5 bg-black shrink-0 relative z-10">
                <div className="flex bg-black border border-white/10 opacity-50 cursor-not-allowed">
                  <input
                    type="text"
                    disabled
                    placeholder="Module Unavailable..."
                    className="flex-1 bg-transparent border-none text-white text-[10px] font-[family-name:var(--font-mono)] p-3 focus:outline-none focus:ring-0 placeholder-[#4a5063] cursor-not-allowed"
                  />
                  <button disabled className="bg-white/5 text-[#4a5063] px-3 flex items-center justify-center border-l border-white/10 cursor-not-allowed">
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
