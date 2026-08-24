"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Search, Activity, ShieldAlert, ShieldCheck, 
  DollarSign, Droplets, PieChart, Info, AlertTriangle, CheckCircle2,
  Shield, Users, Lock, Code, TrendingDown
} from "lucide-react";

const INVESTIGATION_STEPS = [
  "Resolving contract bytecode on Base...",
  "Fetching token metadata & ABI...",
  "Scanning for honeypot patterns...",
  "Querying DEX liquidity pools...",
  "Cross-referencing market signals...",
  "Compiling threat report...",
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
    }, 700);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!result) return;
    setDisplayScore(0);
    const timer = setTimeout(() => setDisplayScore(result.report.riskScore), 100);
    return () => clearTimeout(timer);
  }, [result]);

  async function handleInvestigate() {
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
        setError(data.error || "Something went wrong");
      } else {
        setResult(data);
      }
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  const severityColor = (level: string) => {
    if (level === "CRITICAL" || level === "HIGH") return "#FF3B3B";
    if (level === "MEDIUM") return "#FFB020";
    return "#34D399";
  };

  const severityGlow = (level: string) => {
    if (level === "CRITICAL" || level === "HIGH") return "rgba(255, 59, 59, 0.5)";
    if (level === "MEDIUM") return "rgba(255, 176, 32, 0.5)";
    return "rgba(52, 211, 153, 0.5)";
  };

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 sm:py-10 relative overflow-hidden bg-[#050505]">
      {/* Background Cyber-grid */}
      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none" />
      {/* Token theme — amber/orange primary glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#FFB020] opacity-[0.07] blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-[#38BDF8] opacity-[0.04] blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Back nav */}
        <Link
          href="/scan"
          className="group flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs text-[#7C8394] hover:text-[#FFB020] transition-colors mb-8 w-fit"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
          RETURN TO DASHBOARD
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-2 mb-10">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="absolute w-full h-full rounded-full bg-[#FFB020] opacity-75 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-[#FFB020]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              TOKEN SCANNER
            </h1>
          </div>
          <p className="font-[family-name:var(--font-mono)] text-sm text-[#7C8394] ml-6">
            // analyze contract integrity &amp; market metrics
          </p>
        </div>

        {/* Input section */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 mb-8 shadow-2xl transition-all duration-300 hover:border-white/20 hover:bg-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFB020]/10 blur-3xl rounded-full" />
          
          <div className="flex flex-col sm:flex-row gap-3 relative z-10">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={18} className="text-[#7C8394] group-focus-within:text-[#FFB020] transition-colors" />
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && address && handleInvestigate()}
                placeholder="Enter token contract address (0x...)"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-[#E6E8EC] placeholder-[#4a5063] font-[family-name:var(--font-mono)] text-sm focus:outline-none focus:border-[#FFB020] focus:ring-1 focus:ring-[#FFB020] transition-all"
              />
            </div>
            <button
              onClick={handleInvestigate}
              disabled={loading || !address}
              className="bg-gradient-to-r from-[#FFB020] to-[#f59e0b] hover:from-[#f59e0b] hover:to-[#d97706] disabled:from-[#242938] disabled:to-[#242938] disabled:text-[#4a5063] disabled:cursor-not-allowed text-black rounded-xl px-8 py-4 font-bold font-[family-name:var(--font-mono)] text-sm transition-all shadow-[0_0_20px_rgba(255,176,32,0.3)] hover:shadow-[0_0_30px_rgba(255,176,32,0.5)] disabled:shadow-none flex items-center justify-center gap-2 sm:min-w-[140px]"
            >
              {loading ? (
                <><Activity size={16} className="animate-spin" /> SCANNING</>
              ) : "INVESTIGATE"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 rounded-xl p-4 mb-8 text-[#FF3B3B] font-[family-name:var(--font-mono)] text-sm flex items-center gap-3 animate-in">
            <ShieldAlert size={18} /> {error}
          </div>
        )}

        {/* ── Animated Terminal Loader ── */}
        {loading && (
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden animate-in">
            {/* Animated radar ring */}
            <div className="absolute top-1/2 right-6 sm:right-10 -translate-y-1/2 w-40 h-40 rounded-full border border-[#FFB020]/20 animate-radar opacity-50" />
            <div className="absolute top-1/2 right-6 sm:right-10 -translate-y-1/2 w-24 h-24 rounded-full border border-[#FFB020]/10 animate-radar opacity-30" style={{ animationDelay: "0.8s" }} />

            <div className="space-y-4 font-[family-name:var(--font-mono)] text-sm relative z-10">
              <p className="text-[#FFB020] text-xs uppercase tracking-widest mb-5 flex items-center gap-2">
                <Activity size={12} className="animate-spin" /> SENTINEL TOKEN ANALYSIS RUNNING
              </p>
              {INVESTIGATION_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={"flex items-center gap-4 transition-all duration-500 " +
                    (i < currentStep ? "text-[#34D399] opacity-100 translate-x-0" :
                     i === currentStep ? "text-[#FFB020] opacity-100 translate-x-2" :
                     "text-[#7C8394] opacity-30 translate-x-0")}
                >
                  <span className="w-5 shrink-0 flex justify-center">
                    {i < currentStep ? <CheckCircle2 size={16} /> : i === currentStep ? <Activity size={16} className="animate-spin" /> : "·"}
                  </span>
                  <span>
                    {step}
                    {i === currentStep && <span className="animate-blink ml-1">_</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <div className="space-y-6 animate-in">
            
            {/* Primary Threat Score Card */}
            <div 
              className="relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8"
              style={{ boxShadow: `0 0 40px -10px ${severityGlow(result.report.threatLevel)}` }}
            >
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ 
                  background: `radial-gradient(circle at top right, ${severityColor(result.report.threatLevel)}, transparent 70%)` 
                }} 
              />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 justify-between">
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span className="text-[#7C8394] font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck size={16} /> Threat Analysis
                    </span>
                    <span
                      className="px-4 py-1.5 rounded-full text-xs font-bold font-[family-name:var(--font-mono)] tracking-wider"
                      style={{
                        color: severityColor(result.report.threatLevel),
                        backgroundColor: `${severityColor(result.report.threatLevel)}1A`,
                        border: `1px solid ${severityColor(result.report.threatLevel)}40`
                      }}
                    >
                      {result.report.threatLevel} RISK
                    </span>
                  </div>
                  <p className="text-[#E6E8EC] text-base sm:text-lg leading-relaxed">{result.report.summary}</p>
                </div>
                
                {/* Animated Score Ring */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
                      <circle 
                        cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                        strokeLinecap="round"
                        strokeDasharray="282.7"
                        strokeDashoffset={282.7 - (282.7 * displayScore) / 100}
                        style={{ color: severityColor(result.report.threatLevel) }}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-display)]" style={{ color: severityColor(result.report.threatLevel) }}>
                        {displayScore}
                      </span>
                      <span className="text-[10px] font-bold font-[family-name:var(--font-mono)] text-[#7C8394] uppercase tracking-widest mt-1">
                        Score
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Info + Market Data Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Token Info */}
              {result.metadata && (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 hover:bg-white/10 transition-colors">
                  <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] mb-5 flex items-center gap-2">
                    <Info size={16} /> TOKEN_INFO
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <span className="text-[#7C8394] text-sm">Name</span>
                      <span className="text-[#E6E8EC] font-bold truncate max-w-[160px]">{result.metadata.name || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <span className="text-[#7C8394] text-sm">Symbol</span>
                      <span className="text-[#E6E8EC] font-[family-name:var(--font-mono)] bg-[#FFB020]/10 border border-[#FFB020]/20 text-[#FFB020] px-2 py-0.5 rounded font-bold">{result.metadata.symbol || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#7C8394] text-sm">Decimals</span>
                      <span className="text-[#E6E8EC] font-[family-name:var(--font-mono)] tabular-nums">{result.metadata.decimals ?? "Unknown"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Data */}
              {result.marketData ? (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 hover:bg-white/10 transition-colors">
                  <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] mb-5 flex items-center gap-2">
                    <Activity size={16} /> MARKET_METRICS
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <span className="text-[#7C8394] text-sm flex items-center gap-2"><DollarSign size={14}/> Price</span>
                      <span className="text-[#34D399] font-[family-name:var(--font-mono)] font-bold tabular-nums">${result.marketData.priceUsd || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <span className="text-[#7C8394] text-sm flex items-center gap-2"><Droplets size={14}/> Liquidity</span>
                      <span className="text-[#E6E8EC] font-[family-name:var(--font-mono)] tabular-nums">${result.marketData.liquidityUsd?.toLocaleString() || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#7C8394] text-sm flex items-center gap-2"><PieChart size={14}/> Market Cap</span>
                      <span className="text-[#E6E8EC] font-[family-name:var(--font-mono)] tabular-nums">${result.marketData.marketCap?.toLocaleString() || "—"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-xl border border-[#FFB020]/10 rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center text-center">
                  <AlertTriangle size={28} className="text-[#FFB020] mb-3 opacity-60" />
                  <p className="text-sm text-[#7C8394] font-[family-name:var(--font-mono)]">
                    No active market data found.<br/>
                    <span className="text-[10px] opacity-70">Token likely has no DEX trading pair.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Security Analysis Card */}
            {result.security && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 hover:bg-white/10 transition-colors">
                <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] mb-5 flex items-center gap-2">
                  <Shield size={16} /> SECURITY_ANALYSIS
                  <span className="ml-auto text-[10px] text-[#4a5063]">via GoPlus</span>
                </h3>
                <div className="space-y-3 font-[family-name:var(--font-mono)] text-xs">

                  {/* Honeypot */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><ShieldAlert size={12} /> Honeypot</span>
                    {result.security.isHoneypot
                      ? <span className="text-[#FF3B3B] font-bold flex items-center gap-1"><AlertTriangle size={11} /> CONFIRMED</span>
                      : <span className="text-[#34D399] font-bold flex items-center gap-1"><CheckCircle2 size={11} /> SAFE</span>}
                  </div>

                  {/* Buy Tax */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><TrendingDown size={12} /> Buy Tax</span>
                    <span className={result.security.buyTax > 10 ? "text-[#FF3B3B] font-bold" : result.security.buyTax > 5 ? "text-[#FFB020] font-bold" : "text-[#34D399] font-bold"}>
                      {result.security.buyTax}%
                    </span>
                  </div>

                  {/* Sell Tax */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><TrendingDown size={12} /> Sell Tax</span>
                    <span className={result.security.sellTax > 10 ? "text-[#FF3B3B] font-bold" : result.security.sellTax > 5 ? "text-[#FFB020] font-bold" : "text-[#34D399] font-bold"}>
                      {result.security.sellTax}%
                    </span>
                  </div>

                  {/* Source Verified */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><Code size={12} /> Source Verified</span>
                    {result.security.isOpenSource
                      ? <span className="text-[#34D399] font-bold flex items-center gap-1"><CheckCircle2 size={11} /> YES</span>
                      : <span className="text-[#FF3B3B] font-bold flex items-center gap-1"><AlertTriangle size={11} /> NO</span>}
                  </div>

                  {/* Owner Renounced */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><Lock size={12} /> Owner Renounced</span>
                    {result.security.ownerRenounced
                      ? <span className="text-[#34D399] font-bold flex items-center gap-1"><CheckCircle2 size={11} /> YES</span>
                      : <span className="text-[#FFB020] font-bold flex items-center gap-1"><AlertTriangle size={11} /> NO</span>}
                  </div>

                  {/* Proxy */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><Code size={12} /> Upgradeable Proxy</span>
                    {result.security.isProxy
                      ? <span className="text-[#FFB020] font-bold">YES</span>
                      : <span className="text-[#34D399] font-bold">NO</span>}
                  </div>

                  {/* Holder Concentration */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><Users size={12} /> Top 10 Holders</span>
                    <span className={result.security.top10HolderPercent > 80 ? "text-[#FF3B3B] font-bold" : result.security.top10HolderPercent > 50 ? "text-[#FFB020] font-bold" : "text-[#34D399] font-bold"}>
                      {result.security.top10HolderPercent}%
                    </span>
                  </div>

                  {/* Holder Count */}
                  <div className="flex justify-between items-center bg-black/30 rounded-lg px-3 py-2.5">
                    <span className="text-[#7C8394] flex items-center gap-1.5"><Users size={12} /> Total Holders</span>
                    <span className="text-[#E6E8EC] font-bold">{result.security.holderCount.toLocaleString()}</span>
                  </div>

                  {/* CEX Listed */}
                  {result.security.isInCex && (
                    <div className="flex justify-between items-center bg-[#34D399]/5 border border-[#34D399]/20 rounded-lg px-3 py-2.5">
                      <span className="text-[#7C8394] flex items-center gap-1.5"><CheckCircle2 size={12} /> CEX Listed</span>
                      <span className="text-[#34D399] font-bold">{result.security.cexList.join(", ")}</span>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Detected Flags */}
            {result.flags && result.flags.length > 0 && (
              <div className="bg-[#120808]/80 backdrop-blur-xl border border-[#FF3B3B]/20 rounded-2xl p-5 sm:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF3B3B]/5 blur-3xl rounded-full" />
                <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#FF3B3B] mb-5 flex items-center gap-2 relative z-10">
                  <AlertTriangle size={16} /> DETECTED_FLAGS [{result.flags.length}]
                </h3>
                <div className="space-y-3 relative z-10">
                  {result.flags.map((flag: any, i: number) => (
                    <div 
                      key={i} 
                      className="flex items-start gap-4 bg-black/60 rounded-xl p-4 transition-colors hover:bg-black/80"
                      style={{ borderLeft: `3px solid ${flag.severity === "high" ? "#FF3B3B" : flag.severity === "medium" ? "#FFB020" : "#38BDF8"}` }}
                    >
                      <span
                        className="mt-0.5 shrink-0"
                        style={{ color: flag.severity === "high" ? "#FF3B3B" : flag.severity === "medium" ? "#FFB020" : "#38BDF8" }}
                      >
                        <ShieldAlert size={18} />
                      </span>
                      <div>
                        <span 
                          className="text-xs font-bold font-[family-name:var(--font-mono)] tracking-wider block mb-1"
                          style={{ color: flag.severity === "high" ? "#FF3B3B" : flag.severity === "medium" ? "#FFB020" : "#38BDF8" }}
                        >
                          {flag.severity.toUpperCase()} RISK
                        </span>
                        <p className="text-[#B4B9C4] text-sm leading-relaxed">{flag.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.flags && result.flags.length === 0 && (
              <div className="bg-black/40 border border-[#34D399]/20 rounded-xl p-4 text-center text-[#34D399] text-xs font-[family-name:var(--font-mono)] flex flex-col items-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.05)]">
                <CheckCircle2 size={24} />
                No threat flags detected. Contract appears clean.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}