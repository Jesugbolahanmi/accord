"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Check,
  Send,
  AlertCircle,
} from "lucide-react";

const EXPLORER_MAP: Record<string, string> = {
  "base-mainnet": "https://basescan.org",
  "base-sepolia": "https://sepolia.basescan.org",
  "ethereum-mainnet": "https://etherscan.io",
  "polygon-mainnet": "https://polygonscan.com",
};

const PRACTICAL_QUESTIONS = [
  "What have both parties agreed to?",
  "Has the deposit actually been confirmed?",
  "Which condition remains outstanding?",
  "What happened during our previous trade?",
  "What evidence is needed to resolve this dispute?",
];

export default function SharedTradeRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address: connectedWallet } = useAccount();

  const [trade, setTrade] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [activeActor, setActiveActor] = useState<string>("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Term amendment state
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [amendedTermsText, setAmendedTermsText] = useState("");
  const [amendmentSummary, setAmendmentSummary] = useState("");

  // Tatum RPC Deposit Verification state
  const [txHashInput, setTxHashInput] = useState("");
  const [verifyingTx, setVerifyingTx] = useState(false);

  // Off-chain condition attestation notes
  const [attestationNotes, setAttestationNotes] = useState<Record<string, string>>({});

  // Dispute & Arbiter resolution state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEvidenceText, setDisputeEvidenceText] = useState("");
  const [arbiterBuyerSplitPct, setArbiterBuyerSplitPct] = useState(100);
  const [arbiterResolutionNote, setArbiterResolutionNote] = useState("");

  // Context Assistant state
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<any | null>(null);
  const [askingAssistant, setAskingAssistant] = useState(false);

  // Trade Memory Box records
  const [tradeMemories, setTradeMemories] = useState<any[]>([]);
  const [selectedMemoryCategory, setSelectedMemoryCategory] = useState<string>("ALL");

  const loadTradeRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.trade) {
        setTrade(data.trade);
        if (Array.isArray(data.memories)) {
          setTradeMemories(data.memories);
        }
        setAmendedTermsText(data.trade.agreedTerms || "");
        if (!txHashInput && data.trade.txHash) {
          setTxHashInput(data.trade.txHash);
        } else if (!txHashInput && data.trade.sampleVerifiableTxHash) {
          setTxHashInput(data.trade.sampleVerifiableTxHash);
        }
        if (!activeActor) {
          if (
            connectedWallet &&
            (connectedWallet.toLowerCase() === data.trade.buyer.toLowerCase() ||
              connectedWallet.toLowerCase() === data.trade.seller.toLowerCase() ||
              connectedWallet.toLowerCase() === data.trade.arbiter.toLowerCase())
          ) {
            setActiveActor(connectedWallet.toLowerCase());
          } else if (!data.trade.sellerAccepted) {
            setActiveActor(data.trade.seller);
          } else {
            setActiveActor(data.trade.buyer);
          }
        }
      }
    } catch (err) {
      console.error("Error loading trade room:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTradeRoom();
  }, [id]);

  const runTradeAction = async (payload: Record<string, any>, successNotice: string) => {
    setFeedback(null);
    setActionLoading(payload.action);
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(trade.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Operation failed");
      }
      setTrade(data.trade);
      if (Array.isArray(data.memories)) {
        setTradeMemories(data.memories);
      }
      setFeedback({ type: "success", message: successNotice });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyDepositWithTatum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txHashInput.trim()) return;
    setFeedback(null);
    setVerifyingTx(true);

    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(trade.id)}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: txHashInput.trim(),
          network: trade.network,
          actor: activeActor || trade.buyer,
        }),
      });
      const data = await res.json();
      if (data.trade) {
        setTrade(data.trade);
      }
      if (Array.isArray(data.memories)) {
        setTradeMemories(data.memories);
      }
      if (!res.ok || !data.verified) {
        throw new Error(
          data.message || data.error || "Tatum RPC could not verify this transaction receipt."
        );
      }
      setFeedback({
        type: "success",
        message: `Verified via Tatum RPC: Block #${data.verification.blockNumber} (${data.verification.confirmations} confirmations) on ${trade.network}.`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setVerifyingTx(false);
    }
  };

  const askContextAssistant = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || !trade) return;
    setAskingAssistant(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          tradeId: trade.id,
          tradeRef: trade.reference,
          currentUser: activeActor || trade.buyer,
          txHash: trade.txHash || undefined,
          clientTradeSnapshot: trade,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAssistantResponse({ ...data, question: data.question || trimmed });
        setAssistantQuestion("");
      } else {
        setAssistantResponse({
          question: trimmed,
          answer: `Unable to process inquiry: ${data.error || "Unknown error"}`,
          verifiedFacts: [],
          userClaims: [],
        });
      }
    } catch (err: any) {
      setAssistantResponse({
        question: trimmed,
        answer: `Assistant connection error: ${err?.message || "Failed to reach /api/assistant"}`,
        verifiedFacts: [],
        userClaims: [],
      });
    } finally {
      setAskingAssistant(false);
    }
  };

  const copyShareLink = () => {
    if (typeof window === "undefined" || !trade) return;
    const url = `${window.location.origin}/trade/${trade.reference}`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  if (loading) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-12 space-y-6">
        <div className="h-24 surface-panel animate-pulse rounded-[4px]" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-96 surface-panel animate-pulse rounded-[4px]" />
          <div className="lg:col-span-4 h-96 surface-panel animate-pulse rounded-[4px]" />
        </div>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-20 text-center space-y-4">
        <div className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#C94A4A]">
          404 / Agreement Not Found
        </div>
        <h1 className="font-editorial text-[32px] text-[#F4F2ED]">
          No trade agreement matches {id}
        </h1>
        <p className="text-[14px] text-[#A6A39B]">
          Verify the reference code or return to the active agreements register.
        </p>
        <div className="pt-2">
          <Link
            href="/trades"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[3px] bg-[#C5A46D] text-[#090A0C] text-[12px] font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Register</span>
          </Link>
        </div>
      </div>
    );
  }

  const isBuyerActor = activeActor.toLowerCase() === trade.buyer.toLowerCase();
  const isSellerActor = activeActor.toLowerCase() === trade.seller.toLowerCase();
  const isArbiterActor = activeActor.toLowerCase() === trade.arbiter.toLowerCase();
  const explorerBase = EXPLORER_MAP[trade.network] || "https://basescan.org";
  const latestVersion = (trade.termsVersions || []).length || 1;

  const getNextStepSummary = () => {
    switch (trade.status) {
      case "AwaitingAcceptance":
        return !trade.sellerAccepted
          ? `Seller (${trade.seller.slice(0, 8)}…) must review and sign Version ${latestVersion} terms.`
          : `Buyer (${trade.buyer.slice(0, 8)}…) must review and sign Version ${latestVersion} terms.`;
      case "AwaitingDeposit":
        return `Buyer (${trade.buyer.slice(0, 8)}…) transfers ${trade.amount} ${trade.asset} on ${trade.network} and verifies the tx hash via Tatum RPC.`;
      case "Funded":
      case "AwaitingConditions":
        return `Complete and attest outstanding settlement conditions (${
          trade.conditions.filter((c: any) => !c.completed).length
        } remaining).`;
      case "ReadyForRelease":
        return `All conditions satisfied. Buyer (${trade.buyer.slice(0, 8)}…) can now authorize final settlement release.`;
      case "Disputed":
        return `Dispute active. Neutral Arbiter (${trade.arbiter.slice(0, 8)}…) reviews SHA-256 evidence and executes split/refund ruling.`;
      case "Completed":
        return `Trade settled. ${trade.amount} ${trade.asset} released to Seller (${trade.seller.slice(0, 8)}…).`;
      case "Refunded":
        return `Principal refunded to Buyer (${trade.buyer.slice(0, 8)}…).`;
      default:
        return `Current state: ${trade.status}`;
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
      {/* Top Instrument Navigation & Perspective Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div className="flex items-start sm:items-center gap-3.5">
          <Link
            href="/trades"
            className="p-2 rounded-[3px] bg-[#0E1014] hover:bg-[#13161C] border border-white/[0.1] text-[#A6A39B] hover:text-[#F4F2ED] transition-colors mt-0.5 sm:mt-0"
            title="Back to Agreements"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono-tabular text-[13px] font-medium text-[#C5A46D]">
                {trade.reference}
              </span>
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
              <span className="status-pill">
                {trade.settlementMode === "escrow"
                  ? "Contract Escrow"
                  : "Direct Verified Settlement"}
              </span>
            </div>
            <h1 className="font-editorial text-[26px] sm:text-[32px] leading-tight text-[#F4F2ED] mt-1">
              {trade.amount} {trade.asset} Settlement Instrument
            </h1>
          </div>
        </div>

        {/* Invitation Copy & Participant Perspective Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={copyShareLink}
            className="px-3 py-1.5 rounded-[3px] bg-[#0E1014] hover:bg-[#13161C] border border-white/[0.12] font-mono-tabular text-[11px] text-[#F4F2ED] inline-flex items-center gap-1.5 transition-colors"
          >
            {copiedInvite ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#5CE0A8]" />
                <span>Invite URL Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#C5A46D]" />
                <span>Copy Invite URL</span>
              </>
            )}
          </button>

          <div
            role="group"
            aria-label="Active participant role"
            className="inline-flex items-center bg-[#0E1014] border border-white/[0.1] rounded-[3px] p-0.5 font-mono-tabular text-[11px]"
          >
            <span className="px-2 text-[#6E6C65] hidden sm:inline">View as:</span>
            <button
              type="button"
              onClick={() => setActiveActor(trade.buyer)}
              className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                isBuyerActor
                  ? "bg-[#C5A46D] text-[#090A0C] font-medium"
                  : "text-[#A6A39B] hover:text-[#F4F2ED]"
              }`}
            >
              Buyer
            </button>
            <button
              type="button"
              onClick={() => setActiveActor(trade.seller)}
              className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                isSellerActor
                  ? "bg-[#C5A46D] text-[#090A0C] font-medium"
                  : "text-[#A6A39B] hover:text-[#F4F2ED]"
              }`}
            >
              Seller
            </button>
            <button
              type="button"
              onClick={() => setActiveActor(trade.arbiter)}
              className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                isArbiterActor
                  ? "bg-[#C5A46D] text-[#090A0C] font-medium"
                  : "text-[#A6A39B] hover:text-[#F4F2ED]"
              }`}
            >
              Arbiter
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Ledger Strip (4 Columns) */}
      <div className="surface-panel rounded-[4px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07]">
        <div className="p-4 sm:p-5">
          <div className="text-[10px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
            Principal &amp; Network
          </div>
          <div className="mt-1 font-mono-tabular text-[20px] font-medium text-[#F4F2ED]">
            {trade.amount} <span className="text-[13px] text-[#A6A39B]">{trade.asset}</span>
          </div>
          <div className="mt-0.5 font-mono-tabular text-[11px] text-[#A6A39B]">
            {trade.network}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-[10px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
            Bilateral Signatures (v{latestVersion})
          </div>
          <div className="mt-1.5 space-y-1 font-mono-tabular text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[#A6A39B]">Buyer ({trade.buyer.slice(0, 6)}…)</span>
              <span className={trade.buyerAccepted ? "text-[#5CE0A8]" : "text-[#C88A32]"}>
                {trade.buyerAccepted ? "Signed ✓" : "Pending"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#A6A39B]">Seller ({trade.seller.slice(0, 6)}…)</span>
              <span className={trade.sellerAccepted ? "text-[#5CE0A8]" : "text-[#C88A32]"}>
                {trade.sellerAccepted ? "Signed ✓" : "Pending"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-[10px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
            Tatum RPC Receipt Status
          </div>
          {trade.verification?.verified ? (
            <div className="mt-1.5 space-y-0.5 font-mono-tabular">
              <div className="text-[13px] text-[#5CE0A8] font-medium">
                Confirmed (0x1) · Block #{trade.verification.blockNumber}
              </div>
              <div className="text-[11px] text-[#A6A39B]">
                {trade.verification.confirmations} confirmations · {trade.verification.valueEth}{" "}
                {trade.asset}
              </div>
            </div>
          ) : (
            <div className="mt-1.5 space-y-0.5 font-mono-tabular">
              <div className="text-[13px] text-[#A6A39B]">No Verified Receipt Yet</div>
              <div className="text-[11px] text-[#6E6C65]">
                Requires Tatum Gateway verification
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 bg-[#11141B]/60">
          <div className="text-[10px] font-mono-tabular uppercase tracking-[0.08em] text-[#C5A46D]">
            Next Required Action
          </div>
          <p className="mt-1.5 text-[12px] text-[#F4F2ED] leading-snug">
            {getNextStepSummary()}
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-[3px] border font-mono-tabular text-[12px] flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#2E9B6E]/10 border-[#2E9B6E]/40 text-[#5CE0A8]"
              : "bg-[#C94A4A]/10 border-[#C94A4A]/40 text-[#F28B8B]"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[#A6A39B] hover:text-[#F4F2ED] pl-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 12-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Columns: The Agreement Instrument, Tatum RPC, Conditions & Audit Trail */}
        <div className="lg:col-span-8 space-y-8">
          {/* I. WRITTEN AGREEMENT & VERSION LEDGER */}
          <section className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] text-[#C5A46D]">SECTION I</span>
                <h2 className="text-[14px] font-medium text-[#F4F2ED]">
                  Written Agreement — Version {latestVersion}
                </h2>
                <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                  SHA-256: {trade.termsHash?.slice(0, 14)}…
                </span>
              </div>

              <div className="flex items-center gap-2">
                {(trade.status === "Draft" ||
                  trade.status === "AwaitingAcceptance" ||
                  trade.status === "AwaitingDeposit") &&
                  (isBuyerActor || isSellerActor) && (
                    <button
                      type="button"
                      onClick={() => setIsEditingTerms(!isEditingTerms)}
                      className="px-3 py-1 rounded-[3px] bg-[#090A0C] hover:bg-[#181C24] border border-white/[0.12] font-mono-tabular text-[11px] text-[#A6A39B] hover:text-[#F4F2ED] transition-colors"
                    >
                      {isEditingTerms ? "Cancel Amendment" : "Propose Amendment"}
                    </button>
                  )}

                {((isBuyerActor && !trade.buyerAccepted) ||
                  (isSellerActor && !trade.sellerAccepted)) && (
                  <button
                    type="button"
                    disabled={actionLoading === "accept_terms"}
                    onClick={() =>
                      runTradeAction(
                        { action: "accept_terms", actor: activeActor },
                        `Signed Version ${latestVersion} terms as ${
                          isBuyerActor ? "Buyer" : "Seller"
                        }.`
                      )
                    }
                    className="px-3.5 py-1 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[11px] font-medium transition-colors"
                  >
                    {actionLoading === "accept_terms"
                      ? "Signing…"
                      : `Sign & Accept Version ${latestVersion}`}
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {isEditingTerms ? (
                <div className="p-4 rounded-[3px] bg-[#090A0C] border border-[#C5A46D]/40 space-y-3">
                  <div className="font-mono-tabular text-[11px] text-[#C5A46D]">
                    AMENDMENT PROPOSAL — CREATES VERSION {latestVersion + 1} &amp; RESETS
                    COUNTERPARTY SIGNATURE
                  </div>
                  <textarea
                    rows={3}
                    value={amendedTermsText}
                    onChange={(e) => setAmendedTermsText(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#0E1014] border border-white/[0.12] text-[13px] text-[#F4F2ED]"
                  />
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={amendmentSummary}
                      onChange={(e) => setAmendmentSummary(e.target.value)}
                      placeholder="Summary of change (e.g., Extended inspection window to 4 hours)"
                      className="flex-1 px-3 py-2 rounded-[3px] bg-[#0E1014] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                    />
                    <button
                      type="button"
                      disabled={actionLoading === "update_terms"}
                      onClick={async () => {
                        await runTradeAction(
                          {
                            action: "update_terms",
                            actor: activeActor,
                            newTerms: amendedTermsText,
                            changeSummary: amendmentSummary,
                          },
                          `Issued Version ${
                            latestVersion + 1
                          }. Counterparty acceptance has been reset for review.`
                        );
                        setIsEditingTerms(false);
                        setAmendmentSummary("");
                      }}
                      className="px-4 py-2 rounded-[3px] bg-[#C5A46D] text-[#090A0C] font-mono-tabular text-[12px] font-medium"
                    >
                      Issue Version {latestVersion + 1}
                    </button>
                  </div>
                </div>
              ) : (
                <blockquote className="p-4 rounded-[3px] bg-[#090A0C] border-l-2 border-[#C5A46D] text-[14px] leading-[1.65] text-[#E6E3DC]">
                  {trade.agreedTerms}
                </blockquote>
              )}

              {/* Counterparty Address Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/[0.07] font-mono-tabular text-[11px]">
                <div>
                  <div className="text-[#6E6C65]">BUYER ADDRESS</div>
                  <div className="text-[#F4F2ED] mt-1 break-all">{trade.buyer}</div>
                </div>
                <div>
                  <div className="text-[#6E6C65]">SELLER ADDRESS</div>
                  <div className="text-[#F4F2ED] mt-1 break-all">{trade.seller}</div>
                </div>
                <div>
                  <div className="text-[#6E6C65]">NEUTRAL ARBITER</div>
                  <div className="text-[#A6A39B] mt-1 break-all">{trade.arbiter}</div>
                </div>
              </div>

              {/* Version History Ledger */}
              {trade.termsVersions && trade.termsVersions.length > 1 && (
                <div className="pt-4 border-t border-white/[0.07] space-y-2">
                  <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
                    Agreement Version History ({trade.termsVersions.length} Revisions)
                  </div>
                  <div className="divide-y divide-white/[0.06] border border-white/[0.07] rounded-[3px] bg-[#090A0C]">
                    {trade.termsVersions.map((ver: any) => (
                      <div key={ver.version} className="p-3 space-y-1 text-[12px]">
                        <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                          <span className="text-[#C5A46D]">
                            v{ver.version} — {ver.changeSummary || "Clause recorded"}
                          </span>
                          <span className="text-[#6E6C65]">
                            by {ver.proposedBy?.slice(0, 8)}… · SHA {ver.termsHash?.slice(0, 10)}…
                          </span>
                        </div>
                        <p className="text-[#A6A39B] text-[12px]">{ver.terms}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* II. ON-CHAIN VERIFICATION (TATUM RPC GATEWAY) */}
          <section className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] text-[#C5A46D]">SECTION II</span>
                <h2 className="text-[14px] font-medium text-[#F4F2ED]">
                  On-Chain Receipt Verification (Tatum JSON-RPC)
                </h2>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                {trade.network}.gateway.tatum.io
              </span>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] text-[#A6A39B] leading-relaxed">
                Submit the settlement transaction hash on{" "}
                <span className="text-[#F4F2ED] font-mono-tabular">{trade.network}</span>. Accord
                verifies the receipt status (<code className="font-mono-tabular text-[#5CE0A8]">0x1</code>), block confirmation depth, sender, recipient, and transferred amount before advancing the agreement to Funded.
              </p>

              <form onSubmit={handleVerifyDepositWithTatum} className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    placeholder="0x… transaction hash (66 characters)"
                    className="flex-1 px-3.5 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
                  />
                  <button
                    type="submit"
                    disabled={verifyingTx}
                    className="px-4 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium shrink-0 transition-colors"
                  >
                    {verifyingTx ? "Querying Tatum RPC…" : "Verify Receipt via Tatum RPC"}
                  </button>
                </div>

                {trade.sampleVerifiableTxHash && !trade.verification?.verified && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.07] font-mono-tabular text-[11px]">
                    <span className="text-[#A6A39B]">
                      Verifiable Base Mainnet Tx:{" "}
                      <span className="text-[#F4F2ED]">
                        {trade.sampleVerifiableTxHash.slice(0, 22)}…
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTxHashInput(trade.sampleVerifiableTxHash)}
                      className="text-[#C5A46D] hover:text-[#D6B882]"
                    >
                      Populate Sample Hash
                    </button>
                  </div>
                )}
              </form>

              {trade.verification && (
                <div className="mt-4 border border-[#2E9B6E]/35 bg-[#090A0C] rounded-[3px] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#2E9B6E]/10 border-b border-[#2E9B6E]/25 flex items-center justify-between font-mono-tabular text-[11px]">
                    <span className="text-[#5CE0A8] font-medium">
                      RECEIPT CONFIRMED ON-CHAIN (STATUS 0x1)
                    </span>
                    <a
                      href={`${explorerBase}/tx/${trade.verification.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#A6A39B] hover:text-[#F4F2ED] inline-flex items-center gap-1"
                    >
                      <span>Block Explorer</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 font-mono-tabular text-[12px]">
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Block Height</dt>
                      <dd className="text-[#F4F2ED] mt-0.5 font-medium">
                        #{trade.verification.blockNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Confirmations</dt>
                      <dd className="text-[#5CE0A8] mt-0.5 font-medium">
                        {trade.verification.confirmations} Blocks
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Verified Value</dt>
                      <dd className="text-[#F4F2ED] mt-0.5 font-medium">
                        {trade.verification.valueEth} {trade.asset}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Gas Consumed</dt>
                      <dd className="text-[#A6A39B] mt-0.5">
                        {trade.verification.receipt?.gasUsed || "21000"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </section>

          {/* III. SETTLEMENT CONDITIONS & AUTHORIZATION */}
          <section className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] text-[#C5A46D]">SECTION III</span>
                <h2 className="text-[14px] font-medium text-[#F4F2ED]">
                  Settlement Conditions &amp; Release Authorization
                </h2>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#A6A39B]">
                {(trade.conditions || []).filter((c: any) => c.completed).length}/
                {(trade.conditions || []).length} Fulfilled
              </span>
            </div>

            <div className="divide-y divide-white/[0.07]">
              {(trade.conditions || []).map((cond: any, idx: number) => {
                const isOnChain = cond.type === "onchain_receipt";
                return (
                  <div key={cond.id} className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                            0{idx + 1}
                          </span>
                          <span className="text-[14px] font-medium text-[#F4F2ED]">
                            {cond.title}
                          </span>
                          <span
                            className={`status-pill ${
                              cond.completed
                                ? "status-pill-verified"
                                : isOnChain
                                ? "status-pill"
                                : "status-pill-brass"
                            }`}
                          >
                            {cond.completed
                              ? isOnChain
                                ? "Verified via Tatum RPC"
                                : "Attested & Hashed"
                              : isOnChain
                              ? "Requires Tatum RPC Receipt"
                              : "Off-Chain Attestation"}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#A6A39B] pl-6">{cond.description}</p>
                        {cond.completed && (
                          <div className="pl-6 font-mono-tabular text-[11px] text-[#5CE0A8]">
                            Fulfilled by {cond.completedBy?.slice(0, 14)}…{" "}
                            {cond.evidenceHash && `· SHA-256 ${cond.evidenceHash.slice(0, 12)}…`}
                          </div>
                        )}
                      </div>

                      {!cond.completed && !isOnChain && (
                        <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                          <input
                            type="text"
                            placeholder="Attestation reference or note…"
                            value={attestationNotes[cond.id] || ""}
                            onChange={(e) =>
                              setAttestationNotes({
                                ...attestationNotes,
                                [cond.id]: e.target.value,
                              })
                            }
                            className="px-3 py-1.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                          />
                          <button
                            type="button"
                            disabled={actionLoading === "complete_condition"}
                            onClick={() =>
                              runTradeAction(
                                {
                                  action: "complete_condition",
                                  conditionId: cond.id,
                                  actor: activeActor,
                                  attestationNote:
                                    attestationNotes[cond.id] ||
                                    `Attested by ${activeActor.slice(0, 8)}`,
                                },
                                `Clause "${cond.title}" attested and anchored to Walrus Memory.`
                              )
                            }
                            className="px-3 py-1.5 rounded-[3px] bg-[#13161C] hover:bg-[#C5A46D] text-[#F4F2ED] hover:text-[#090A0C] border border-white/[0.14] font-mono-tabular text-[11px] font-medium transition-colors"
                          >
                            Attest Clause
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Authorization Footer */}
            <div className="px-6 py-4 bg-[#0B0D10] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {isSellerActor &&
                  (trade.status === "Funded" || trade.status === "AwaitingConditions") &&
                  !trade.sellerFulfilled && (
                    <button
                      type="button"
                      disabled={actionLoading === "confirm_fulfillment"}
                      onClick={() =>
                        runTradeAction(
                          { action: "confirm_fulfillment", actor: activeActor },
                          "Seller confirmed fulfillment of deliverables."
                        )
                      }
                      className="px-4 py-2 rounded-[3px] bg-[#13161C] hover:bg-[#181C24] border border-white/[0.14] font-mono-tabular text-[12px] text-[#F4F2ED]"
                    >
                      Confirm Deliverable Fulfillment (Seller)
                    </button>
                  )}

                {isBuyerActor &&
                  trade.verification?.verified &&
                  (trade.conditions || []).every((c: any) => c.completed) &&
                  trade.status !== "Disputed" &&
                  trade.status !== "Completed" &&
                  trade.status !== "Refunded" && (
                    <button
                      type="button"
                      disabled={actionLoading === "approve_release"}
                      onClick={() =>
                        runTradeAction(
                          { action: "approve_release", actor: activeActor },
                          `Settlement authorized. ${trade.amount} ${trade.asset} released to Seller.`
                        )
                      }
                      className="px-5 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium transition-colors"
                    >
                      Authorize Settlement Release (Buyer)
                    </button>
                  )}

                {isBuyerActor &&
                  trade.verification?.verified &&
                  !(trade.conditions || []).every((c: any) => c.completed) &&
                  trade.status !== "Disputed" &&
                  trade.status !== "Completed" &&
                  trade.status !== "Refunded" && (
                    <span className="px-3.5 py-1.5 rounded-[3px] bg-[#0E1014] border border-white/[0.08] font-mono-tabular text-[11px] text-[#6E6C65]">
                      Release Locked · {(trade.conditions || []).filter((c: any) => !c.completed).length} Condition(s) Pending
                    </span>
                  )}

                {isSellerActor &&
                  trade.status !== "Disputed" &&
                  trade.status !== "Completed" &&
                  trade.status !== "Refunded" && (
                    <button
                      type="button"
                      disabled={actionLoading === "refund"}
                      onClick={() =>
                        runTradeAction(
                          { action: "refund", actor: activeActor },
                          `Voluntary refund executed. ${trade.amount} ${trade.asset} returned to Buyer.`
                        )
                      }
                      className="px-3.5 py-2 rounded-[3px] bg-[#090A0C] hover:bg-[#13161C] border border-white/[0.1] font-mono-tabular text-[11px] text-[#A6A39B] hover:text-[#F4F2ED]"
                    >
                      Voluntary Refund to Buyer (Seller)
                    </button>
                  )}
              </div>

              {trade.status !== "Completed" &&
                trade.status !== "Refunded" &&
                (isBuyerActor || isSellerActor) && (
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(!showDisputeForm)}
                    className="px-3.5 py-1.5 rounded-[3px] border border-[#C94A4A]/40 text-[#F28B8B] hover:bg-[#C94A4A]/10 font-mono-tabular text-[11px] transition-colors"
                  >
                    {showDisputeForm ? "Cancel Dispute" : "Lodge Dispute / Evidence"}
                  </button>
                )}
            </div>

            {/* Dispute Filing Drawer */}
            {showDisputeForm && (
              <div className="p-6 bg-[#090A0C] border-t border-[#C94A4A]/40 space-y-3">
                <div className="font-mono-tabular text-[11px] text-[#F28B8B] uppercase">
                  Lodge Dispute &amp; Anchor SHA-256 Evidence to Walrus Memory
                </div>
                <input
                  type="text"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Specify ground for dispute…"
                  className="w-full px-3.5 py-2 rounded-[3px] bg-[#0E1014] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                />
                <textarea
                  rows={2}
                  value={disputeEvidenceText}
                  onChange={(e) => setDisputeEvidenceText(e.target.value)}
                  placeholder="Supporting logs, checksums, or delivery tracking references (hashed via SHA-256)…"
                  className="w-full px-3.5 py-2 rounded-[3px] bg-[#0E1014] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                />
                <button
                  type="button"
                  disabled={actionLoading === "raise_dispute" || !disputeReason.trim()}
                  onClick={async () => {
                    await runTradeAction(
                      {
                        action: "raise_dispute",
                        actor: activeActor,
                        reason: disputeReason,
                        evidenceContent: disputeEvidenceText,
                      },
                      "Dispute recorded and SHA-256 evidence hash anchored to Walrus Memory."
                    );
                    setShowDisputeForm(false);
                    setDisputeReason("");
                    setDisputeEvidenceText("");
                  }}
                  className="px-4 py-2 rounded-[3px] bg-[#C94A4A] text-[#F4F2ED] font-mono-tabular text-[12px] font-medium"
                >
                  Freeze Agreement &amp; Record Evidence
                </button>
              </div>
            )}

            {/* Neutral Arbiter Ruling Panel */}
            {trade.status === "Disputed" && (
              <div className="p-6 bg-[#090A0C] border-t border-[#C5A46D]/40 space-y-4">
                <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                  <span className="text-[#C5A46D] uppercase">
                    Neutral Arbiter Ruling Panel
                  </span>
                  <span className="text-[#6E6C65]">
                    Designated Arbiter: {trade.arbiter.slice(0, 10)}…
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block font-mono-tabular text-[11px] text-[#A6A39B] mb-1">
                      Buyer Allocation: {arbiterBuyerSplitPct}% · Seller Allocation:{" "}
                      {100 - arbiterBuyerSplitPct}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={arbiterBuyerSplitPct}
                      onChange={(e) => setArbiterBuyerSplitPct(Number(e.target.value))}
                      className="w-full accent-[#C5A46D]"
                    />
                  </div>
                  <input
                    type="text"
                    value={arbiterResolutionNote}
                    onChange={(e) => setArbiterResolutionNote(e.target.value)}
                    placeholder="Written arbitral ruling…"
                    className="px-3.5 py-2 rounded-[3px] bg-[#0E1014] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                  />
                </div>
                <button
                  type="button"
                  disabled={!isArbiterActor || actionLoading === "resolve_dispute"}
                  onClick={() =>
                    runTradeAction(
                      {
                        action: "resolve_dispute",
                        actor: activeActor,
                        buyerSplitBps: arbiterBuyerSplitPct * 100,
                        resolutionNote:
                          arbiterResolutionNote ||
                          `Arbitral ruling: ${arbiterBuyerSplitPct}% Buyer / ${
                            100 - arbiterBuyerSplitPct
                          }% Seller`,
                      },
                      "Dispute resolved by Neutral Arbiter and anchored to Walrus Memory."
                    )
                  }
                  className="px-4 py-2 rounded-[3px] bg-[#C5A46D] disabled:opacity-40 text-[#090A0C] font-mono-tabular text-[12px] font-medium"
                >
                  {isArbiterActor
                    ? "Issue Binding Arbitral Ruling"
                    : "Select 'View as: Arbiter' Above to Execute Ruling"}
                </button>
              </div>
            )}
          </section>

          {/* IV. CHRONOLOGICAL AUDIT RECORD */}
          <section className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] text-[#C5A46D]">SECTION IV</span>
                <h2 className="text-[14px] font-medium text-[#F4F2ED]">
                  Chronological Settlement &amp; Memory Audit Log
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/memory?tradeRef=${encodeURIComponent(trade.reference)}&view=timeline`}
                  className="font-mono-tabular text-[11px] text-[#C5A46D] hover:text-[#D6B882] inline-flex items-center gap-1"
                >
                  <span>Open in Memory Box</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
                <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                  {(trade.activity || []).length} Entries
                </span>
              </div>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {(trade.activity || [])
                .slice()
                .reverse()
                .map((act: any) => (
                  <div
                    key={act.id}
                    className="px-6 py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline text-[12px]"
                  >
                    <div className="sm:col-span-2 font-mono-tabular text-[11px] text-[#6E6C65]">
                      {new Date(act.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                    <div className="sm:col-span-3 font-mono-tabular text-[11px] text-[#C5A46D] truncate">
                      {act.type}
                    </div>
                    <div className="sm:col-span-7 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[#F4F2ED] font-medium">{act.title}</span>
                        {act.walrusMemoryId && (
                          <Link
                            href={`/memory?tradeRef=${encodeURIComponent(
                              trade.reference
                            )}&recordId=${encodeURIComponent(act.walrusMemoryId)}`}
                            className="font-mono-tabular text-[10px] text-[#C5A46D] hover:text-[#F4F2ED] px-1.5 py-0.5 rounded-[2px] bg-[#090A0C] border border-white/[0.08]"
                          >
                            {act.walrusMemoryId}
                          </Link>
                        )}
                      </div>
                      <p className="text-[#A6A39B] leading-relaxed">{act.description}</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>

        {/* Right 4 Columns: Trade Memory Box & Grounded Context Assistant */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">
          {/* TRADE MEMORY BOX PANEL */}
          <div className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-5 py-3.5 bg-[#11141B] border-b border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
                  Accord Memory Box
                </span>
                <span className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[#090A0C] border border-white/[0.08] text-[#F4F2ED]">
                  {tradeMemories.length} Records
                </span>
              </div>
              <Link
                href={`/memory?tradeRef=${encodeURIComponent(trade.reference)}`}
                className="font-mono-tabular text-[10px] text-[#C5A46D] hover:text-[#D6B882] inline-flex items-center gap-1"
              >
                <span>Full Archive</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-4 space-y-3">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1">
                {[
                  "ALL",
                  "Agreements",
                  "Transactions",
                  "Fulfilment",
                  "Disputes",
                  "Settlement",
                  "Trade History",
                ].map((cat) => {
                  const count =
                    cat === "ALL"
                      ? tradeMemories.length
                      : tradeMemories.filter((m: any) => m.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedMemoryCategory(cat)}
                      className={`px-2 py-1 rounded-[2px] font-mono-tabular text-[10px] transition-colors ${
                        selectedMemoryCategory === cat
                          ? "bg-[#C5A46D] text-[#090A0C] font-medium"
                          : "bg-[#090A0C] text-[#A6A39B] hover:text-[#F4F2ED] border border-white/[0.07]"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Memory Records List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.06] border border-white/[0.07] rounded-[3px] bg-[#090A0C]">
                {tradeMemories
                  .filter(
                    (m: any) =>
                      selectedMemoryCategory === "ALL" || m.category === selectedMemoryCategory
                  )
                  .slice(0, 12)
                  .map((mem: any) => (
                    <Link
                      key={mem.id}
                      href={`/memory?tradeRef=${encodeURIComponent(
                        trade.reference
                      )}&recordId=${encodeURIComponent(mem.id)}`}
                      className="block p-3 hover:bg-[#13161C]/70 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 font-mono-tabular text-[10px]">
                        <span className="text-[#C5A46D] uppercase">{mem.category}</span>
                        <span
                          className={
                            mem.verifiedOnWalrus
                              ? "text-[#5CE0A8]"
                              : mem.persistenceStatus === "write_failed"
                              ? "text-[#F28B8B]"
                              : "text-[#C88A32]"
                          }
                        >
                          {mem.verifiedOnWalrus
                            ? "Confirmed Mainnet"
                            : mem.persistenceStatus === "write_submitted"
                            ? "Submitted"
                            : "Pending (No Keys)"}
                        </span>
                      </div>
                      <div className="text-[12px] font-medium text-[#F4F2ED] leading-snug">
                        {mem.title || mem.type}
                      </div>
                      <div className="flex items-center justify-between font-mono-tabular text-[10px] text-[#6E6C65]">
                        <span>{mem.id}</span>
                        <span>
                          {new Date(mem.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  ))}

                {tradeMemories.filter(
                  (m: any) =>
                    selectedMemoryCategory === "ALL" || m.category === selectedMemoryCategory
                ).length === 0 && (
                  <div className="p-4 text-center font-mono-tabular text-[11px] text-[#6E6C65]">
                    No memory records in {selectedMemoryCategory}.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-5 py-3.5 bg-[#11141B] border-b border-white/[0.07] flex items-center justify-between">
              <span className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[#C5A46D]">
                Context &amp; Memory Assistant
              </span>
              <span className="font-mono-tabular text-[10px] text-[#6E6C65]">Read-Only</span>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[#A6A39B] leading-relaxed">
                Grounded in server-side agreement records, live Tatum RPC receipts, and persistent
                Walrus Memory. Distinguishes verified on-chain facts from participant claims.
              </p>

              {/* Practical Questions */}
              <div className="space-y-1.5">
                <div className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
                  Inquiries
                </div>
                <div className="flex flex-col gap-1">
                  {PRACTICAL_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => askContextAssistant(q)}
                      className="text-left px-3 py-2 rounded-[3px] bg-[#090A0C] hover:bg-[#13161C] border border-white/[0.07] hover:border-white/[0.16] text-[12px] text-[#D8D5CE] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Question Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  askContextAssistant(assistantQuestion);
                }}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="text"
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  placeholder="Ask about terms, deposit, or history…"
                  className="flex-1 px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                />
                <button
                  type="submit"
                  disabled={askingAssistant}
                  className="px-3 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] transition-colors"
                  title="Submit question"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              {askingAssistant && (
                <div className="p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.07] font-mono-tabular text-[11px] text-[#6E6C65]">
                  Querying Tatum RPC &amp; recalling Walrus Memory…
                </div>
              )}

              {assistantResponse && !askingAssistant && (
                <div className="p-4 rounded-[3px] bg-[#090A0C] border border-white/[0.1] space-y-3.5 text-[12px]">
                  {assistantResponse.question && (
                    <div className="pb-2 border-b border-white/[0.06]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular text-[10px] uppercase tracking-[0.08em] text-[#6E6C65]">
                          Inquiry
                        </span>
                        <span className="font-mono-tabular text-[10px] text-[#5CE0A8]">
                          {assistantResponse.engineMode === "gemini_grounded"
                            ? "Gemini 3.8 Grounded"
                            : "Grounded Ledger Engine"}
                        </span>
                      </div>
                      <div className="text-[12px] font-medium text-[#C5A46D] mt-0.5">
                        {assistantResponse.question}
                      </div>
                    </div>
                  )}
                  <p className="text-[#F4F2ED] leading-relaxed whitespace-pre-line">
                    {assistantResponse.answer}
                  </p>

                  {assistantResponse.verifiedFacts?.length > 0 && (
                    <div className="pt-2.5 border-t border-white/[0.07] space-y-1">
                      <div className="font-mono-tabular text-[10px] uppercase tracking-[0.06em] text-[#5CE0A8]">
                        Verified Facts (Tatum RPC &amp; Signed Record)
                      </div>
                      {assistantResponse.verifiedFacts.map((f: string, idx: number) => (
                        <div key={idx} className="text-[11px] text-[#A6A39B] leading-snug">
                          • {f}
                        </div>
                      ))}
                    </div>
                  )}

                  {assistantResponse.userClaims?.length > 0 && (
                    <div className="pt-2.5 border-t border-white/[0.07] space-y-1">
                      <div className="font-mono-tabular text-[10px] uppercase tracking-[0.06em] text-[#C5A46D]">
                        Participant Attestations &amp; Claims
                      </div>
                      {assistantResponse.userClaims.map((c: string, idx: number) => (
                        <div key={idx} className="text-[11px] text-[#A6A39B] leading-snug">
                          • {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
