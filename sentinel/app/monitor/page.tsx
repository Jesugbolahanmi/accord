"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  Activity, Bell, Wallet, CheckCircle2,
  ShieldAlert, Send, Eye, Zap, Shield, TerminalSquare
} from "lucide-react";

const BOT_USERNAME = "sentinel_jesugbolahanmi_bot";

const MONITOR_FEATURES = [
  { icon: Eye,       label: "CONTINUOUS_SCAN",  desc: "Wallet re-analyzed on every new block cycle." },
  { icon: Bell,      label: "INSTANT_ALERTS",   desc: "Telegram notification the moment a threat is detected." },
  { icon: Activity,  label: "APPROVAL_TRACKING",desc: "Any new unlimited approval triggers an immediate flag." },
  { icon: Zap,       label: "AUTONOMOUS",       desc: "Set parameters once. Sentinel executes continuously." },
];

function MonitorForm() {
  const [address, setAddress]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(false);
  const [error, setError]               = useState("");
  const [addedAddress, setAddedAddress] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const prefill = searchParams.get("address");
    if (prefill) setAddress(prefill);
  }, [searchParams]);

  async function handleWatch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/monitor-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "SYSTEM_FAILURE");
      } else {
        setSuccess(true);
        setAddedAddress(address);
        setAddress("");
      }
    } catch {
      setError("NETWORK_DISCONNECT");
    } finally {
      setLoading(false);
    }
  }

  const telegramLink = `https://t.me/${BOT_USERNAME}?start=${addedAddress}`;

  return (
    <main className="flex-1 lg:h-full flex flex-col bg-black text-white lg:overflow-hidden relative overflow-y-auto min-h-screen lg:min-h-0">
      {/* Top Header */}
      <header className="h-14 shrink-0 border-b border-white/5 bg-[#050505] flex items-center px-4 justify-between z-20 relative">
        <div className="flex items-center gap-4">
          <TerminalSquare size={16} className="text-[#00FF66]" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase text-[#888888] hidden sm:inline-block">
            MOD: ACTIVE_MONITOR
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#00FF66] font-[family-name:var(--font-mono)] tracking-widest mr-4 flex items-center gap-2">
            <Activity size={12} className="animate-spin" /> SYSTEM_ONLINE
          </span>
          <div className="w-1.5 h-1.5 bg-[#00FF66] rounded-full animate-pulse" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-1 lg:overflow-hidden relative grid grid-cols-1 lg:grid-cols-3 gap-1">
        
        {/* Column 1: Configuration */}
        <div className="col-span-1 lg:col-span-1 border border-white/5 bg-[#050505] flex flex-col relative overflow-hidden min-h-[350px] lg:min-h-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#00FF66]/5 blur-[50px] pointer-events-none" />
          
          <div className="p-4 border-b border-white/5 shrink-0">
            <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#00FF66] flex items-center gap-2">
              <Shield size={12} /> ADD_TARGET_TO_WATCHLIST
            </h3>
          </div>

          <div className="flex-1 p-6 flex flex-col relative z-10">
            <form onSubmit={handleWatch} className="space-y-4 mb-8">
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[9px] text-[#888888] block mb-2 uppercase tracking-widest">
                  TARGET_ADDRESS_OR_ENS
                </label>
                <div className="flex bg-black border border-white/10 focus-within:border-[#00FF66]/50 transition-colors">
                  <div className="pl-3 flex items-center justify-center">
                    <Wallet size={14} className="text-[#4a5063]" />
                  </div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0x..."
                    className="flex-1 bg-transparent border-none text-white font-[family-name:var(--font-mono)] text-xs px-3 py-3 focus:outline-none focus:ring-0 placeholder-[#4a5063]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !address}
                className="w-full bg-white/5 hover:bg-[#00FF66] hover:text-black text-[#888888] border border-white/10 px-6 py-3 font-bold font-[family-name:var(--font-mono)] text-[10px] tracking-widest transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Activity size={14} className="animate-spin" /> INITIALIZING...</>
                ) : (
                  <><Eye size={14} /> ENGAGE_MONITOR</>
                )}
              </button>
            </form>

            {error && (
              <div className="bg-[#FF1E1E]/10 border border-[#FF1E1E]/30 p-4 text-[#FF1E1E] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest flex items-center gap-3">
                <ShieldAlert size={14} /> {error}
              </div>
            )}

            {success && (
              <div className="bg-[#00FF66]/10 border border-[#00FF66]/30 p-5 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-3 mb-4 border-b border-[#00FF66]/10 pb-4">
                  <CheckCircle2 size={16} className="text-[#00FF66] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#00FF66] font-bold font-[family-name:var(--font-mono)] text-[10px] tracking-widest">TARGET_ACQUIRED</p>
                    <p className="text-[#4a5063] text-[9px] font-[family-name:var(--font-mono)] mt-1 truncate">{addedAddress}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[#AAAAAA] text-[10px] font-[family-name:var(--font-mono)] leading-relaxed uppercase">
                    &gt; LINK TELEGRAM TO RECEIVE CRITICAL ALERTS FOR THIS TARGET.
                  </p>
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#00FF66] hover:bg-[#00cc52] text-black px-4 py-2 font-bold font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase transition-colors"
                  >
                    <Send size={12} /> CONNECT_BOT
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2 & 3: Logs and System Intel */}
        <div className="col-span-1 lg:col-span-2 border border-white/5 bg-[#050505] flex flex-col relative overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none" style={{ backgroundSize: '30px' }} />
          
          <div className="p-4 border-b border-white/5 shrink-0 bg-black/50 backdrop-blur-sm relative z-10 flex justify-between items-center">
            <h3 className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
              <Activity size={12} /> SYSTEM_PARAMETERS
            </h3>
            <span className="text-[8px] text-[#4a5063] font-[family-name:var(--font-mono)] uppercase tracking-widest">
              STATUS: PASSIVE_SURVEILLANCE_ACTIVE
            </span>
          </div>

          <div className="flex-1 p-6 relative z-10 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {MONITOR_FEATURES.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="bg-black/40 border border-white/5 p-5 hover:border-white/20 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={14} className="text-[#00FF66]" />
                    <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[#E6E8EC] uppercase tracking-widest">{label}</span>
                  </div>
                  <p className="text-[#4a5063] text-[9px] font-[family-name:var(--font-mono)] leading-relaxed uppercase">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto border border-white/5 bg-black/40 p-4">
               <div className="font-[family-name:var(--font-mono)] text-[9px] text-[#4a5063] uppercase tracking-widest leading-relaxed flex items-start gap-2">
                 <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                 <span>
                   DISCLAIMER: MONITORING IS PASSIVE. SENTINEL EXECUTES READ-ONLY ONCHAIN QUERIES.<br/>
                   NO PRIVATE KEYS. NO CUSTODY. NO EXPOSURE.
                 </span>
               </div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}

export default function Monitor() {
  return (
    <Suspense fallback={null}>
      <MonitorForm />
    </Suspense>
  );
}
