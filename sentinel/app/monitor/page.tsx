"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  ArrowLeft, Activity, Bell, Wallet, CheckCircle2,
  ShieldAlert, Send, Eye, Zap
} from "lucide-react";

const BOT_USERNAME = "sentinel_jesugbolahanmi_bot";

const MONITOR_FEATURES = [
  { icon: Eye,       label: "Continuous scan",  desc: "Wallet is re-analysed on every new block cycle" },
  { icon: Bell,      label: "Instant alerts",   desc: "Telegram notification the moment a threat is detected" },
  { icon: Activity,  label: "Approval tracking",desc: "Any new unlimited approval triggers an immediate flag" },
  { icon: Zap,       label: "Zero effort",       desc: "Set it once — Sentinel does the rest" },
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

  async function handleWatch() {
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
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
        setAddedAddress(address);
        setAddress("");
      }
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  const telegramLink = `https://t.me/${BOT_USERNAME}?start=${addedAddress}`;

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 sm:py-10 relative overflow-hidden bg-[#050505]">
      {/* Background layers */}
      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none" />
      {/* Green/teal theme glow — monitoring = alive */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#34D399] opacity-[0.06] blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-[#38BDF8] opacity-[0.04] blur-[100px] rounded-full pointer-events-none" />

      {/* Radar rings */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-start justify-center pointer-events-none opacity-20 pt-10">
        <div className="w-[500px] h-[500px] rounded-full border border-[#34D399]/30 animate-radar" />
        <div className="absolute w-[500px] h-[500px] rounded-full border border-[#34D399]/20 animate-radar" style={{ animationDelay: "1.2s" }} />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">

        {/* Back nav */}
        <Link
          href="/scan"
          className="group flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs text-[#7C8394] hover:text-[#34D399] transition-colors mb-8 w-fit"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          RETURN TO DASHBOARD
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-2 mb-10">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="absolute w-full h-full rounded-full bg-[#34D399] opacity-75 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-[#34D399]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              WALLET MONITOR
            </h1>
          </div>
          <p className="font-[family-name:var(--font-mono)] text-sm text-[#7C8394] ml-6">
            // continuous onchain surveillance — you sleep, Sentinel watches
          </p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {MONITOR_FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/10 hover:border-[#34D399]/20 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} className="text-[#34D399] group-hover:scale-110 transition-transform" />
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold text-[#E6E8EC] uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-[#7C8394] text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#34D399]/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-5">
            {/* Address input */}
            <div>
              <label className="font-[family-name:var(--font-mono)] text-xs text-[#7C8394] block mb-2 uppercase tracking-widest">
                WALLET_ADDRESS
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Wallet size={16} className="text-[#7C8394] group-focus-within:text-[#34D399] transition-colors" />
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && address && handleWatch()}
                  placeholder="0x..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-4 text-[#E6E8EC] placeholder-[#4a5063] font-[family-name:var(--font-mono)] text-sm focus:outline-none focus:border-[#34D399] focus:ring-1 focus:ring-[#34D399] transition-all"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              onClick={handleWatch}
              disabled={loading || !address}
              className="w-full bg-gradient-to-r from-[#34D399] to-[#10b981] hover:from-[#10b981] hover:to-[#059669] disabled:from-[#242938] disabled:to-[#242938] disabled:text-[#4a5063] disabled:cursor-not-allowed text-black rounded-xl px-6 py-4 font-bold font-[family-name:var(--font-mono)] text-sm transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_35px_rgba(52,211,153,0.5)] disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Activity size={16} className="animate-spin" /> ACTIVATING MONITOR</>
              ) : (
                <><Eye size={16} /> WATCH THIS WALLET</>
              )}
            </button>

            {/* Success state */}
            {success && (
              <div className="bg-[#34D399]/10 border border-[#34D399]/30 rounded-xl p-5 space-y-4 animate-in">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-[#34D399] shrink-0" />
                  <div>
                    <p className="text-[#34D399] font-bold font-[family-name:var(--font-mono)] text-sm">WALLET ADDED TO WATCHLIST</p>
                    <p className="text-[#7C8394] text-xs font-[family-name:var(--font-mono)] mt-0.5 truncate">{addedAddress}</p>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <p className="text-[#B4B9C4] text-sm mb-3 leading-relaxed">
                    One more step — connect Telegram so Sentinel can reach you the moment a threat is detected:
                  </p>
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#38BDF8] hover:bg-[#5ecbfa] text-black rounded-xl px-5 py-3 font-bold font-[family-name:var(--font-mono)] text-sm transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)]"
                  >
                    <Send size={14} />
                    CONNECT TELEGRAM
                  </a>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 rounded-xl p-4 text-[#FF3B3B] font-[family-name:var(--font-mono)] text-sm flex items-center gap-3">
                <ShieldAlert size={16} />
                <span>ERROR: {error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[#4a5063] font-[family-name:var(--font-mono)] text-[11px] mt-6 leading-relaxed">
          Monitoring is passive — Sentinel reads onchain data only.<br />No private keys, no custody, no risk.
        </p>

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
