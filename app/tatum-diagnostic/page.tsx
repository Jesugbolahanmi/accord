"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Search } from "lucide-react";

export default function TatumDiagnosticPage() {
  const [selectedNetwork, setSelectedNetwork] = useState("base-mainnet");
  const [diagData, setDiagData] = useState<any | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(true);

  const [txHash, setTxHash] = useState(
    "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c"
  );
  const [txNetwork, setTxNetwork] = useState("base-mainnet");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  const runDiagnostics = async (network = selectedNetwork) => {
    setLoadingDiag(true);
    try {
      const res = await fetch(`/api/tatum/diagnose?network=${encodeURIComponent(network)}`);
      const data = await res.json();
      if (data.success) {
        setDiagData(data);
      }
    } catch (err) {
      console.error("Failed to run Tatum diagnostics:", err);
    } finally {
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    runDiagnostics(selectedNetwork);
  }, [selectedNetwork]);

  const handleInspectTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txHash.trim()) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/tatum/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: txHash.trim(),
          network: txNetwork,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVerificationResult(data.verification);
      }
    } catch (err) {
      console.error("Failed to verify tx:", err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/[0.08]">
        <div className="space-y-2">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#6E6C65]">
            Tatum JSON-RPC Gateway &amp; Agent Specification
          </div>
          <h1 className="font-editorial text-[34px] sm:text-[42px] leading-[1.08] tracking-[-0.02em] text-[#F4F2ED]">
            On-Chain Verification Telemetry
          </h1>
          <p className="text-[14px] text-[#A6A39B] max-w-[64ch]">
            Inspect live block height, RPC round-trip latency, and raw transaction receipts across
            Base, Ethereum, and Polygon through the Tatum Gateway.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value)}
            className="px-3 py-2 rounded-[3px] bg-[#0E1014] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
          >
            <option value="base-mainnet">Base Mainnet (base-mainnet)</option>
            <option value="base-sepolia">Base Sepolia (base-sepolia)</option>
            <option value="ethereum-mainnet">Ethereum Mainnet (ethereum-mainnet)</option>
            <option value="polygon-mainnet">Polygon Mainnet (polygon-mainnet)</option>
          </select>

          <button
            type="button"
            onClick={() => runDiagnostics(selectedNetwork)}
            className="px-4 py-2 rounded-[3px] bg-[#13161C] hover:bg-[#181C24] border border-white/[0.14] font-mono-tabular text-[12px] text-[#F4F2ED] inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDiag ? "animate-spin text-[#C5A46D]" : ""}`} />
            <span>Probe Gateway</span>
          </button>
        </div>
      </div>

      {/* Telemetry Strip */}
      <div className="surface-panel rounded-[4px] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.07] font-mono-tabular text-[12px]">
        <div className="p-5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#6E6C65]">
            <span>GATEWAY ENDPOINT</span>
            <span
              className={
                diagData?.diagnostic?.status === "offline"
                  ? "text-[#C94A4A]"
                  : "text-[#5CE0A8]"
              }
            >
              {(diagData?.diagnostic?.status || "ONLINE").toUpperCase()}
            </span>
          </div>
          <div className="text-[#F4F2ED] truncate">
            {diagData?.diagnostic?.network?.gatewayUrl ||
              "https://base-mainnet.gateway.tatum.io"}
          </div>
          <div className="text-[11px] text-[#6E6C65]">
            Chain ID: {diagData?.diagnostic?.network?.chainId || 8453} · Round-Trip:{" "}
            <span className="text-[#F4F2ED]">{diagData?.diagnostic?.latencyMs ?? "—"} ms</span>
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#6E6C65]">
            <span>LATEST BLOCK HEIGHT</span>
            <span className="text-[#C5A46D]">eth_blockNumber</span>
          </div>
          <div className="text-[24px] font-medium text-[#F4F2ED] leading-none pt-0.5">
            #{diagData?.diagnostic?.blockNumber?.toLocaleString() || "—"}
          </div>
          <div className="text-[11px] text-[#6E6C65] pt-0.5">
            Auth:{" "}
            {diagData?.diagnostic?.apiKeyConfigured
              ? "Server x-api-key header active"
              : "Public Gateway tier"}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#6E6C65]">
            <span>TATUM AI BUILDER (ai.tatum.io)</span>
            <span className="text-[#5CE0A8]">
              {diagData?.aiBuilder?.connected ? "CONNECTED" : "SPEC READY"}
            </span>
          </div>
          <div className="text-[16px] text-[#F4F2ED] font-medium">
            {diagData?.aiBuilder?.manifestSummary
              ? `${diagData.aiBuilder.manifestSummary.chainsCount} Chains · ${diagData.aiBuilder.manifestSummary.workflowsCount} Workflows`
              : "EVM Receipt & Payment Monitor Blueprints"}
          </div>
          <div className="text-[11px] text-[#6E6C65]">
            Used for server-side receipt &amp; confirmation depth verification
          </div>
        </div>
      </div>

      {/* Interactive Receipt Inspector */}
      <section className="surface-panel rounded-[4px] overflow-hidden">
        <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-medium text-[#F4F2ED]">
              Transaction Receipt Inspector
            </h2>
            <p className="text-[12px] text-[#A6A39B] mt-0.5">
              Execute <code className="font-mono-tabular text-[#F4F2ED]">tatum.verifyTransaction()</code>{" "}
              against any transaction hash. Pre-filled with a live Base Mainnet transaction.
            </p>
          </div>
          <span className="font-mono-tabular text-[11px] text-[#C5A46D]">
            eth_getTransactionReceipt
          </span>
        </div>

        <div className="p-6 space-y-5">
          <form onSubmit={handleInspectTx} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#6E6C65] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x…"
                className="w-full pl-9 pr-3.5 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
              />
            </div>

            <select
              value={txNetwork}
              onChange={(e) => setTxNetwork(e.target.value)}
              className="px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
            >
              <option value="base-mainnet">Base Mainnet</option>
              <option value="base-sepolia">Base Sepolia</option>
              <option value="ethereum-mainnet">Ethereum Mainnet</option>
              <option value="polygon-mainnet">Polygon Mainnet</option>
            </select>

            <button
              type="submit"
              disabled={verifying}
              className="px-5 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium transition-colors"
            >
              {verifying ? "Querying Gateway…" : "Inspect Receipt"}
            </button>
          </form>

          {verificationResult && (
            <div className="border border-white/[0.1] rounded-[3px] bg-[#090A0C] overflow-hidden font-mono-tabular text-[12px]">
              <div className="px-4 py-2.5 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between">
                <span
                  className={
                    verificationResult.verified ? "text-[#5CE0A8]" : "text-[#C88A32]"
                  }
                >
                  STATUS: {verificationResult.status?.toUpperCase()} · VERIFIED:{" "}
                  {String(verificationResult.verified).toUpperCase()}
                </span>
                <span className="text-[#6E6C65]">{verificationResult.network}</span>
              </div>

              {verificationResult.errorMessage ? (
                <div className="p-4 text-[#F28B8B]">{verificationResult.errorMessage}</div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                  <div>
                    <dt className="text-[10px] text-[#6E6C65] uppercase">Sender (From)</dt>
                    <dd className="text-[#F4F2ED] truncate mt-0.5">{verificationResult.from}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6E6C65] uppercase">Recipient (To)</dt>
                    <dd className="text-[#F4F2ED] truncate mt-0.5">{verificationResult.to}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6E6C65] uppercase">Block &amp; Depth</dt>
                    <dd className="text-[#5CE0A8] mt-0.5">
                      #{verificationResult.blockNumber} ({verificationResult.confirmations} confs)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6E6C65] uppercase">Transferred Value</dt>
                    <dd className="text-[#C5A46D] font-medium mt-0.5">
                      {verificationResult.valueEth} ETH
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
