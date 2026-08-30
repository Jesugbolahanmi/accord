"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, Activity, ShieldAlert, ShieldCheck, 
  DollarSign, Droplets, PieChart, Info, AlertTriangle, CheckCircle2,
  Shield, Users, Lock, Code, TrendingDown, Network, TerminalSquare,
  Cpu, Send
} from "lucide-react";

const INVESTIGATION_STEPS = [
  "RESOLVING_CONTRACT_BYTECODE",
  "FETCHING_METADATA_AND_ABI",
  "SCANNING_HONEYPOT_PATTERNS",
  "QUERYING_DEX_LIQUIDITY",
  "CROSS_REFERENCING_SIGNALS",
  "COMPILING_THREAT_REPORT",
];

export default function TokenScan() {
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
      const res = await fetch("/api/investigate-token", {
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
    <main className="flex-1 lg:h-full flex flex-col bg-black text-white lg:overflow-hidden relative overflow-y-auto min-h-screen lg:min-h-0">
      
      {/* Top Header / Search Bar */}
      <header className="h-14 shrink-0 border-b border-white/5 bg-[#050505] flex items-center px-4 justify-between z-20 relative">
        <div className="flex items-center gap-4">
          <TerminalSquare size={16} className="text-[#00E5FF]" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase text-[#888888] hidden sm:inline-block">
            MOD: TOKEN_FORENSICS
          </span>
        </div>
        
        <form onSubmit={handleInvestigate} className="flex-1 max-w-xl mx-auto flex items-center bg-black border border-white/10 group focus-within:border-[#00E5FF]/50 transition-colors ml-2 sm:ml-0">
          <div className="pl-3 hidden sm:block">
            <Search size={14} className="text-[#4a5063] group-focus-within:text-[#00E5FF]" />
          </div>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... (Token Contract)"
            className="flex-1 bg-transparent border-none text-white font-[family-name:var(--font-mono)] text-xs px-3 py-2 focus:outline-none focus:ring-0 placeholder-[#4a5063] w-full"
          />
          <button
            type="submit"
            disabled={loading || !address}
            className="bg-white/5 hover:bg-[#00E5FF] hover:text-black text-[#888888] px-3 sm:px-4 py-2 text-[10px] font-bold font-[family-name:var(--font-mono)] transition-colors border-l border-white/10 disabled:opacity-50"
          >
            {loading ? "SCAN" : "EXECUTE"}
          </button>
        </form>

        <div className="flex items-center gap-2">
          {error && <span className="text-[10px] text-[#FF1E1E] font-[family-name:var(--font-mono)] tracking-widest mr-4 hidden md:inline">{error}</span>}
          <div className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-1 lg:overflow-hidden relative">
        {!result && !loading ? (
          // Empty State
          <div className="w-full h-full min-h-[400px] border border-white/5 bg-[#050505] flex items-center justify-center flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" style={{ backgroundSize: '30px' }} />
            <Cpu size={48} className="text-white/10 mb-4" />
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase tracking-widest text-[#4a5063]">
              AWAITING_INPUT
            </h2>
          </div>
        ) : loading ? (
          // Loading Matrix
          <div className="w-full h-full min-h-[400px] border border-white/5 bg-[#050505] flex items-center justify-center relative overflow-hidden">
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-1 lg:h-full">
            
            {/* COLUMN 1: Threat Score & Feed */}
            <div className="col-span-1 flex flex-col gap-1 lg:overflow-hidden min-h-[400px] lg:min-h-0">
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
              <div className="border border-white/5 bg-[#050505] flex-1 flex flex-col lg:overflow-hidden relative min-h-[250px] lg:min-h-0">
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

            {/* COLUMN 2 & 3: Security & Market Analysis */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-1 lg:overflow-hidden">
              
              <div className="flex flex-col sm:flex-row gap-1 lg:h-1/2">
                {/* Security Analysis Card */}
                <div className="border border-white/5 bg-[#050505] flex-1 overflow-hidden flex flex-col min-h-[220px]">
                  <div className="p-3 border-b border-white/5 shrink-0 flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                      <Shield size={12} /> SECURITY_ANALYSIS
                    </h3>
                    <span className="text-[8px] text-[#4a5063] font-[family-name:var(--font-mono)]">via GoPlus</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 text-[10px] font-[family-name:var(--font-mono)]">
                    {result.security ? (
                      <>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><ShieldAlert size={12} /> HONEYPOT_DETECTED</span>
                          {result.security.isHoneypot
                            ? <span className="text-[#FF1E1E] font-bold">CONFIRMED</span>
                            : <span className="text-[#00FF66]">SAFE</span>}
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><TrendingDown size={12} /> BUY_TAX</span>
                          <span className={result.security.buyTax > 10 ? "text-[#FF1E1E] font-bold" : result.security.buyTax > 5 ? "text-[#FFB020] font-bold" : "text-[#00FF66]"}>
                            {result.security.buyTax}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><TrendingDown size={12} /> SELL_TAX</span>
                          <span className={result.security.sellTax > 10 ? "text-[#FF1E1E] font-bold" : result.security.sellTax > 5 ? "text-[#FFB020] font-bold" : "text-[#00FF66]"}>
                            {result.security.sellTax}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><Code size={12} /> SOURCE_VERIFIED</span>
                          {result.security.isOpenSource
                            ? <span className="text-[#00FF66]">YES</span>
                            : <span className="text-[#FF1E1E] font-bold">NO</span>}
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><Lock size={12} /> OWNER_RENOUNCED</span>
                          {result.security.ownerRenounced
                            ? <span className="text-[#00FF66]">YES</span>
                            : <span className="text-[#FFB020] font-bold">NO</span>}
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><Code size={12} /> UPGRADEABLE_PROXY</span>
                          {result.security.isProxy
                            ? <span className="text-[#FFB020] font-bold">YES</span>
                            : <span className="text-[#00FF66]">NO</span>}
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#4a5063]">DATA_UNAVAILABLE</div>
                    )}
                  </div>
                </div>

                {/* Market & Holder Analysis Card */}
                <div className="border border-white/5 bg-[#050505] flex-1 overflow-hidden flex flex-col min-h-[220px]">
                  <div className="p-3 border-b border-white/5 shrink-0">
                    <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                      <Activity size={12} /> MARKET_METRICS
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 text-[10px] font-[family-name:var(--font-mono)]">
                    {result.marketData ? (
                      <>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2">
                          <span className="text-[#888888]">PRICE_USD</span>
                          <span className="text-[#00FF66]">${result.marketData.priceUsd || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2">
                          <span className="text-[#888888]">LIQUIDITY</span>
                          <span className="text-white">${result.marketData.liquidityUsd?.toLocaleString() || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2">
                          <span className="text-[#888888]">MARKET_CAP</span>
                          <span className="text-white">${result.marketData.marketCap?.toLocaleString() || "—"}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center py-4 text-[#FFB020] bg-[#FFB020]/5 border border-[#FFB020]/20 text-[9px] uppercase tracking-widest">
                        <AlertTriangle size={12} className="mr-2" /> NO_ACTIVE_MARKET_DATA
                      </div>
                    )}

                    {result.security && (
                      <>
                        <div className="mt-4 mb-2 text-[8px] text-[#4a5063] uppercase tracking-widest">HOLDER_STATISTICS</div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><Users size={12} /> TOP_10_HOLDERS</span>
                          <span className={result.security.top10HolderPercent > 80 ? "text-[#FF1E1E] font-bold" : result.security.top10HolderPercent > 50 ? "text-[#FFB020] font-bold" : "text-[#00FF66]"}>
                            {result.security.top10HolderPercent}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className="text-[#888888] flex items-center gap-1.5"><Users size={12} /> TOTAL_HOLDERS</span>
                          <span className="text-white">{result.security.holderCount.toLocaleString()}</span>
                        </div>
                        {result.security.isInCex && (
                          <div className="flex justify-between items-center bg-[#00FF66]/5 border border-[#00FF66]/20 px-3 py-2 mt-1">
                            <span className="text-[#888888] flex items-center gap-1.5"><CheckCircle2 size={12} /> CEX_LISTED</span>
                            <span className="text-[#00FF66]">{result.security.cexList.join(", ")}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Pane: Token Details / Graph Intel */}
              <div className="flex flex-col sm:flex-row gap-1 lg:h-1/2">
                <div className="border border-white/5 bg-[#050505] flex-1 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0">
                    <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                      <Info size={12} /> TOKEN_REGISTRY
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 text-[10px] font-[family-name:var(--font-mono)]">
                     {result.metadata ? (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                            <span className="text-[#888888]">CONTRACT_NAME</span>
                            <span className="text-white font-bold">{result.metadata.name || "UNKNOWN"}</span>
                          </div>
                          <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                            <span className="text-[#888888]">TICKER_SYMBOL</span>
                            <span className="bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 px-2 py-0.5">{result.metadata.symbol || "UNKNOWN"}</span>
                          </div>
                          <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                            <span className="text-[#888888]">DECIMALS</span>
                            <span className="text-white">{result.metadata.decimals ?? "UNKNOWN"}</span>
                          </div>
                        </div>
                     ) : (
                        <div className="h-full flex items-center justify-center text-[#4a5063]">REGISTRY_DATA_UNAVAILABLE</div>
                     )}
                  </div>
                </div>

                <div className="border border-white/5 bg-[#050505] flex-1 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0">
                    <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                      <Network size={12} /> GRAPH_INTELLIGENCE
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 text-[10px] font-[family-name:var(--font-mono)]">
                     {result.graphData ? (
                        <div className="space-y-1">
                          {result.graphData.fundingSource && (
                            <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                              <span className="text-[#888888]">CREATOR_FUNDING_SOURCE</span>
                              <span className={
                                result.graphData.fundingSource.type === "MIXER" ? "text-[#FF1E1E] font-bold" :
                                result.graphData.fundingSource.type === "CEX" ? "text-[#00FF66]" :
                                "text-[#FFB020]"
                              }>
                                {result.graphData.fundingSource.name}
                              </span>
                            </div>
                          )}
                          {result.graphData.washData && (
                            <div className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
                              <span className="text-[#888888]">WASH_TRADING_DETECTED</span>
                              {result.graphData.washData.isWashTrading
                                ? <span className="text-[#FF1E1E] font-bold">YES ({result.graphData.washData.pairsFound} PAIRS)</span>
                                : <span className="text-[#00FF66]">NO</span>}
                            </div>
                          )}
                        </div>
                     ) : (
                        <div className="h-full flex items-center justify-center text-[#4a5063]">GRAPH_DATA_UNAVAILABLE</div>
                     )}
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 4: AI Chat Copilot (Placeholder for Token) */}
            <div className="col-span-1 border border-white/5 bg-[#050505] flex flex-col lg:overflow-hidden relative opacity-50 min-h-[200px] lg:min-h-0">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent to-[#00E5FF] opacity-20" />
              <div className="p-3 border-b border-white/5 shrink-0 bg-black/50 backdrop-blur-sm relative z-10">
                <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#00E5FF] flex items-center gap-2">
                  <Cpu size={12} /> SENTINEL_AI_CORE
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex items-center justify-center flex-col text-center">
                 <TerminalSquare size={24} className="text-[#4a5063] mb-2" />
                 <span className="text-[10px] text-[#4a5063] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                   AI_CORE_OFFLINE<br/>FOR_TOKEN_ANALYSIS
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