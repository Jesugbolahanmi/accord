"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, RefreshCw, Search } from "lucide-react";

const STATUS_FILTERS = [
  { id: "ALL", label: "All Agreements" },
  { id: "AwaitingAcceptance", label: "Awaiting Signature" },
  { id: "AwaitingDeposit", label: "Awaiting Deposit" },
  { id: "Funded", label: "Funded" },
  { id: "ReadyForRelease", label: "Ready for Release" },
  { id: "Completed", label: "Completed" },
  { id: "Disputed", label: "Disputed" },
];

export default function TradesDirectoryPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (data.success && Array.isArray(data.trades)) {
        setTrades(data.trades);
      }
    } catch (err) {
      console.error("Failed to load trades:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const filteredTrades = trades.filter((t) => {
    if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.reference?.toLowerCase().includes(q) ||
      t.buyer?.toLowerCase().includes(q) ||
      t.seller?.toLowerCase().includes(q) ||
      t.agreedTerms?.toLowerCase().includes(q) ||
      t.network?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/[0.08]">
        <div className="space-y-2">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#6E6C65]">
            Settlement Register
          </div>
          <h1 className="font-editorial text-[34px] sm:text-[42px] leading-[1.08] tracking-[-0.02em] text-[#F4F2ED]">
            Peer-to-Peer Trade Agreements
          </h1>
          <p className="text-[14px] text-[#A6A39B] max-w-[62ch]">
            Inspect bilateral agreements, verify on-chain transaction receipts through Tatum RPC,
            and review chronological settlement records anchored to Walrus Memory.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchTrades}
            className="px-3.5 py-2 rounded-[3px] bg-[#0E1014] hover:bg-[#13161C] border border-white/[0.1] text-[12px] font-mono-tabular text-[#A6A39B] hover:text-[#F4F2ED] inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#C5A46D]" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/trades/new"
            className="px-4 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Draft Agreement</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((tab) => {
            const active = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-[3px] text-[12px] font-mono-tabular transition-colors border ${
                  active
                    ? "bg-[#13161C] border-[#C5A46D]/50 text-[#F4F2ED]"
                    : "bg-transparent border-white/[0.07] text-[#6E6C65] hover:text-[#A6A39B]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="w-3.5 h-3.5 text-[#6E6C65] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by reference, address, or clause…"
            className="w-full pl-9 pr-3.5 py-1.5 rounded-[3px] bg-[#0E1014] border border-white/[0.1] text-[12px] text-[#F4F2ED] placeholder-[#6E6C65] focus:border-[#C5A46D]"
          />
        </div>
      </div>

      {/* Register Table */}
      {loading ? (
        <div className="border-t border-white/[0.08] divide-y divide-white/[0.06]">
          {[1, 2].map((i) => (
            <div key={i} className="py-6 h-24 animate-pulse bg-white/[0.01]" />
          ))}
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="surface-panel rounded-[4px] p-12 text-center space-y-4">
          <div className="text-[14px] font-medium text-[#F4F2ED]">
            No trade agreements match the active filter
          </div>
          <p className="text-[13px] text-[#A6A39B] max-w-md mx-auto">
            Clear your search filter or draft a new peer-to-peer agreement with versioned terms and
            Tatum RPC verification conditions.
          </p>
          <div className="pt-1">
            <Link
              href="/trades/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[3px] bg-[#C5A46D] text-[#090A0C] text-[12px] font-medium"
            >
              <span>Draft New Agreement</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="border-t border-white/[0.1]">
          {/* Column Headers (Desktop) */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4 py-3 border-b border-white/[0.07] text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
            <div className="col-span-2">Reference</div>
            <div className="col-span-2">Principal</div>
            <div className="col-span-3">Counterparties</div>
            <div className="col-span-3">Agreed Terms &amp; Verification</div>
            <div className="col-span-2 text-right">Status / Room</div>
          </div>

          <div className="divide-y divide-white/[0.07] border-b border-white/[0.07]">
            {filteredTrades.map((trade) => {
              const completedConditions = (trade.conditions || []).filter(
                (c: any) => c.completed
              ).length;
              const totalConditions = (trade.conditions || []).length;
              const latestVersion = (trade.termsVersions || []).length || 1;

              return (
                <Link
                  key={trade.id}
                  href={`/trade/${trade.reference}`}
                  className="group block py-5 lg:py-6 hover:bg-white/[0.015] transition-colors px-2 -mx-2"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start lg:items-center">
                    {/* Reference & Version */}
                    <div className="lg:col-span-2 space-y-1">
                      <div className="font-mono-tabular text-[13px] font-medium text-[#F4F2ED] group-hover:text-[#D6B882] transition-colors">
                        {trade.reference}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-[#6E6C65]">
                        Terms v{latestVersion} · SHA {trade.termsHash?.slice(0, 8)}…
                      </div>
                    </div>

                    {/* Principal & Network */}
                    <div className="lg:col-span-2 space-y-0.5">
                      <div className="font-mono-tabular text-[16px] font-medium text-[#F4F2ED]">
                        {trade.amount}{" "}
                        <span className="text-[12px] text-[#A6A39B]">{trade.asset}</span>
                      </div>
                      <div className="font-mono-tabular text-[11px] text-[#6E6C65]">
                        {trade.network}
                      </div>
                    </div>

                    {/* Counterparties */}
                    <div className="lg:col-span-3 font-mono-tabular text-[11px] space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[#6E6C65] w-12">BUYER</span>
                        <span className="text-[#F4F2ED]">
                          {trade.buyer.slice(0, 8)}…{trade.buyer.slice(-4)}
                        </span>
                        <span
                          className={
                            trade.buyerAccepted ? "text-[#5CE0A8]" : "text-[#C88A32]"
                          }
                        >
                          {trade.buyerAccepted ? "✓" : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#6E6C65] w-12">SELLER</span>
                        <span className="text-[#F4F2ED]">
                          {trade.seller.slice(0, 8)}…{trade.seller.slice(-4)}
                        </span>
                        <span
                          className={
                            trade.sellerAccepted ? "text-[#5CE0A8]" : "text-[#C88A32]"
                          }
                        >
                          {trade.sellerAccepted ? "✓" : "Pending"}
                        </span>
                      </div>
                    </div>

                    {/* Terms & Conditions Summary */}
                    <div className="lg:col-span-3 space-y-1.5">
                      <p className="text-[13px] text-[#A6A39B] line-clamp-2 leading-snug">
                        {trade.agreedTerms}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 font-mono-tabular text-[11px] text-[#6E6C65]">
                        <span>
                          Conditions: {completedConditions}/{totalConditions}
                        </span>
                        {trade.verification?.verified && (
                          <span className="text-[#5CE0A8]">
                            Tatum Block #{trade.verification.blockNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status & CTA */}
                    <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-end justify-between gap-2">
                      <span
                        className={`status-pill ${
                          trade.status === "Completed" || trade.status === "Funded"
                            ? "status-pill-verified"
                            : trade.status === "Disputed"
                            ? "status-pill-danger"
                            : "status-pill-brass"
                        }`}
                      >
                        {trade.status}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#A6A39B] group-hover:text-[#F4F2ED]">
                        <span>Enter Room</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
