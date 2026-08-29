"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import { 
  ArrowLeft, Search, Activity, ShieldAlert, ShieldCheck, 
  Wallet, Shield, CheckCircle2, AlertTriangle, Key, Send,
  Cpu, FileCode2, History, ChevronRight
} from "lucide-react";
import TransactionFlowChart from "@/components/TransactionFlowChart";


const INVESTIGATION_STEPS = [
  "Connecting to Base network...",
  "Fetching wallet transaction history...",
  "Scanning for suspicious approvals...",
  "Checking for phishing patterns...",
  "Analyzing with AI reasoning engine...",
  "Compiling threat report...",
];

export default function WalletScan() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [displayScore, setDisplayScore] = useState(0);

  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

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
    setChatMessages([]);
    const timer = setTimeout(() => setDisplayScore(result.report.riskScore), 100);
    return () => clearTimeout(timer);
  }, [result]);

  async function handleInvestigate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/investigate", {
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
    } catch (err) {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  async function handleChatSend() {
    if (!chatInput.trim() || !result) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user", content: userMessage }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: {
            address: result.address,
            riskScore: result.report.riskScore,
            threatLevel: result.report.threatLevel,
            summary: result.report.summary,
            flags: result.flags,
            activeApprovals: result.activeApprovals,
            permits: result.permits,
          },
          history: chatMessages,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages([...newMessages, { role: "assistant", content: data.reply }]);
      } else {
        setChatMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't process that." }]);
      }
    } catch (err) {
      setChatMessages([...newMessages, { role: "assistant", content: "Failed to reach the server." }]);
    } finally {
      setChatLoading(false);
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
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#38BDF8] opacity-10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Back nav */}
        <Link
          href="/scan"
          className="group flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs text-[#7C8394] hover:text-[#38BDF8] transition-colors w-fit mb-8"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          RETURN TO DASHBOARD
        </Link>

        {/* Header section */}
        <div className="flex flex-col gap-2 mb-10">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="absolute w-full h-full rounded-full bg-[#38BDF8] opacity-75 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-[#38BDF8]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              WALLET SCANNER
            </h1>
          </div>
          <p className="font-[family-name:var(--font-mono)] text-sm text-[#7C8394] ml-6">
            // investigate onchain footprint & phishing risks
          </p>
        </div>

        {/* Input section */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 mb-8 shadow-2xl transition-all duration-300 hover:border-white/20 hover:bg-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#38BDF8]/10 blur-3xl rounded-full" />
          
          <div className="flex flex-col sm:flex-row gap-3 relative z-10">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Wallet size={18} className="text-[#7C8394] group-focus-within:text-[#38BDF8] transition-colors" />
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter wallet address (0x...)"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-[#E6E8EC] placeholder-[#4a5063] font-[family-name:var(--font-mono)] text-sm focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all"
              />
            </div>
            <button
              onClick={handleInvestigate}
              disabled={loading || !address}
              className="bg-gradient-to-r from-[#38BDF8] to-[#0ea5e9] hover:from-[#0ea5e9] hover:to-[#0284c7] disabled:from-[#242938] disabled:to-[#242938] disabled:text-[#4a5063] disabled:cursor-not-allowed text-white rounded-xl px-8 py-4 font-bold font-[family-name:var(--font-mono)] text-sm transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] disabled:shadow-none flex items-center justify-center gap-2 sm:min-w-[140px]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Activity size={16} className="animate-spin" /> SCANNING
                </div>
              ) : "INVESTIGATE"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 rounded-xl p-4 mb-8 text-[#FF3B3B] font-[family-name:var(--font-mono)] text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <ShieldAlert size={18} /> {error}
          </div>
        )}

        {/* Loader Screen */}
        {loading && (
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-6 relative overflow-hidden animate-in fade-in duration-300">
            <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 rounded-full border border-[#38BDF8]/20 animate-radar opacity-50" />
            <div className="space-y-4 font-[family-name:var(--font-mono)] text-sm relative z-10">
              {INVESTIGATION_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={"flex items-center gap-4 transition-all duration-500 " + 
                    (i < currentStep ? "text-[#34D399] opacity-100 translate-x-0" : 
                     i === currentStep ? "text-[#38BDF8] opacity-100 translate-x-2" : 
                     "text-[#7C8394] opacity-30 translate-x-0")}
                >
                  <span className="w-5 shrink-0 flex justify-center">
                    {i < currentStep ? <CheckCircle2 size={16} /> : i === currentStep ? <Activity size={16} className="animate-spin" /> : " "}
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

        {/* Results Screen */}
        {result && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            
            {/* Primary Threat Score Card */}
            <div 
              className="relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
              style={{ boxShadow: `0 0 40px -10px ${severityGlow(result.report.threatLevel)}` }}
            >
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ 
                  background: `radial-gradient(circle at top right, ${severityColor(result.report.threatLevel)}, transparent 70%)` 
                }} 
              />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-6">
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
                  <p className="text-[#E6E8EC] text-lg leading-relaxed">{result.report.summary}</p>
                  
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/monitor?address=${address}`}
                      className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#38BDF8]/50 text-[#38BDF8] rounded-xl px-4 py-2 text-sm font-bold font-[family-name:var(--font-mono)] transition-colors shadow-sm"
                    >
                      <Activity size={16} /> MONITOR_WALLET
                    </Link>
                  </div>
                </div>
                
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative flex items-center justify-center w-32 h-32">
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
                      <span className="text-4xl font-bold font-[family-name:var(--font-display)]" style={{ color: severityColor(result.report.threatLevel) }}>
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

            {/* AI Recommendations */}
            {result.report.recommendations && result.report.recommendations.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] mb-4 flex items-center gap-2">
                  <Shield size={16} /> RECOMMENDED_ACTIONS
                </h3>
                <ul className="space-y-3">
                  {result.report.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-[#E6E8EC] text-sm flex gap-3 items-start bg-black/30 rounded-lg p-3">
                      <ChevronRight size={16} className="text-[#38BDF8] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
                {result.report.revokeUrl && (
                  <a
                    href={result.report.revokeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-6 bg-[#FF3B3B]/10 hover:bg-[#FF3B3B]/20 text-[#FF3B3B] border border-[#FF3B3B]/30 rounded-xl px-5 py-2.5 text-sm font-bold font-[family-name:var(--font-mono)] transition-colors shadow-sm"
                  >
                    <AlertTriangle size={16} /> REVOKE_APPROVALS
                  </a>
                )}
              </div>
            )}

            {/* Active Approvals */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFB020]/5 blur-3xl rounded-full" />
              <div className="flex justify-between items-center mb-5 relative z-10">
                <div className="flex items-center gap-3">
                  <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] flex items-center gap-2">
                    <Key size={16} /> ACTIVE_APPROVALS [{result.activeApprovals?.length || 0}]
                  </h3>
                  {result.approvalScanMeta && (
                    <span className="text-[10px] text-[#4a5063] font-[family-name:var(--font-mono)] bg-black/40 px-2 py-0.5 rounded">
                      ({Number(result.approvalScanMeta.totalScannedBlocks).toLocaleString()} BLOCKS)
                    </span>
                  )}
                </div>
                {result.activeApprovals && result.activeApprovals.length > 0 && (
                  <a
                    href={`https://revoke.cash/address/${address}?chainId=8453`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-[#FF3B3B]/10 hover:bg-[#FF3B3B]/20 text-[#FF3B3B] border border-[#FF3B3B]/30 px-3 py-1.5 rounded-lg font-bold font-[family-name:var(--font-mono)] transition-colors"
                  >
                    REVOKE_ALL
                  </a>
                )}
              </div>

              {result.activeApprovals && result.activeApprovals.length > 0 ? (
                <div className="space-y-3 font-[family-name:var(--font-mono)] text-xs relative z-10">
                  {result.activeApprovals.map((app: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-black/60 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#E6E8EC] text-base bg-white/10 px-2 py-0.5 rounded">
                            {app.tokenSymbol}
                          </span>
                          <a
                            href={`https://basescan.org/token/${app.tokenAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#38BDF8] hover:underline text-[10px] ml-1"
                          >
                            {app.tokenAddress.slice(0, 6)}...{app.tokenAddress.slice(-4)} ↗
                          </a>
                        </div>
                        {app.isUnlimited ? (
                          <span className="px-2 py-1 rounded bg-[#FF3B3B]/15 text-[#FF3B3B] font-bold text-[10px] border border-[#FF3B3B]/30 shadow-[0_0_10px_rgba(255,59,59,0.2)]">
                            UNLIMITED
                          </span>
                        ) : (
                          <span className="text-[#34D399] font-bold bg-[#34D399]/10 px-2 py-1 rounded border border-[#34D399]/20">
                            {app.allowanceFormatted} {app.tokenSymbol}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-[#B4B9C4]">
                        <div className="flex justify-between items-center bg-black/40 rounded p-2 border border-white/5">
                          <span className="text-[#7C8394] text-[10px] uppercase">Spender</span>
                          <div className="flex items-center gap-3">
                            <a
                              href={`https://basescan.org/address/${app.spender}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#38BDF8] hover:underline font-bold"
                            >
                              {app.spender.slice(0, 8)}...{app.spender.slice(-6)}
                            </a>
                            {app.spenderIsContract ? (
                              <span className="px-2 py-0.5 rounded bg-[#38BDF8]/10 text-[#38BDF8] text-[10px] border border-[#38BDF8]/20 flex items-center gap-1">
                                <FileCode2 size={10} /> CONTRACT
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-[#FF3B3B]/20 text-[#FF3B3B] text-[10px] font-bold border border-[#FF3B3B]/40 animate-pulse flex items-center gap-1 shadow-[0_0_10px_rgba(255,59,59,0.3)]">
                                <AlertTriangle size={10} /> EOA / PRIVATE
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center px-1 text-[11px] pt-1">
                          <span className="text-[#7C8394] flex items-center gap-1">
                            <History size={12} /> Block #{app.lastUpdatedBlock}
                          </span>
                          <a
                            href={`https://revoke.cash/address/${address}?chainId=8453`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FFB020] hover:text-[#ffc04d] hover:underline font-bold"
                          >
                            Revoke ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-black/40 border border-[#34D399]/20 rounded-xl text-center text-[#34D399] text-xs font-[family-name:var(--font-mono)] flex flex-col items-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                  <CheckCircle2 size={24} />
                  No active unrevoked token approvals detected onchain. Wallet appears clean.
                </div>
              )}
            </div>

            {/* Detected Permits */}
            {result.permits && result.permits.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] mb-4 flex items-center gap-2">
                  <FileCode2 size={16} /> DETECTED_PERMITS [{result.permits.length}]
                </h3>
                <div className="space-y-3 font-[family-name:var(--font-mono)] text-xs">
                  {result.permits.map((permit: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-black/60 border border-white/5 rounded-xl p-4 flex justify-between items-center hover:border-white/10 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#38BDF8]/10 text-[#38BDF8] text-[10px] border border-[#38BDF8]/20 font-bold tracking-widest">
                            {permit.type}
                          </span>
                          <span className="text-[#7C8394] text-[10px]">
                            {permit.selector}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#B4B9C4] flex items-center gap-2">
                          <span className="text-[#7C8394]">Target:</span> 
                          <span className="bg-white/5 px-2 py-0.5 rounded">{permit.to?.slice(0, 8)}...{permit.to?.slice(-6)}</span>
                        </div>
                      </div>
                      {permit.txHash && (
                        <a
                          href={`https://basescan.org/tx/${permit.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white/5 hover:bg-white/10 text-[#38BDF8] border border-white/5 rounded-lg px-3 py-2 transition-colors font-bold flex items-center gap-1"
                        >
                          View <ChevronRight size={14}/>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detected Flags */}
            {result.flags && result.flags.length > 0 && (
              <div className="bg-[#120808]/80 backdrop-blur-xl border border-[#FF3B3B]/20 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF3B3B]/5 blur-3xl rounded-full" />
                <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#FF3B3B] mb-5 flex items-center gap-2">
                  <AlertTriangle size={16} /> DETECTED_FLAGS [{result.flags.length}]
                </h3>
                <div className="space-y-4 font-[family-name:var(--font-mono)] text-sm relative z-10">
                  {result.flags.map((flag: any, i: number) => (
                    <div key={i} className="bg-black/60 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
                      <div className="flex items-start gap-4 mb-3">
                        <span
                          className="mt-0.5"
                          style={{ color: flag.severity === "high" ? "#FF3B3B" : flag.severity === "medium" ? "#FFB020" : "#38BDF8" }}
                        >
                          <ShieldAlert size={20} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="text-xs font-bold font-[family-name:var(--font-mono)] tracking-wider"
                              style={{ color: flag.severity === "high" ? "#FF3B3B" : flag.severity === "medium" ? "#FFB020" : "#38BDF8" }}
                            >
                              {flag.severity.toUpperCase()} RISK
                            </span>
                          </div>
                          <p className="text-[#E6E8EC] leading-relaxed text-sm">{flag.message}</p>
                        </div>
                      </div>
                      
                      {/* Flag Details / TXs */}
                      {flag.details && flag.details.length > 0 && (
                        <div className="ml-9 mt-4 space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                          {flag.details.slice(0, 15).map((d: any, j: number) => {
                            const timestamp = new Date(d.timestamp);
                            return (
                              <div key={j} className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                                  <span className="text-[#FFB020] font-bold text-xs bg-[#FFB020]/10 px-2 py-0.5 rounded">{d.asset}</span>
                                  <span className="text-[10px] text-[#7C8394]">{timestamp.toLocaleString()}</span>
                                </div>
                                <div className="text-[11px] space-y-1.5 text-[#B4B9C4]">
                                  <div className="flex justify-between">
                                    <span className="text-[#7C8394]">FROM</span>
                                    <a href={`https://basescan.org/address/${d.from}`} target="_blank" rel="noopener noreferrer" className="text-[#38BDF8] hover:underline font-bold">
                                      {d.from.slice(0,8)}...{d.from.slice(-6)}
                                    </a>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#7C8394]">TO</span>
                                    <span className="font-bold">{address.slice(0,8)}...{address.slice(-6)}</span>
                                  </div>
                                  {d.value && (
                                    <div className="flex justify-between">
                                      <span className="text-[#7C8394]">VALUE</span>
                                      <span className="text-white font-bold">{d.value}</span>
                                    </div>
                                  )}
                                  {d.hash && (
                                    <div className="flex justify-between pt-1">
                                      <span className="text-[#7C8394]">TX</span>
                                      <a href={`https://basescan.org/tx/${d.hash}`} target="_blank" rel="noopener noreferrer" className="text-[#38BDF8] hover:underline truncate max-w-[120px]">
                                        {d.hash}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {flag.details.length > 15 && (
                            <div className="text-xs text-[#7C8394] p-3 text-center bg-white/5 rounded-lg border border-white/5 border-dashed">
                              +{flag.details.length - 15} additional transfers omitted
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fund Trace Analysis (Graph Intelligence) */}
            {(result.outflowContext || (result.trail && result.trail.length > 0)) && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] mb-5 flex items-center gap-2">
                  <Activity size={16} /> TRANSACTION_GRAPH_ANALYSIS
                  <span className="ml-auto text-[10px] text-[#4a5063]">via Sentinel</span>
                </h3>
                
                {/* Outflow Context Alert */}
                {result.outflowContext && (
                  <div className="mb-4 bg-black/40 border border-white/5 rounded-xl p-4 text-xs font-[family-name:var(--font-mono)]">
                    <span className="text-[#7C8394] block mb-1">DESTINATION_CONTEXT:</span>
                    <span className={result.outflowContext.safe ? "text-[#34D399]" : result.outflowContext.isFresh ? "text-[#FF3B3B]" : "text-[#FFB020]"}>
                      {result.outflowContext.name}
                      {result.outflowContext.type && result.outflowContext.type !== "UNKNOWN" && ` [${result.outflowContext.type}]`}
                      {result.outflowContext.firstSeenDaysAgo !== undefined && ` — ${result.outflowContext.firstSeenDaysAgo}d old wallet`}
                    </span>
                  </div>
                )}

                {(() => {
                  const nodes: any[] = [];
                  const edges: any[] = [];
                  const seenIds = new Set<string>();

                  const addNode = (node: any) => {
                    if (!seenIds.has(node.id)) {
                      seenIds.add(node.id);
                      nodes.push(node);
                    }
                  };

                  // Center node — the investigated wallet
                  addNode({
                    id: result.address.toLowerCase(),
                    address: result.address,
                    label: "Target Wallet",
                    isCenter: true,
                  });

                  // Build graph from multi-hop trail
                  if (result.trail && result.trail.length > 0) {
                    result.trail.forEach((hop: any) => {
                      // Add the hop address as a node
                      if (hop.address.toLowerCase() !== result.address.toLowerCase()) {
                        addNode({
                          id: hop.address.toLowerCase(),
                          address: hop.address,
                          label: hop.label || "Unknown Wallet",
                          entityType: hop.entityType || "UNKNOWN",
                          safe: hop.safe,
                          isFresh: hop.isFresh,
                          amount: hop.incomingAmount,
                        });
                      }

                      // Add the outflow destination
                      if (hop.outflowTo) {
                        addNode({
                          id: hop.outflowTo.toLowerCase(),
                          address: hop.outflowTo,
                          label: hop.outflowToLabel || "Unknown Wallet",
                          entityType: hop.outflowToEntityType || "UNKNOWN",
                          safe: hop.outflowToSafe,
                          amount: hop.outflowAmount,
                        });

                        edges.push({
                          from: hop.address.toLowerCase(),
                          to: hop.outflowTo.toLowerCase(),
                          label: `${hop.outflowAmount} ETH`,
                          isRisky: !hop.outflowToSafe,
                        });
                      }
                    });
                  } else if (result.outflowContext) {
                    // Fallback: direct 2-node graph from outflowContext alone
                    const destId = result.outflowContext.address?.toLowerCase() || "destination";
                    const outflowFlag = result.flags?.find((f: any) => f.type === "LARGE_OUTFLOW");
                    const ethMatch = outflowFlag?.message?.match(/([\d.]+)\s*ETH/);
                    const ethAmount = ethMatch ? ethMatch[1] : "?";

                    addNode({
                      id: destId,
                      address: result.outflowContext.address || destId,
                      label: result.outflowContext.name || "Unknown Wallet",
                      entityType: result.outflowContext.type || "UNKNOWN",
                      safe: result.outflowContext.safe,
                      isFresh: result.outflowContext.isFresh,
                      amount: ethAmount,
                    });
                    edges.push({
                      from: result.address.toLowerCase(),
                      to: destId,
                      label: `${ethAmount} ETH`,
                      isRisky: !result.outflowContext.safe,
                    });
                  }

                  if (nodes.length < 2) return null;
                  return <TransactionFlowChart centerAddress={result.address} nodes={nodes} edges={edges} />;
                })()}
              </div>
            )}

            {/* AI Chat Interface */}
            <div className="bg-black/40 backdrop-blur-xl border border-[#38BDF8]/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(56,189,248,0.05)]">
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#38BDF8]/10 blur-[100px] rounded-full pointer-events-none" />
              <h3 className="font-[family-name:var(--font-mono)] text-xs text-[#38BDF8] mb-5 flex items-center gap-2 relative z-10 font-bold tracking-wider">
                <Cpu size={16} /> SENTINEL_AI_CORE
              </h3>

              <div className="relative z-10">
                {chatMessages.length > 0 ? (
                  <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                        <div
                          className={
                            "max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed " +
                            (msg.role === "user"
                              ? "bg-gradient-to-r from-[#38BDF8]/20 to-[#0ea5e9]/20 text-white border border-[#38BDF8]/30 rounded-br-none"
                              : "bg-black/60 text-[#B4B9C4] border border-white/10 rounded-bl-none shadow-md")
                          }
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-black/60 border border-white/10 rounded-2xl rounded-bl-none p-4 text-sm text-[#7C8394] font-[family-name:var(--font-mono)] flex items-center gap-2">
                          <Activity size={14} className="animate-spin text-[#38BDF8]" /> processing<span className="animate-blink">...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 text-center">
                    <p className="text-[#B4B9C4] text-sm">
                      Have questions about this investigation? Ask the Sentinel AI Core.
                    </p>
                    <p className="text-[#7C8394] text-xs mt-2 font-[family-name:var(--font-mono)]">
                      e.g. &quot;What should I do first?&quot; or &quot;Explain the outflow to me.&quot;
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                    placeholder="Query the AI engine..."
                    disabled={chatLoading}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-[#7C8394] font-[family-name:var(--font-mono)] text-sm focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-[#38BDF8] hover:bg-[#0ea5e9] disabled:bg-white/5 disabled:text-[#4a5063] disabled:cursor-not-allowed text-black rounded-xl px-6 py-4 text-sm font-bold font-[family-name:var(--font-mono)] transition-all flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.3)] disabled:shadow-none min-w-[100px]"
                  >
                    {chatLoading ? <Activity size={18} className="animate-spin" /> : <Send size={18} />}
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