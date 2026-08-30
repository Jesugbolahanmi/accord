"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, Activity, ShieldAlert, ShieldCheck, 
  Wallet, Shield, CheckCircle2, AlertTriangle, Key, Send,
  Cpu, History, TerminalSquare, Info, Network, Clock, FileKey
} from "lucide-react";
import TransactionFlowChart from "@/components/TransactionFlowChart";

const INVESTIGATION_STEPS = [
  "CONNECTING_TO_BASE_RPC",
  "FETCHING_TRANSACTION_HISTORY",
  "SCANNING_ERC20_APPROVALS",
  "DETECTING_PERMIT_SIGNATURES",
  "ANALYZING_FUND_FLOWS",
  "COMPILING_THREAT_REPORT",
];

export default function WalletScan() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [displayScore, setDisplayScore] = useState(0);
  const [showGraph, setShowGraph] = useState(false);

  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    setCurrentStep(0);
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= INVESTIGATION_STEPS.length - 1) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!result) return;
    setDisplayScore(0);
    setShowGraph(false);
    setChatMessages([]);
    const timer = setTimeout(() => setDisplayScore(result.report.riskScore), 100);
    return () => clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  async function handleInvestigate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!address) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "SYSTEM_FAILURE");
      else setResult(data);
    } catch { setError("NETWORK_DISCONNECT"); }
    finally { setLoading(false); }
  }

  async function handleChatSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
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
          },
          history: chatMessages,
        }),
      });
      const data = await res.json();
      setChatMessages([...newMessages, { role: "assistant", content: res.ok ? data.reply : "ERR: PROCESSING_FAILED" }]);
    } catch { setChatMessages([...newMessages, { role: "assistant", content: "ERR: CONNECTION_LOST" }]); }
    finally { setChatLoading(false); }
  }

  const severityColor = (level: string) => {
    if (level === "CRITICAL" || level === "HIGH") return "#FF1E1E";
    if (level === "MEDIUM") return "#FFB020";
    return "#00FF66";
  };

  const flagSeverityColor = (s: string) => {
    if (s === "high" || s === "critical") return "#FF1E1E";
    if (s === "medium") return "#FFB020";
    return "#00E5FF";
  };

  // Build graph nodes & edges from result
  // Use the BFS tree returned by the API directly — no client-side reassembly needed
  const buildGraph = (result: any) => {
    // Primary: use the new BFS traceTree from the API
    if (result.traceTree?.nodes?.length >= 2) {
      return {
        nodes: result.traceTree.nodes,
        edges: result.traceTree.edges,
      };
    }

    // Fallback: single-hop from outflowContext (for wallets where trace returned nothing)
    const nodes: any[] = [];
    const edges: any[] = [];
    const seenIds = new Set<string>();
    const addNode = (n: any) => { if (!seenIds.has(n.id)) { seenIds.add(n.id); nodes.push(n); } };

    addNode({ id: result.address.toLowerCase(), address: result.address, label: "TARGET_WALLET", isCenter: true, entityType: "CENTER" });

    if (result.outflowContext) {
      const destId = result.outflowContext.address?.toLowerCase() || "destination";
      const outflowFlag = result.flags?.find((f: any) => f.type === "LARGE_OUTFLOW");
      const ethMatch = outflowFlag?.message?.match(/([\d.]+)\s*ETH/);
      const ethAmount = ethMatch ? ethMatch[1] : "?";
      addNode({ id: destId, address: result.outflowContext.address || destId, label: result.outflowContext.name || "UNKNOWN_NODE", entityType: result.outflowContext.type || "UNKNOWN", safe: result.outflowContext.safe, isFresh: result.outflowContext.isFresh, amount: ethAmount });
      edges.push({ from: result.address.toLowerCase(), to: destId, label: `${ethAmount} ETH`, isRisky: !result.outflowContext.safe });
    }

    return { nodes, edges };
  };


  return (
    <main className="flex-1 lg:h-full flex flex-col bg-black text-white lg:overflow-hidden relative overflow-y-auto min-h-screen lg:min-h-0">
      
      {/* Top Header / Search Bar */}
      <header className="h-14 shrink-0 border-b border-white/5 bg-[#050505] flex items-center px-4 justify-between z-20 relative">
        <div className="flex items-center gap-4">
          <TerminalSquare size={16} className="text-[#00E5FF]" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase text-[#888888] hidden sm:inline-block">
            MOD: WALLET_FORENSICS
          </span>
        </div>
        
        <form onSubmit={handleInvestigate} className="flex-1 max-w-xl mx-2 flex items-center bg-black border border-white/10 group focus-within:border-[#00E5FF]/50 transition-colors">
          <div className="pl-3 hidden sm:block">
            <Search size={14} className="text-[#4a5063] group-focus-within:text-[#00E5FF]" />
          </div>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter wallet address (0x...)"
            className="flex-1 bg-transparent border-none text-white font-[family-name:var(--font-mono)] text-xs px-3 py-2 focus:outline-none focus:ring-0 placeholder-[#4a5063] w-full"
          />
          <button type="submit" disabled={loading || !address}
            className="bg-white/5 hover:bg-[#00E5FF] hover:text-black text-[#888888] px-3 sm:px-4 py-2 text-[10px] font-bold font-[family-name:var(--font-mono)] transition-colors border-l border-white/10 disabled:opacity-50">
            {loading ? "SCAN…" : "EXECUTE"}
          </button>
        </form>

        <div className="flex items-center gap-2">
          {error && <span className="text-[10px] text-[#FF1E1E] font-[family-name:var(--font-mono)] tracking-widest hidden md:inline-block">{error}</span>}
          <div className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-1 lg:overflow-hidden relative">
        {!result && !loading ? (
          <div className="w-full h-full min-h-[400px] border border-white/5 bg-[#050505] flex items-center justify-center flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" style={{ backgroundSize: '30px' }} />
            <Cpu size={48} className="text-white/10 mb-4" />
            <h2 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-black uppercase tracking-widest text-[#4a5063]">AWAITING_INPUT</h2>
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-[#4a5063] mt-2 uppercase tracking-widest">Enter a wallet address to begin forensic analysis</p>
          </div>
        ) : loading ? (
          <div className="w-full h-full min-h-[400px] border border-white/5 bg-[#050505] flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] rounded-full border border-[#00E5FF]/10 animate-radar opacity-50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] sm:w-[400px] sm:h-[400px] rounded-full border border-[#00E5FF]/20 animate-radar" style={{animationDelay: '0.5s'}} />
            <div className="font-[family-name:var(--font-mono)] text-[10px] sm:text-xs text-[#00E5FF] flex flex-col gap-3 relative z-10 w-72">
              {INVESTIGATION_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 transition-opacity duration-300 ${i <= currentStep ? 'opacity-100' : 'opacity-0'}`}>
                  <span className="w-4 shrink-0">
                    {i < currentStep ? <CheckCircle2 size={14} className="text-[#00FF66]"/> : i === currentStep ? <Activity size={14} className="animate-spin text-[#00E5FF]"/> : ""}
                  </span>
                  <span className={i === currentStep ? "text-[#00E5FF] font-bold" : "text-[#888888]"}>&gt; {step}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ── Results Grid ──────────────────────────────────────────────────
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-1 lg:h-full">

            {/* ── COLUMN 1: Threat Score + Flags ── */}
            <div className="col-span-1 flex flex-col gap-1 lg:overflow-hidden min-h-[600px] lg:min-h-0">

              {/* Score Widget */}
              <div className="border border-white/5 bg-[#050505] p-5 shrink-0 relative overflow-hidden" style={{ maxHeight: '55%' }}>
                <div className="absolute top-0 right-0 w-40 h-40 blur-[60px] opacity-15 pointer-events-none" style={{ backgroundColor: severityColor(result.report.threatLevel) }} />
                
                <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] mb-4 flex items-center gap-2">
                  <ShieldCheck size={12} /> THREAT_ANALYSIS
                </h3>

                <div className="flex items-end gap-5 mb-4">
                  <div className="font-[family-name:var(--font-display)] text-7xl font-black leading-none" style={{ color: severityColor(result.report.threatLevel) }}>
                    {displayScore}
                  </div>
                  <div className="pb-2">
                    <div className="text-[11px] font-bold font-[family-name:var(--font-mono)] px-2 py-1 inline-block border tracking-widest" 
                      style={{ color: severityColor(result.report.threatLevel), borderColor: `${severityColor(result.report.threatLevel)}50`, backgroundColor: `${severityColor(result.report.threatLevel)}15` }}>
                      {result.report.threatLevel}_RISK
                    </div>
                    <div className="text-[10px] text-[#888888] font-[family-name:var(--font-mono)] mt-1">/ 100 RISK SCORE</div>
                  </div>
                </div>

                {/* Summary — scrollable so it doesn't push flags out of view */}
                <div className="border-l-2 pl-3 mt-2 overflow-y-auto custom-scrollbar" style={{ borderColor: `${severityColor(result.report.threatLevel)}60`, maxHeight: '120px' }}>
                  <p className="text-[11px] text-[#CCCCCC] leading-relaxed font-[family-name:var(--font-mono)]">
                    {result.report.summary}
                  </p>
                </div>

                {result.report.revokeUrl && (
                  <a href={result.report.revokeUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-[#FF1E1E]/10 hover:bg-[#FF1E1E]/20 text-[#FF1E1E] border border-[#FF1E1E]/40 px-3 py-2.5 text-[11px] font-bold font-[family-name:var(--font-mono)] tracking-widest uppercase transition-colors">
                    <ShieldAlert size={12} /> REVOKE_ALL_APPROVALS
                  </a>
                )}
              </div>

              {/* Threat Flags */}
              <div className="border border-white/5 bg-[#050505] flex-1 flex flex-col lg:overflow-hidden min-h-[280px] lg:min-h-0">
                <div className="p-3 border-b border-white/5 shrink-0 flex items-center justify-between">
                  <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#FF1E1E] flex items-center gap-2">
                    <ShieldAlert size={12} /> THREAT_LOGS
                  </h3>
                  <span className="font-[family-name:var(--font-mono)] text-[9px] text-[#FF1E1E] bg-[#FF1E1E]/10 border border-[#FF1E1E]/20 px-2 py-0.5">
                    {result.flags?.length || 0} FLAGS
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {result.flags?.length > 0 ? result.flags.map((flag: any, i: number) => (
                    <div key={i} className="bg-black/60 border font-[family-name:var(--font-mono)]"
                      style={{ borderColor: `${flagSeverityColor(flag.severity)}40`, borderLeftWidth: '3px', borderLeftColor: flagSeverityColor(flag.severity) }}>
                      
                      {/* Flag header */}
                      <div className="px-3 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: `${flagSeverityColor(flag.severity)}20` }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: flagSeverityColor(flag.severity) }} />
                        <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: flagSeverityColor(flag.severity) }}>
                          {(flag.severity || 'info').toUpperCase()}
                        </span>
                        <span className="text-[#4a5063] text-[9px]">·</span>
                        <span className="text-[9px] text-[#888888] uppercase tracking-widest">{flag.type}</span>
                      </div>

                      {/* Flag message */}
                      <div className="px-3 py-2.5">
                        <p className="text-[11px] text-[#E0E0E0] leading-relaxed">{flag.message}</p>
                      </div>

                      {/* Flag details — always visible, never hidden */}
                      {flag.details?.length > 0 && (
                        <div className="px-3 pb-3 space-y-1.5">
                          <div className="text-[8px] uppercase tracking-widest text-[#4a5063] mb-2">INVOLVED_ADDRESSES</div>
                          {flag.details.map((d: any, j: number) => (
                            <div key={j} className="bg-black/60 border border-white/5 p-2 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] text-[#888888] uppercase tracking-widest shrink-0">ASSET</span>
                                <span className="text-[10px] text-white font-bold truncate text-right">{d.asset}</span>
                              </div>
                              {d.from && (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] text-[#888888] uppercase tracking-widest shrink-0">FROM</span>
                                  <a
                                    href={`https://basescan.org/address/${d.from}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] text-[#00E5FF] hover:underline font-mono truncate text-right"
                                    title={d.from}
                                  >
                                    {d.from.slice(0, 8)}…{d.from.slice(-6)}
                                  </a>
                                </div>
                              )}
                              {d.hash && (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] text-[#888888] uppercase tracking-widest shrink-0">TX</span>
                                  <a
                                    href={`https://basescan.org/tx/${d.hash}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] text-[#FFB020] hover:underline font-mono truncate text-right"
                                  >
                                    {d.hash.slice(0, 8)}…{d.hash.slice(-6)}
                                  </a>
                                </div>
                              )}
                              {d.timestamp && (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] text-[#888888] uppercase tracking-widest shrink-0">TIME</span>
                                  <span className="text-[10px] text-[#666666]">
                                    {new Date(d.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 py-10">
                      <ShieldCheck size={28} className="text-[#00FF66]/40" />
                      <span className="text-[#00FF66] text-[11px] font-[family-name:var(--font-mono)] tracking-widest">NO_THREATS_DETECTED</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── COLUMN 2 & 3: Intel Grid + Trace ── */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-1 lg:overflow-hidden">

              {/* Top row: 3 stat cards */}
              <div className="grid grid-cols-3 gap-1 shrink-0">
                {/* Entity Type */}
                <div className="border border-white/5 bg-[#050505] p-4 flex flex-col gap-1 hover:border-white/10 transition-colors">
                  <span className="font-[family-name:var(--font-mono)] text-[8px] uppercase tracking-widest text-[#4a5063] flex items-center gap-1.5">
                    <Info size={10} /> ENTITY_TYPE
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[13px] font-bold text-[#00E5FF] mt-1">
                    {result.isContract ? "CONTRACT" : "EOA_WALLET"}
                  </span>
                </div>
                {/* First Seen */}
                <div className="border border-white/5 bg-[#050505] p-4 flex flex-col gap-1 hover:border-white/10 transition-colors">
                  <span className="font-[family-name:var(--font-mono)] text-[8px] uppercase tracking-widest text-[#4a5063] flex items-center gap-1.5">
                    <Clock size={10} /> FIRST_SEEN
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[13px] font-bold text-white mt-1">
                    {result.walletMeta?.firstTxTimestamp
                      ? new Date(result.walletMeta.firstTxTimestamp).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
                      : "UNKNOWN"}
                  </span>
                </div>
                {/* Permits */}
                <div className="border border-white/5 bg-[#050505] p-4 flex flex-col gap-1 hover:border-white/10 transition-colors">
                  <span className="font-[family-name:var(--font-mono)] text-[8px] uppercase tracking-widest text-[#4a5063] flex items-center gap-1.5">
                    <FileKey size={10} /> PERMITS
                  </span>
                  <span className={`font-[family-name:var(--font-mono)] text-[13px] font-bold mt-1 ${result.permits?.hasPermits ? "text-[#FF1E1E]" : "text-[#00FF66]"}`}>
                    {result.permits?.hasPermits ? `${result.permits.permitsFound.length} FOUND` : "CLEAN"}
                  </span>
                </div>
              </div>

              {/* Active Approvals Table */}
              <div className="border border-white/5 bg-[#050505] shrink-0 flex flex-col" style={{ maxHeight: '200px', minHeight: '130px' }}>
                <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0">
                  <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                    <Key size={12} /> ACTIVE_APPROVALS
                  </h3>
                  <span className={`font-[family-name:var(--font-mono)] text-[9px] px-2 py-0.5 border ${result.activeApprovals?.length > 0 ? 'text-[#FF1E1E] border-[#FF1E1E]/20 bg-[#FF1E1E]/5' : 'text-[#00FF66] border-[#00FF66]/20 bg-[#00FF66]/5'}`}>
                    {result.activeApprovals?.length || 0} ACTIVE
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {result.activeApprovals?.length > 0 ? (
                    <table className="w-full text-left font-[family-name:var(--font-mono)] text-[11px]">
                      <thead className="text-[#555555] sticky top-0 bg-[#050505] z-10 border-b border-white/5">
                        <tr>
                          <th className="font-normal py-2 px-3">ASSET</th>
                          <th className="font-normal py-2 px-3">SPENDER</th>
                          <th className="font-normal py-2 px-3">ALLOWANCE</th>
                          <th className="font-normal py-2 px-3 text-right">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.activeApprovals.map((app: any, idx: number) => (
                          <tr key={idx} className="border-t border-white/5 hover:bg-white/5 transition-colors group">
                            <td className="py-2.5 px-3 text-white font-bold">{app.tokenSymbol}</td>
                            <td className="py-2.5 px-3">
                              <a href={`https://basescan.org/address/${app.spender}`} target="_blank" rel="noopener noreferrer" className="text-[#00E5FF] hover:underline">
                                {app.spender.slice(0,8)}…{app.spender.slice(-4)}
                              </a>
                              {!app.spenderIsContract && <span className="ml-2 text-[#FF1E1E] text-[9px] animate-pulse">EOA!</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              {app.isUnlimited
                                ? <span className="text-[#FF1E1E] font-bold">UNLIMITED ⚠</span>
                                : <span className="text-[#00FF66]">{app.allowanceFormatted}</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <a href={`https://revoke.cash/address/${address}`} target="_blank" rel="noopener noreferrer"
                                className="text-[#FFB020] opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold">
                                REVOKE ↗
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex items-center justify-center gap-2 py-6 text-[#00FF66] text-[11px] font-[family-name:var(--font-mono)]">
                      <ShieldCheck size={14} /> NO_ACTIVE_APPROVALS — WALLET_SECURE
                    </div>
                  )}
                </div>
              </div>

              {/* Trace / Graph Engine */}
              <div className="border border-white/5 bg-[#000000] flex-1 flex flex-col min-h-[300px] lg:min-h-0 relative overflow-hidden">
                <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#050505] z-10 relative">
                  <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#00E5FF] flex items-center gap-2 font-bold">
                    <Network size={12} /> TRACE_ENGINE
                  </h3>
                  {(() => {
                    const { nodes } = buildGraph(result);
                    return nodes.length >= 2 ? (
                      <button onClick={() => setShowGraph(!showGraph)}
                        className="text-[9px] font-[family-name:var(--font-mono)] uppercase tracking-widest text-[#00E5FF] border border-[#00E5FF]/30 px-2 py-1 hover:bg-[#00E5FF]/10 transition-colors">
                        {showGraph ? "HIDE_GRAPH" : "SHOW_GRAPH"}
                      </button>
                    ) : null;
                  })()}
                </div>

                {(() => {
                  const { nodes, edges } = buildGraph(result);
                  const hasTrace = nodes.length >= 2;

                  if (!hasTrace) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#4a5063] font-[family-name:var(--font-mono)] p-6">
                        <Activity size={28} className="opacity-30" />
                        <span className="text-[11px] uppercase tracking-widest">NO_TRACEABLE_OUTFLOWS</span>
                        <p className="text-[10px] text-center leading-relaxed max-w-xs text-[#333]">
                          No significant ETH outflows detected. The trace engine activates when large fund movements are flagged.
                        </p>
                      </div>
                    );
                  }

                  if (!showGraph) {
                    // Show a hop summary list instead
                    return (
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                        <p className="text-[10px] text-[#4a5063] font-[family-name:var(--font-mono)] uppercase tracking-widest mb-3">FUND_FLOW_SUMMARY — {nodes.length - 1} HOPS TRACED</p>
                        {edges.map((edge: any, i: number) => {
                          const toNode = nodes.find((n: any) => n.id === edge.to);
                          return (
                            <div key={i} className={`flex items-center gap-3 border p-3 font-[family-name:var(--font-mono)] text-[11px] ${edge.isRisky ? 'border-[#FF1E1E]/30 bg-[#FF1E1E]/5' : 'border-[#00FF66]/20 bg-[#00FF66]/5'}`}>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${edge.isRisky ? 'text-[#FF1E1E] border-[#FF1E1E]/40' : 'text-[#00FF66] border-[#00FF66]/40'}`}>HOP {i + 1}</span>
                              <span className="text-white font-bold">{edge.label}</span>
                              <span className="text-[#888888]">→</span>
                              <span className={edge.isRisky ? "text-[#FF1E1E]" : "text-[#00FF66]"}>{toNode?.label || edge.to.slice(0, 8) + "…"}</span>
                              <span className="ml-auto text-[9px] text-[#4a5063]">{toNode?.entityType || "UNKNOWN"}</span>
                            </div>
                          );
                        })}
                        <button onClick={() => setShowGraph(true)}
                          className="w-full mt-2 border border-[#00E5FF]/20 text-[#00E5FF] text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest py-2.5 hover:bg-[#00E5FF]/5 transition-colors">
                          VIEW_GRAPH_VISUALIZATION →
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="w-full flex-1">
                      <TransactionFlowChart centerAddress={result.address} nodes={nodes} edges={edges} />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── COLUMN 4: AI Chat ── */}
            <div className="col-span-1 border border-white/5 bg-[#050505] flex flex-col lg:overflow-hidden relative min-h-[500px] lg:min-h-0">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00E5FF]/30 to-transparent" />
              <div className="p-3 border-b border-white/5 shrink-0 bg-black/50 relative z-10">
                <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#00E5FF] flex items-center gap-2">
                  <Cpu size={12} /> SENTINEL_AI_CORE
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-[11px] text-[#666666] font-[family-name:var(--font-mono)] border border-white/5 bg-white/[0.02] p-4 leading-relaxed">
                    <span className="text-[#00E5FF]">&gt;</span> Agent armed with full forensic dataset.<br/>
                    Query anything about this wallet, its flags, approvals, or risk factors.
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className="text-[8px] text-[#4a5063] font-[family-name:var(--font-mono)] uppercase tracking-widest mb-1.5">
                      {msg.role === "user" ? "OPERATOR" : "SYS_CORE"}
                    </div>
                    <div className={`text-[11px] font-[family-name:var(--font-mono)] p-3.5 max-w-[92%] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-white"
                        : "bg-black/80 border border-white/10 text-[#CCCCCC]"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex flex-col items-start">
                    <div className="text-[8px] text-[#4a5063] font-[family-name:var(--font-mono)] uppercase tracking-widest mb-1.5">SYS_CORE</div>
                    <div className="text-[11px] font-[family-name:var(--font-mono)] p-3 bg-black border border-white/10 text-[#888888] flex items-center gap-2">
                      <Activity size={12} className="animate-spin text-[#00E5FF]" /> PROCESSING...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleChatSend} className="p-2 border-t border-white/5 bg-black shrink-0 relative z-10">
                <div className="flex bg-black border border-white/10 focus-within:border-[#00E5FF]/50 transition-colors">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask the AI about this wallet..."
                    disabled={chatLoading}
                    className="flex-1 bg-transparent border-none text-white text-[11px] font-[family-name:var(--font-mono)] p-3 focus:outline-none focus:ring-0 placeholder-[#4a5063]"
                  />
                  <button type="submit" disabled={chatLoading || !chatInput.trim()}
                    className="bg-white/5 hover:bg-[#00E5FF] hover:text-black text-[#888888] px-3 flex items-center justify-center transition-colors border-l border-white/10 disabled:opacity-50">
                    <Send size={12} />
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}