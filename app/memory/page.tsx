"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Search,
  Plus,
  ArrowUpRight,
  Check,
  AlertTriangle,
  Clock,
  FileText,
  Filter,
  X,
} from "lucide-react";

const MEMORY_CATEGORIES = [
  "All",
  "Agreements",
  "Transactions",
  "Fulfilment",
  "Disputes",
  "Settlement",
  "Trade History",
] as const;

const RECORD_TYPES = [
  "TRADE_CREATED",
  "TRADE_TERMS",
  "TERMS_AMENDMENT",
  "TRADE_ACCEPTANCE",
  "PAYMENT_SUBMITTED",
  "ONCHAIN_VERIFICATION",
  "CONDITION_UPDATE",
  "DISPUTE_EVIDENCE",
  "DISPUTE_RESOLUTION",
  "SETTLEMENT_COMPLETED",
  "SETTLEMENT_REFUNDED",
  "SETTLEMENT_LESSON",
  "USER_PREFERENCE",
] as const;

export default function AccordMemoryBoxPage() {
  const [memories, setMemories] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [overview, setOverview] = useState<any | null>(null);
  const [relayerHealth, setRelayerHealth] = useState<any | null>(null);
  const [configStatus, setConfigStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Deterministic Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedTradeRef, setSelectedTradeRef] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("");
  const [participantFilter, setParticipantFilter] = useState<string>("");
  const [persistenceFilter, setPersistenceFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Active View Mode: "archive" (Searchable Memory Records) vs "timeline" (Complete Trade Timeline)
  const [activeViewMode, setActiveViewMode] = useState<"archive" | "timeline">("archive");
  const [timelineTradeRef, setTimelineTradeRef] = useState<string>("ACC-2026-8812");

  // Selected Individual Memory Record for Detailed Inspection
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  // Manual Memory Creation Form
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [newTradeRef, setNewTradeRef] = useState("ACC-2026-8812");
  const [newMemoryTitle, setNewMemoryTitle] = useState("");
  const [newMemoryType, setNewMemoryType] = useState("SETTLEMENT_LESSON");
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [writingMemory, setWritingMemory] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const loadMemoryBoxData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory/seed");
      const data = await res.json();
      if (data.success) {
        const memList = data.memories || [];
        setMemories(memList);
        setTrades(data.trades || []);
        setOverview(data.overview || null);
        setRelayerHealth(data.relayerHealth || null);
        setConfigStatus(data.configStatus || null);

        const urlRecordId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("recordId")
            : null;
        if (urlRecordId) {
          setSelectedMemoryId(urlRecordId);
        } else if (!selectedMemoryId && memList.length > 0) {
          setSelectedMemoryId(memList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load Accord Memory Box:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qTrade = params.get("tradeRef");
      const qRecord = params.get("recordId");
      const qView = params.get("view");
      if (qTrade) {
        setSelectedTradeRef(qTrade);
        setTimelineTradeRef(qTrade);
      }
      if (qRecord) {
        setSelectedMemoryId(qRecord);
      }
      if (qView === "timeline") {
        setActiveViewMode("timeline");
      }
    }
    loadMemoryBoxData();
  }, []);

  const handleRetryAllPending = async () => {
    setSyncing(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/memory/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceSync: true }),
      });
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories || []);
        setOverview(data.overview || null);
        setRelayerHealth(data.relayerHealth || null);
        setConfigStatus(data.configStatus || null);
        setStatusBanner(data.message);
      }
    } catch (err: any) {
      setStatusBanner(`Retry failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRetrySingleMemory = async (memoryId: string) => {
    setRetryingId(memoryId);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/memory/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId }),
      });
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories || []);
        setOverview(data.overview || null);
        setRelayerHealth(data.relayerHealth || null);
        setStatusBanner(data.message);
      }
    } catch (err: any) {
      setStatusBanner(`Single record retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleWriteNewMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;
    setWritingMemory(true);
    setStatusBanner(null);

    try {
      const res = await fetch("/api/memory/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeRef: newTradeRef.trim() || "ACC-GLOBAL-PREFS",
          title: newMemoryTitle.trim() || undefined,
          type: newMemoryType,
          content: newMemoryContent.trim(),
          metadata: {
            source: "accord_memory_box",
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.memory) {
        setMemories((prev) => [data.memory, ...prev]);
        if (data.overview) setOverview(data.overview);
        setSelectedMemoryId(data.memory.id);
        setNewMemoryContent("");
        setNewMemoryTitle("");
        setShowWriteModal(false);
        setStatusBanner(
          data.memory.verifiedOnWalrus
            ? `Confirmed on Walrus Mainnet (Blob ID: ${data.memory.blobId}).`
            : `Preserved in Accord Memory Box (${data.memory.id}, Status: ${data.memory.persistenceStatus}).`
        );
      }
    } catch (err: any) {
      setStatusBanner(`Failed to preserve memory: ${err.message}`);
    } finally {
      setWritingMemory(false);
    }
  };

  // Distinct trade references available for filtering
  const availableTradeRefs = useMemo(() => {
    const refs = new Set<string>();
    for (const t of trades) {
      if (t.reference) refs.add(t.reference);
    }
    for (const m of memories) {
      if (m.tradeRef) refs.add(m.tradeRef);
    }
    return Array.from(refs);
  }, [trades, memories]);

  // Deterministic client+server matching across all filters (zero AI dependency)
  const filteredMemories = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const pLower = participantFilter.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    return memories.filter((mem) => {
      if (selectedCategory !== "All" && mem.category !== selectedCategory) {
        return false;
      }
      if (
        selectedTradeRef !== "all" &&
        mem.tradeRef?.toLowerCase() !== selectedTradeRef.toLowerCase()
      ) {
        return false;
      }
      if (selectedType && mem.type !== selectedType) {
        return false;
      }
      if (pLower) {
        const actorMatch = mem.actor?.toLowerCase().includes(pLower);
        const listMatch = (mem.metadata?.participants || []).some((p: string) =>
          p.toLowerCase().includes(pLower)
        );
        const userMatch = mem.metadata?.userAddress?.toLowerCase().includes(pLower);
        if (!actorMatch && !listMatch && !userMatch) return false;
      }
      if (persistenceFilter !== "all") {
        if (persistenceFilter === "confirmed_mainnet" && !mem.verifiedOnWalrus) return false;
        if (
          persistenceFilter === "pending" &&
          (mem.verifiedOnWalrus || mem.persistenceStatus === "write_failed")
        ) {
          return false;
        }
        if (persistenceFilter === "failed" && mem.persistenceStatus !== "write_failed") {
          return false;
        }
      }
      const memTs = mem.metadata?.timestamp || new Date(mem.storedAt).getTime();
      if (fromMs && !Number.isNaN(fromMs) && memTs < fromMs) return false;
      if (toMs && !Number.isNaN(toMs) && memTs > toMs) return false;

      if (qLower) {
        const haystack = [
          mem.id,
          mem.title,
          mem.tradeRef,
          mem.tradeId,
          mem.category,
          mem.type,
          mem.actor,
          mem.content,
          mem.contentHash,
          mem.blobId,
          mem.jobId,
          mem.relatedTxHash,
          mem.relatedEvidenceHash,
          mem.relatedTermsHash,
          ...(mem.metadata?.participants || []),
          JSON.stringify(mem.structuredPayload || {}),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const tokens = qLower.split(/\s+/).filter((t) => t.length > 1);
        const exact = haystack.includes(qLower);
        const allTokens = tokens.length > 0 && tokens.every((tok) => haystack.includes(tok));
        if (!exact && !allTokens) return false;
      }

      return true;
    });
  }, [
    memories,
    searchQuery,
    selectedCategory,
    selectedTradeRef,
    selectedType,
    participantFilter,
    persistenceFilter,
    dateFrom,
    dateTo,
  ]);

  const selectedMemory = useMemo(() => {
    if (!selectedMemoryId) return filteredMemories[0] || null;
    return (
      memories.find((m) => m.id === selectedMemoryId) || filteredMemories[0] || null
    );
  }, [memories, filteredMemories, selectedMemoryId]);

  const relatedMemoriesForSelected = useMemo(() => {
    if (!selectedMemory) return [];
    return memories
      .filter(
        (m) => m.tradeRef === selectedMemory.tradeRef && m.id !== selectedMemory.id
      )
      .sort((a, b) => (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0));
  }, [memories, selectedMemory]);

  const activeTimelineTrade = useMemo(() => {
    return (
      trades.find(
        (t) => t.reference?.toLowerCase() === timelineTradeRef.toLowerCase()
      ) || trades[0] || null
    );
  }, [trades, timelineTradeRef]);

  const timelineMemories = useMemo(() => {
    return memories
      .filter((m) => m.tradeRef?.toLowerCase() === timelineTradeRef.toLowerCase())
      .sort((a, b) => (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0));
  }, [memories, timelineTradeRef]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedTradeRef("all");
    setSelectedType("");
    setParticipantFilter("");
    setPersistenceFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 sm:py-12 space-y-8">
      {/* Header & Primary Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-7 border-b border-white/[0.08]">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#A6A39B]">
            <span className="text-[#C5A46D]">ACCORD MEMORY BOX</span>
            <span className="text-white/20">/</span>
            <span>Persistent Financial Records Archive</span>
          </div>
          <h1 className="font-editorial text-[34px] sm:text-[42px] leading-[1.06] tracking-[-0.02em] text-[#F4F2ED]">
            Every agreement, verification, and outcome—preserved.
          </h1>
          <p className="text-[14px] text-[#A6A39B] max-w-[66ch] leading-relaxed">
            Deterministic, searchable archive of versioned agreements, Tatum RPC transaction
            proofs, off-chain fulfilment attestations, dispute evidence, and final settlements
            backed by Walrus Memory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Memory Box View Mode"
            className="inline-flex items-center bg-[#0E1014] border border-white/[0.1] rounded-[3px] p-0.5 font-mono-tabular text-[11px]"
          >
            <button
              type="button"
              onClick={() => setActiveViewMode("archive")}
              className={`px-3 py-1.5 rounded-[2px] transition-colors ${
                activeViewMode === "archive"
                  ? "bg-[#C5A46D] text-[#090A0C] font-medium"
                  : "text-[#A6A39B] hover:text-[#F4F2ED]"
              }`}
            >
              Records Archive
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode("timeline")}
              className={`px-3 py-1.5 rounded-[2px] transition-colors ${
                activeViewMode === "timeline"
                  ? "bg-[#C5A46D] text-[#090A0C] font-medium"
                  : "text-[#A6A39B] hover:text-[#F4F2ED]"
              }`}
            >
              Complete Trade Timeline
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowWriteModal((v) => !v)}
            className="px-3.5 py-2 rounded-[3px] bg-[#0E1014] hover:bg-[#13161C] border border-white/[0.14] font-mono-tabular text-[12px] text-[#F4F2ED] inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#C5A46D]" />
            <span>Record Memory</span>
          </button>

          <button
            type="button"
            onClick={handleRetryAllPending}
            disabled={syncing}
            className="px-4 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>
              {syncing ? "Syncing Pending Records…" : "Retry / Verify Mainnet Persistence"}
            </span>
          </button>
        </div>
      </div>

      {/* 1A. MEMORY BOX OVERVIEW STRIP (All figures from actual application data) */}
      <div className="surface-panel rounded-[4px] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07]">
        <div className="p-5 space-y-1">
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
            Total Memory Records
          </div>
          <div className="font-mono-tabular text-[26px] font-medium text-[#F4F2ED]">
            {overview?.totalRecords ?? memories.length}
          </div>
          <div className="text-[11px] text-[#A6A39B]">
            Across 6 structured classifications
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
            Confirmed Walrus Mainnet
          </div>
          <div
            className={`font-mono-tabular text-[26px] font-medium ${
              (overview?.confirmedMainnetRecords || 0) > 0
                ? "text-[#5CE0A8]"
                : "text-[#A6A39B]"
            }`}
          >
            {overview?.confirmedMainnetRecords ?? 0}
          </div>
          <div className="text-[11px] text-[#6E6C65]">
            Write + Blob ID + Retrieval verified
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
            Pending / Unconfirmed
          </div>
          <div className="font-mono-tabular text-[26px] font-medium text-[#C5A46D]">
            {overview?.pendingOrUnconfirmedRecords ?? memories.length}
          </div>
          <div className="text-[11px] text-[#6E6C65]">
            Preserved locally · Ready for retry
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
            Trades Preserved
          </div>
          <div className="font-mono-tabular text-[26px] font-medium text-[#F4F2ED]">
            {overview?.tradesWithPreservedHistories ?? 3}
          </div>
          <div className="text-[11px] text-[#A6A39B]">
            Auditable agreement timelines
          </div>
        </div>

        <div className="p-5 space-y-1 col-span-2 sm:col-span-1">
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
            Recent Activity (24h)
          </div>
          <div className="font-mono-tabular text-[26px] font-medium text-[#F4F2ED]">
            {overview?.recentActivityCount24h ?? memories.length}
          </div>
          <div className="text-[11px] text-[#5CE0A8]">
            Auto-captured from trade lifecycle
          </div>
        </div>
      </div>

      {/* 2. ACCURATE WALRUS MAINNET INTEGRATION STATUS MATRIX */}
      <div className="surface-panel rounded-[4px] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <span className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
              Walrus Memory Mainnet Telemetry
            </span>
            <span
              className={`status-pill ${
                relayerHealth?.mainnetWritesEnabled
                  ? "status-pill-verified"
                  : "status-pill-brass"
              }`}
            >
              {relayerHealth?.overallLabel || "Checking Walrus Status…"}
            </span>
          </div>
          <div className="font-mono-tabular text-[11px] text-[#6E6C65]">
            Strict Persistence Rule: <code className="text-[#D8D5CE]">verifiedOnWalrus = true</code>{" "}
            requires Mainnet Write + Blob ID + Confirmed Retrieval
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono-tabular text-[11px]">
          <div className="p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.07] space-y-1">
            <div className="flex items-center justify-between text-[#6E6C65]">
              <span>1. RELAYER ENDPOINT</span>
              <span
                className={
                  relayerHealth?.relayerReachable ? "text-[#5CE0A8]" : "text-[#C94A4A]"
                }
              >
                {relayerHealth?.relayerReachable ? "REACHABLE" : "UNREACHABLE"}
              </span>
            </div>
            <div className="text-[#F4F2ED] truncate">
              {relayerHealth?.url || "https://relayer.memory.walrus.xyz"}
            </div>
            <div className="text-[#6E6C65]">
              Health check only — does not imply blob persistence
            </div>
          </div>

          <div className="p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.07] space-y-1">
            <div className="flex items-center justify-between text-[#6E6C65]">
              <span>2. CREDENTIALS (.env.local)</span>
              <span
                className={
                  relayerHealth?.credentialsConfigured ? "text-[#5CE0A8]" : "text-[#C88A32]"
                }
              >
                {relayerHealth?.credentialsConfigured ? "CONFIGURED" : "MISSING (DEV MOCK)"}
              </span>
            </div>
            <div className="text-[#F4F2ED] truncate">
              {relayerHealth?.credentialsConfigured
                ? `Account: ${configStatus?.accountIdPreview}`
                : `Missing: ${(configStatus?.missingEnvVars || ["MEMWAL_PRIVATE_KEY", "MEMWAL_ACCOUNT_ID"]).join(", ")}`}
            </div>
            <div className="text-[#6E6C65]">
              {relayerHealth?.credentialsConfigured
                ? "Server-side Ed25519 signer ready"
                : "Development-only local indexing active"}
            </div>
          </div>

          <div className="p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.07] space-y-1">
            <div className="flex items-center justify-between text-[#6E6C65]">
              <span>3. MAINNET WRITES</span>
              <span
                className={
                  relayerHealth?.mainnetWritesEnabled ? "text-[#5CE0A8]" : "text-[#C88A32]"
                }
              >
                {relayerHealth?.mainnetWritesEnabled ? "ENABLED" : "PENDING CREDENTIALS"}
              </span>
            </div>
            <div className="text-[#F4F2ED] truncate">
              Submitted: {relayerHealth?.writesSubmittedCount ?? 0} · Confirmed:{" "}
              {relayerHealth?.writesConfirmedCount ?? 0}
            </div>
            <div className="text-[#6E6C65] truncate">
              Aggregator:{" "}
              {relayerHealth?.aggregatorUrl ||
                "https://aggregator.memory.walrus-mainnet.walrus.space"}
            </div>
          </div>

          <div className="p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.07] space-y-1">
            <div className="flex items-center justify-between text-[#6E6C65]">
              <span>4. RETRIEVAL &amp; RETRY QUEUE</span>
              <span className="text-[#C5A46D]">
                {relayerHealth?.writesFailedOrPendingCount ?? memories.length} Pending
              </span>
            </div>
            <div className="text-[#F4F2ED]">
              Retrieved &amp; Verified: {relayerHealth?.memoriesRetrievedVerifiedCount ?? 0}
            </div>
            <div className="text-[#6E6C65]">
              In-place retry prevents duplicate records
            </div>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-[3px] bg-[#13161C] border border-[#C5A46D]/40 text-[#F4F2ED] font-mono-tabular text-[12px] flex items-center justify-between gap-4">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[#6E6C65] hover:text-[#F4F2ED] shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Optional Manual Record Creation Panel */}
      {showWriteModal && (
        <form
          onSubmit={handleWriteNewMemory}
          className="surface-panel rounded-[4px] p-5 space-y-4 border border-[#C5A46D]/40"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
              Preserve New Structured Memory Record
            </span>
            <button
              type="button"
              onClick={() => setShowWriteModal(false)}
              className="text-[#6E6C65] hover:text-[#F4F2ED]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono-tabular text-[10px] uppercase text-[#6E6C65] mb-1">
                Trade Reference
              </label>
              <input
                type="text"
                value={newTradeRef}
                onChange={(e) => setNewTradeRef(e.target.value)}
                placeholder="ACC-2026-8812"
                className="w-full px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[10px] uppercase text-[#6E6C65] mb-1">
                Record Type
              </label>
              <select
                value={newMemoryType}
                onChange={(e) => setNewMemoryType(e.target.value)}
                className="w-full px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono-tabular text-[10px] uppercase text-[#6E6C65] mb-1">
                Record Title (Optional)
              </label>
              <input
                type="text"
                value={newMemoryTitle}
                onChange={(e) => setNewMemoryTitle(e.target.value)}
                placeholder="e.g., Counterparty Delivery Confirmation"
                className="w-full px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              placeholder="Enter structured trade record, counterparty preference, or evidence note…"
              className="flex-1 px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
            />
            <button
              type="submit"
              disabled={writingMemory || !newMemoryContent.trim()}
              className="px-5 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] disabled:opacity-40 text-[#090A0C] font-mono-tabular text-[12px] font-medium"
            >
              {writingMemory ? "Preserving…" : "Preserve Record"}
            </button>
          </div>
        </form>
      )}

      {/* VIEW MODE 1: SEARCHABLE ARCHIVE & INDIVIDUAL RECORD INSPECTOR */}
      {activeViewMode === "archive" ? (
        <div className="space-y-6">
          {/* 1C. SIX MEANINGFUL MEMORY CATEGORIES TABS */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.08] pb-3">
            {MEMORY_CATEGORIES.map((cat) => {
              const count =
                cat === "All"
                  ? overview?.totalRecords ?? memories.length
                  : overview?.categoryCounts?.[cat] ??
                    memories.filter((m) => m.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-[3px] font-mono-tabular text-[12px] inline-flex items-center gap-2 transition-colors ${
                    isSelected
                      ? "bg-[#C5A46D] text-[#090A0C] font-medium"
                      : "bg-[#0E1014] hover:bg-[#13161C] text-[#A6A39B] hover:text-[#F4F2ED] border border-white/[0.08]"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-[2px] ${
                      isSelected ? "bg-[#090A0C]/20 text-[#090A0C]" : "bg-white/[0.06] text-[#A6A39B]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 1B. DETERMINISTIC SEARCH & MULTI-DIMENSION FILTERS */}
          <div className="surface-panel rounded-[4px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
                <Filter className="w-3.5 h-3.5" />
                <span>Deterministic Archive Search &amp; Filters (Zero AI Dependency)</span>
              </div>
              <button
                type="button"
                onClick={clearAllFilters}
                className="font-mono-tabular text-[11px] text-[#A6A39B] hover:text-[#F4F2ED]"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5 relative">
                <Search className="w-3.5 h-3.5 text-[#6E6C65] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Trade ID, counterparty, tx hash (0x…), evidence hash, or content…"
                  className="w-full pl-9 pr-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                />
              </div>

              <div className="md:col-span-2">
                <select
                  aria-label="Filter by Trade"
                  value={selectedTradeRef}
                  onChange={(e) => setSelectedTradeRef(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[11px] text-[#F4F2ED]"
                >
                  <option value="all">All Trades</option>
                  {availableTradeRefs.map((ref) => (
                    <option key={ref} value={ref}>
                      {ref}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  aria-label="Filter by Record Type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[11px] text-[#F4F2ED]"
                >
                  <option value="">All Record Types</option>
                  {RECORD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  aria-label="Filter by Persistence Status"
                  value={persistenceFilter}
                  onChange={(e) => setPersistenceFilter(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[11px] text-[#F4F2ED]"
                >
                  <option value="all">All Persistence States</option>
                  <option value="confirmed_mainnet">Confirmed Walrus Mainnet Only</option>
                  <option value="pending">Pending / Unconfirmed Only</option>
                  <option value="failed">Failed Writes Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <input
                  type="text"
                  value={participantFilter}
                  onChange={(e) => setParticipantFilter(e.target.value)}
                  placeholder="Filter by Participant wallet (0x…)"
                  className="w-full px-3 py-1.5 rounded-[3px] bg-[#090A0C] border border-white/[0.1] font-mono-tabular text-[11px] text-[#F4F2ED]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-[10px] uppercase text-[#6E6C65] shrink-0">
                  From:
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[3px] bg-[#090A0C] border border-white/[0.1] font-mono-tabular text-[11px] text-[#F4F2ED]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-[10px] uppercase text-[#6E6C65] shrink-0">
                  To:
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[3px] bg-[#090A0C] border border-white/[0.1] font-mono-tabular text-[11px] text-[#F4F2ED]"
                />
              </div>
            </div>
          </div>

          {/* Master-Detail Split: Left 7 Cols Register + Right 5 Cols Individual Record Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Filtered Memory Records List */}
            <div className="lg:col-span-7 surface-panel rounded-[4px] overflow-hidden">
              <div className="px-5 py-3.5 bg-[#11141B] border-b border-white/[0.07] flex items-center justify-between">
                <span className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
                  Preserved Records ({filteredMemories.length})
                </span>
                <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                  Select a record to inspect full payload &amp; lineage
                </span>
              </div>

              {loading ? (
                <div className="p-12 text-center font-mono-tabular text-[12px] text-[#6E6C65]">
                  Loading Accord Memory Box archive…
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="text-[14px] text-[#F4F2ED]">
                    No memory records match your current filters
                  </div>
                  <p className="text-[12px] text-[#6E6C65]">
                    Try clearing the search query or switching category tabs.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.07]">
                  {filteredMemories.map((mem) => {
                    const isSelected = selectedMemory?.id === mem.id;
                    return (
                      <button
                        key={mem.id}
                        type="button"
                        onClick={() => setSelectedMemoryId(mem.id)}
                        className={`w-full text-left p-5 transition-colors block space-y-2 ${
                          isSelected
                            ? "bg-[#13161C] border-l-2 border-l-[#C5A46D]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-tabular text-[11px] font-medium text-[#C5A46D]">
                              {mem.tradeRef}
                            </span>
                            <span className="status-pill">{mem.category}</span>
                            <span className="font-mono-tabular text-[10px] text-[#6E6C65]">
                              {mem.type}
                            </span>
                          </div>
                          <div>
                            {mem.verifiedOnWalrus ? (
                              <span className="status-pill status-pill-verified">
                                Mainnet Confirmed
                              </span>
                            ) : mem.persistenceStatus === "write_submitted" ? (
                              <span className="status-pill status-pill-brass">
                                Write Submitted
                              </span>
                            ) : mem.persistenceStatus === "write_failed" ? (
                              <span className="status-pill status-pill-danger">
                                Write Failed (Pending Retry)
                              </span>
                            ) : (
                              <span className="status-pill">
                                Pending Mainnet (Local Dev Mock)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-[14px] font-medium text-[#F4F2ED]">
                          {mem.title || mem.type}
                        </div>

                        <p className="text-[12px] text-[#A6A39B] line-clamp-2 leading-relaxed">
                          {mem.content}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono-tabular text-[10px] text-[#6E6C65]">
                          <span>ID: {mem.id}</span>
                          <span>SHA-256: {mem.contentHash?.slice(0, 18)}…</span>
                          <span>
                            {new Date(
                              mem.metadata?.timestamp || mem.storedAt
                            ).toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 1D. Right 5 Columns: Individual Memory Record Inspector */}
            <aside className="lg:col-span-5 lg:sticky lg:top-20">
              {selectedMemory ? (
                <div className="surface-panel rounded-[4px] overflow-hidden">
                  <div className="px-5 py-3.5 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#C5A46D]">
                        Record Inspector · {selectedMemory.category}
                      </div>
                      <div className="font-mono-tabular text-[12px] text-[#F4F2ED] mt-0.5">
                        {selectedMemory.id}
                      </div>
                    </div>
                    {selectedMemory.tradeRef &&
                      selectedMemory.tradeRef !== "ACC-GLOBAL-PREFS" && (
                        <Link
                          href={`/trade/${selectedMemory.tradeRef}`}
                          className="px-2.5 py-1 rounded-[3px] bg-[#090A0C] hover:bg-[#181C24] border border-white/[0.12] font-mono-tabular text-[11px] text-[#C5A46D] inline-flex items-center gap-1"
                        >
                          <span>Open Trade {selectedMemory.tradeRef}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      )}
                  </div>

                  <div className="p-5 space-y-5 text-[12px]">
                    <div>
                      <h2 className="text-[16px] font-medium text-[#F4F2ED]">
                        {selectedMemory.title || selectedMemory.type}
                      </h2>
                      <div className="font-mono-tabular text-[11px] text-[#6E6C65] mt-1">
                        Classification: {selectedMemory.category} / {selectedMemory.type} · Recorded{" "}
                        {new Date(
                          selectedMemory.metadata?.timestamp || selectedMemory.storedAt
                        ).toUTCString()}
                      </div>
                    </div>

                    {/* Readable Content */}
                    <div className="p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.08] space-y-1.5">
                      <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
                        Preserved Statement
                      </div>
                      <p className="text-[13px] text-[#F4F2ED] leading-relaxed">
                        {selectedMemory.content}
                      </p>
                    </div>

                    {/* Participant / Source & Integrity Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono-tabular text-[11px]">
                      <div className="p-3 rounded-[3px] bg-[#090A0C] border border-white/[0.06]">
                        <div className="text-[10px] text-[#6E6C65]">ACTOR / SOURCE</div>
                        <div className="text-[#F4F2ED] truncate mt-0.5">
                          {selectedMemory.actor || "system:accord"}
                        </div>
                        <div className="text-[10px] text-[#C5A46D] uppercase mt-0.5">
                          Role: {selectedMemory.sourceRole || "accord_ledger"}
                        </div>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#090A0C] border border-white/[0.06]">
                        <div className="text-[10px] text-[#6E6C65]">WALRUS PERSISTENCE</div>
                        <div
                          className={`mt-0.5 ${
                            selectedMemory.verifiedOnWalrus
                              ? "text-[#5CE0A8]"
                              : "text-[#C5A46D]"
                          }`}
                        >
                          {selectedMemory.persistenceStatus}
                        </div>
                        <div className="text-[10px] text-[#6E6C65] mt-0.5">
                          verifiedOnWalrus: {String(selectedMemory.verifiedOnWalrus)}
                        </div>
                      </div>
                    </div>

                    {/* Integrity Digest, Blob ID, Tx & Evidence References */}
                    <div className="space-y-2 font-mono-tabular text-[11px] p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.07]">
                      <div className="text-[10px] uppercase tracking-[0.08em] text-[#C5A46D]">
                        Cryptographic Integrity &amp; References
                      </div>
                      <div className="break-all text-[#A6A39B]">
                        <span className="text-[#6E6C65]">SHA-256 Digest: </span>
                        <span className="text-[#F4F2ED]">{selectedMemory.contentHash}</span>
                      </div>
                      {selectedMemory.blobId && (
                        <div className="break-all text-[#5CE0A8]">
                          <span className="text-[#6E6C65]">Mainnet Blob ID: </span>
                          <span>{selectedMemory.blobId}</span>
                        </div>
                      )}
                      {selectedMemory.jobId && (
                        <div className="break-all text-[#A6A39B]">
                          <span className="text-[#6E6C65]">Relayer Job ID: </span>
                          <span>{selectedMemory.jobId}</span>
                        </div>
                      )}
                      {selectedMemory.relatedTxHash && (
                        <div className="break-all text-[#A6A39B]">
                          <span className="text-[#6E6C65]">Transaction Hash: </span>
                          <span className="text-[#F4F2ED]">{selectedMemory.relatedTxHash}</span>
                        </div>
                      )}
                      {selectedMemory.relatedEvidenceHash && (
                        <div className="break-all text-[#A6A39B]">
                          <span className="text-[#6E6C65]">Evidence SHA-256: </span>
                          <span className="text-[#F4F2ED]">
                            {selectedMemory.relatedEvidenceHash}
                          </span>
                        </div>
                      )}
                      {selectedMemory.relatedTermsHash && (
                        <div className="break-all text-[#A6A39B]">
                          <span className="text-[#6E6C65]">Agreement Hash: </span>
                          <span className="text-[#F4F2ED]">{selectedMemory.relatedTermsHash}</span>
                        </div>
                      )}

                      {!selectedMemory.verifiedOnWalrus && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleRetrySingleMemory(selectedMemory.id)}
                            disabled={retryingId === selectedMemory.id}
                            className="px-3 py-1.5 rounded-[3px] bg-[#13161C] hover:bg-[#181C24] border border-[#C5A46D]/40 text-[#C5A46D] text-[11px] inline-flex items-center gap-1.5"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                retryingId === selectedMemory.id ? "animate-spin" : ""
                              }`}
                            />
                            <span>
                              {retryingId === selectedMemory.id
                                ? "Retrying Mainnet Write…"
                                : `Retry Mainnet Persistence (Attempts: ${
                                    selectedMemory.retryCount || 0
                                  })`}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Structured Payload Table */}
                    {selectedMemory.structuredPayload && (
                      <div className="space-y-1.5">
                        <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
                          Structured Record Payload
                        </div>
                        <div className="p-3 rounded-[3px] bg-[#090A0C] border border-white/[0.07] font-mono-tabular text-[11px] space-y-1 max-h-48 overflow-y-auto">
                          {Object.entries(selectedMemory.structuredPayload).map(([k, v]) => (
                            <div key={k} className="flex items-baseline justify-between gap-3">
                              <span className="text-[#6E6C65] shrink-0">{k}:</span>
                              <span className="text-[#D8D5CE] truncate text-right">
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Records for Same Trade */}
                    {relatedMemoriesForSelected.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/[0.07]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
                            Related Records in {selectedMemory.tradeRef} (
                            {relatedMemoriesForSelected.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setTimelineTradeRef(selectedMemory.tradeRef);
                              setActiveViewMode("timeline");
                            }}
                            className="font-mono-tabular text-[10px] text-[#C5A46D] hover:underline"
                          >
                            View Full Trade Timeline →
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {relatedMemoriesForSelected.map((rel) => (
                            <button
                              key={rel.id}
                              type="button"
                              onClick={() => setSelectedMemoryId(rel.id)}
                              className="w-full text-left px-3 py-2 rounded-[3px] bg-[#090A0C] hover:bg-[#13161C] border border-white/[0.06] flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="truncate">
                                <span className="font-mono-tabular text-[10px] text-[#C5A46D] mr-2">
                                  [{rel.category}]
                                </span>
                                <span className="text-[#D8D5CE]">{rel.title || rel.type}</span>
                              </div>
                              <span className="font-mono-tabular text-[10px] text-[#6E6C65] shrink-0">
                                Inspect →
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="surface-panel rounded-[4px] p-8 text-center text-[12px] text-[#6E6C65]">
                  Select any memory record on the left to inspect its structured payload and
                  cryptographic references.
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : (
        /* 1E. VIEW MODE 2: COMPLETE AUDITED TRADE TIMELINE */
        <div className="space-y-6">
          <div className="surface-panel rounded-[4px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
                Complete Chronological Trade History
              </div>
              <p className="text-[13px] text-[#A6A39B]">
                Displays only genuine lifecycle events and preserved memory records that actually
                occurred for the selected agreement.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="font-mono-tabular text-[11px] text-[#6E6C65]">
                Select Trade:
              </label>
              <select
                value={timelineTradeRef}
                onChange={(e) => setTimelineTradeRef(e.target.value)}
                className="px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.14] font-mono-tabular text-[12px] text-[#F4F2ED]"
              >
                {availableTradeRefs
                  .filter((r) => r !== "ACC-GLOBAL-PREFS")
                  .map((ref) => (
                    <option key={ref} value={ref}>
                      {ref}
                    </option>
                  ))}
              </select>
              <Link
                href={`/trade/${timelineTradeRef}`}
                className="px-3.5 py-2 rounded-[3px] bg-[#C5A46D] text-[#090A0C] font-mono-tabular text-[12px] font-medium inline-flex items-center gap-1.5"
              >
                <span>Open Room</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {activeTimelineTrade && (
            <div className="surface-panel rounded-[4px] p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono-tabular text-[12px]">
              <div>
                <div className="text-[10px] text-[#6E6C65]">TRADE REFERENCE &amp; STATUS</div>
                <div className="text-[#F4F2ED] font-medium mt-1">
                  {activeTimelineTrade.reference} ·{" "}
                  <span className="text-[#C5A46D]">{activeTimelineTrade.status}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#6E6C65]">PRINCIPAL &amp; NETWORK</div>
                <div className="text-[#F4F2ED] mt-1">
                  {activeTimelineTrade.amount} {activeTimelineTrade.asset} (
                  {activeTimelineTrade.network})
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#6E6C65]">AGREEMENT VERSION</div>
                <div className="text-[#F4F2ED] mt-1">
                  Version {activeTimelineTrade.termsVersions?.length || 1} (Buyer:{" "}
                  {activeTimelineTrade.buyerAccepted ? "Signed" : "Pending"}, Seller:{" "}
                  {activeTimelineTrade.sellerAccepted ? "Signed" : "Pending"})
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#6E6C65]">PRESERVED MEMORY RECORDS</div>
                <div className="text-[#5CE0A8] mt-1">
                  {timelineMemories.length} Memory Box Record(s)
                </div>
              </div>
            </div>
          )}

          {/* Chronological Step-by-Step Timeline */}
          <div className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex items-center justify-between">
              <span className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
                Chronological Lifecycle &amp; Memory Lineage — {timelineTradeRef}
              </span>
              <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                {timelineMemories.length} Verified Event Records
              </span>
            </div>

            {timelineMemories.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-[#6E6C65]">
                No memory records found for {timelineTradeRef}.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.07]">
                {timelineMemories.map((mem, index) => (
                  <div
                    key={mem.id}
                    className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
                  >
                    <div className="lg:col-span-2 font-mono-tabular text-[11px] space-y-1">
                      <div className="text-[#C5A46D] font-medium">
                        STEP {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="text-[#6E6C65]">
                        {new Date(
                          mem.metadata?.timestamp || mem.storedAt
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                      <span className="status-pill">{mem.category}</span>
                    </div>

                    <div className="lg:col-span-7 space-y-2">
                      <div className="text-[15px] font-medium text-[#F4F2ED]">
                        {mem.title || mem.type}
                      </div>
                      <p className="text-[13px] text-[#A6A39B] leading-relaxed">
                        {mem.content}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 font-mono-tabular text-[11px] text-[#6E6C65]">
                        <span>Actor: {mem.actor}</span>
                        <span>SHA-256: {mem.contentHash?.slice(0, 18)}…</span>
                        {mem.relatedTxHash && (
                          <span className="text-[#5CE0A8]">
                            Tx: {mem.relatedTxHash.slice(0, 14)}…
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-3 flex lg:flex-col items-end justify-between gap-2">
                      <span
                        className={`status-pill ${
                          mem.verifiedOnWalrus
                            ? "status-pill-verified"
                            : "status-pill-brass"
                        }`}
                      >
                        {mem.verifiedOnWalrus
                          ? "Confirmed Walrus Mainnet"
                          : mem.persistenceStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemoryId(mem.id);
                          setActiveViewMode("archive");
                        }}
                        className="font-mono-tabular text-[11px] text-[#C5A46D] hover:underline"
                      >
                        Inspect Record Payload →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
