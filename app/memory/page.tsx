"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Search, Plus } from "lucide-react";

export default function WalrusMemoryExplorerPage() {
  const [memories, setMemories] = useState<any[]>([]);
  const [relayerHealth, setRelayerHealth] = useState<any | null>(null);
  const [configStatus, setConfigStatus] = useState<any | null>(null);
  const [mainnetVerifiedCount, setMainnetVerifiedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const [newTradeRef, setNewTradeRef] = useState("ACC-GLOBAL-PREFS");
  const [newMemoryType, setNewMemoryType] = useState("USER_PREFERENCE");
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [writingMemory, setWritingMemory] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const loadMemoriesAndHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory/seed");
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories || []);
        setRelayerHealth(data.relayerHealth || null);
        setConfigStatus(data.configStatus || null);
        setMainnetVerifiedCount(data.mainnetVerifiedCount || 0);
      }
    } catch (err) {
      console.error("Failed to load Walrus Memory status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemoriesAndHealth();
  }, []);

  const handleSyncMemories = async () => {
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
        setRelayerHealth(data.relayerHealth || null);
        setConfigStatus(data.configStatus || null);
        setMainnetVerifiedCount(data.mainnetVerifiedCount || 0);
        setStatusBanner(data.message);
      }
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRecallSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", searchQuery.trim() || "*");
      if (selectedType) params.set("type", selectedType);
      params.set("limit", "25");

      const res = await fetch(`/api/memory/recall?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories || []);
      }
    } catch (err) {
      console.error("Recall search failed:", err);
    } finally {
      setLoading(false);
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
          type: newMemoryType,
          content: newMemoryContent.trim(),
          metadata: {
            source: "accord_memory_explorer",
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.memory) {
        setMemories([data.memory, ...memories]);
        setNewMemoryContent("");
        setStatusBanner(
          data.memory.verifiedOnWalrus
            ? `Anchored to Walrus Mainnet (Job ID: ${data.memory.jobId}).`
            : `Indexed in MemWalMock (${data.memory.id}). Configure MEMWAL_PRIVATE_KEY & MEMWAL_ACCOUNT_ID in .env.local for live Mainnet blob anchoring.`
        );
      }
    } catch (err: any) {
      setStatusBanner(`Failed to write memory: ${err.message}`);
    } finally {
      setWritingMemory(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/[0.08]">
        <div className="space-y-2">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#6E6C65]">
            Walrus Memory Mainnet Integration (@mysten-incubation/memwal)
          </div>
          <h1 className="font-editorial text-[34px] sm:text-[42px] leading-[1.08] tracking-[-0.02em] text-[#F4F2ED]">
            Persistent Trade Memory Vault
          </h1>
          <p className="text-[14px] text-[#A6A39B] max-w-[64ch]">
            Inspect persistent trade context, verify Walrus Mainnet relayer connectivity, and run
            semantic recall queries across agreement terms, transaction proofs, and user preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncMemories}
          disabled={syncing}
          className="px-4 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium inline-flex items-center gap-2 shrink-0 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "Syncing with Relayer…" : "Verify / Sync 12+ Memories"}</span>
        </button>
      </div>

      {/* Technical Status Strip */}
      <div className="surface-panel rounded-[4px] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.07] font-mono-tabular text-[12px]">
        <div className="p-5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#6E6C65]">
            <span>MAINNET RELAYER ENDPOINT</span>
            <span
              className={
                relayerHealth?.status === "ok" ? "text-[#5CE0A8]" : "text-[#C88A32]"
              }
            >
              {relayerHealth?.status === "ok" ? "ONLINE (200 OK)" : "CHECKING"}
            </span>
          </div>
          <div className="text-[#F4F2ED] truncate">
            {relayerHealth?.url || "https://relayer.memory.walrus.xyz"}
          </div>
          <div className="text-[11px] text-[#6E6C65]">
            Mode: {relayerHealth?.mode || "production"} · Writes Ready:{" "}
            {relayerHealth?.writesReady ? "Yes" : "No"}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#6E6C65]">
            <span>SUI SEAL CREDENTIALS (.env.local)</span>
            <span
              className={
                configStatus?.configured ? "text-[#5CE0A8]" : "text-[#C88A32]"
              }
            >
              {configStatus?.configured ? "CONFIGURED" : "LOCAL MOCK ACTIVE"}
            </span>
          </div>
          <div className="text-[#A6A39B] text-[11px] leading-relaxed">
            {configStatus?.configured ? (
              <span>
                Account <span className="text-[#F4F2ED]">{configStatus.accountIdPreview}</span> ·
                Namespace <span className="text-[#F4F2ED]">{configStatus.namespace}</span>
              </span>
            ) : (
              <span>
                Missing{" "}
                <span className="text-[#F4F2ED]">
                  {(configStatus?.missingEnvVars || ["MEMWAL_PRIVATE_KEY", "MEMWAL_ACCOUNT_ID"]).join(
                    ", "
                  )}
                </span>
                . Unconfigured writes use <span className="text-[#F4F2ED]">MemWalMock</span> and
                report <span className="text-[#C88A32]">verifiedOnWalrus: false</span>.
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#6E6C65]">
            <span>VERIFICATION ACCOUNTING</span>
            <span className="text-[#C5A46D]">{memories.length} Records</span>
          </div>
          <div className="text-[18px] text-[#F4F2ED] font-medium">
            {mainnetVerifiedCount} Mainnet Confirmed / {memories.length} Indexed
          </div>
          <div className="text-[11px] text-[#6E6C65]">
            Strict epistemic accounting — zero fabricated blob IDs
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-[3px] bg-[#13161C] border border-[#C5A46D]/40 text-[#F4F2ED] font-mono-tabular text-[12px] flex items-center justify-between">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[#6E6C65] hover:text-[#F4F2ED] pl-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Recall Query & Write Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleRecallSearch}
          className="lg:col-span-7 surface-panel rounded-[4px] p-5 space-y-3"
        >
          <div className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
            Semantic &amp; Metadata Recall (sdk.recall)
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#6E6C65] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Query memories (e.g., Base Mainnet, 0xf5bd…, dispute, preference)…"
                className="w-full pl-9 pr-3.5 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
            >
              <option value="">All Classifications</option>
              <option value="TRADE_TERMS">TRADE_TERMS</option>
              <option value="TERMS_AMENDMENT">TERMS_AMENDMENT</option>
              <option value="TRADE_ACCEPTANCE">TRADE_ACCEPTANCE</option>
              <option value="ONCHAIN_VERIFICATION">ONCHAIN_VERIFICATION</option>
              <option value="CONDITION_UPDATE">CONDITION_UPDATE</option>
              <option value="DISPUTE_EVIDENCE">DISPUTE_EVIDENCE</option>
              <option value="DISPUTE_RESOLUTION">DISPUTE_RESOLUTION</option>
              <option value="SETTLEMENT_LESSON">SETTLEMENT_LESSON</option>
              <option value="USER_PREFERENCE">USER_PREFERENCE</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-[3px] bg-[#13161C] hover:bg-[#181C24] border border-white/[0.14] font-mono-tabular text-[12px] text-[#F4F2ED]"
            >
              Recall
            </button>
          </div>
        </form>

        <form
          onSubmit={handleWriteNewMemory}
          className="lg:col-span-5 surface-panel rounded-[4px] p-5 space-y-3"
        >
          <div className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
            Append Persistent Memory (sdk.remember)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newTradeRef}
              onChange={(e) => setNewTradeRef(e.target.value)}
              placeholder="Reference (ACC-…)"
              className="px-3 py-1.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
            />
            <select
              value={newMemoryType}
              onChange={(e) => setNewMemoryType(e.target.value)}
              className="px-3 py-1.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
            >
              <option value="USER_PREFERENCE">USER_PREFERENCE</option>
              <option value="SETTLEMENT_LESSON">SETTLEMENT_LESSON</option>
              <option value="TRADE_TERMS">TRADE_TERMS</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              placeholder="Explicit user safety rule or trade note…"
              className="flex-1 px-3 py-1.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
            />
            <button
              type="submit"
              disabled={writingMemory}
              className="px-3.5 py-1.5 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Write</span>
            </button>
          </div>
        </form>
      </div>

      {/* Memories Register Table */}
      <div className="border-t border-white/[0.1]">
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 py-3 border-b border-white/[0.07] font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#6E6C65]">
          <div className="col-span-2">Reference</div>
          <div className="col-span-2">Classification</div>
          <div className="col-span-5">Memory Payload</div>
          <div className="col-span-3 text-right">Verification / Digest</div>
        </div>

        {loading ? (
          <div className="py-12 text-center font-mono-tabular text-[12px] text-[#6E6C65]">
            Loading persistent memory register…
          </div>
        ) : (
          <div className="divide-y divide-white/[0.07] border-b border-white/[0.07]">
            {memories.map((mem) => (
              <div
                key={mem.id}
                className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start"
              >
                <div className="lg:col-span-2 font-mono-tabular text-[12px] text-[#F4F2ED]">
                  <div>{mem.tradeRef}</div>
                  <div className="text-[11px] text-[#6E6C65] mt-0.5">{mem.id}</div>
                </div>

                <div className="lg:col-span-2">
                  <span className="status-pill status-pill-brass">{mem.type}</span>
                </div>

                <div className="lg:col-span-5 text-[13px] text-[#D8D5CE] leading-relaxed">
                  {mem.content}
                </div>

                <div className="lg:col-span-3 lg:text-right font-mono-tabular text-[11px] space-y-1">
                  <div>
                    {mem.verifiedOnWalrus ? (
                      <span className="status-pill status-pill-verified">
                        Mainnet Verified ({mem.jobId || "confirmed"})
                      </span>
                    ) : (
                      <span className="status-pill">
                        MemWalMock (verifiedOnWalrus: false)
                      </span>
                    )}
                  </div>
                  <div className="text-[#6E6C65]">
                    SHA-256: {mem.contentHash?.slice(0, 16)}…
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
