"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { keccak256, parseEther, stringToHex, zeroHash } from "viem";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Check,
  Send,
} from "lucide-react";
import type {
  SettlementCondition,
  TermsVersion,
  Trade,
  TradeActivity,
} from "@/lib/trades/store";
import type { VerificationResult } from "@/lib/tatum/client";
import type { WalrusTradeMemory } from "@/lib/walrus/memory";
import { ACCORD_ESCROW_ABI } from "@/lib/contracts/AccordEscrow";
import {
  createTradeActionTypedData,
  getAuthorizedPayload,
  getTradeActionChainId,
} from "@/lib/trades/action-auth";
import {
  getEvmEscrowNetwork,
  isEvmEscrowNetwork,
} from "@/lib/contracts/escrow-networks";

interface TradeRoomResponse {
  success?: boolean;
  trade?: Trade;
  memories?: WalrusTradeMemory[];
  error?: string;
}

interface VerificationResponse extends TradeRoomResponse {
  verified?: boolean;
  message?: string;
  verification?: VerificationResult;
}

interface AssistantResponse {
  question?: string;
  answer: string;
  engineMode?: string;
  verifiedFacts?: string[];
  userClaims?: string[];
}

type TradeActionPayload = Record<string, unknown> & { action: string };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

const EXPLORER_MAP: Record<string, string> = {
  "base-mainnet": "https://basescan.org",
  "base-sepolia": "https://sepolia.basescan.org",
  "arbitrum-one": "https://arbiscan.io",
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

const STATUS_LABELS: Record<string, string> = {
  AwaitingAcceptance: "Waiting for agreement",
  AwaitingDeposit: "Waiting for payment",
  Funded: "Payment check passed",
  AwaitingConditions: "Waiting for requirements",
  ReadyForRelease: "Ready to finish",
  Completed: "Trade marked complete",
  Disputed: "Disagreement raised",
  Refunded: "Refund recorded",
  Expired: "Expired",
};

export default function SharedTradeRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address: connectedWallet } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loadedTradeId, setLoadedTradeId] = useState<string | null>(null);
  const escrowNetwork = trade ? getEvmEscrowNetwork(trade.network) : undefined;
  const escrowChainId = escrowNetwork?.chainId;
  const publicClient = usePublicClient({ chainId: escrowChainId });
  const loading = loadedTradeId !== id;
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
  const [assistantResponse, setAssistantResponse] = useState<AssistantResponse | null>(null);
  const [askingAssistant, setAskingAssistant] = useState(false);

  // Trade Memory Box records
  const [tradeMemories, setTradeMemories] = useState<WalrusTradeMemory[]>([]);
  const [selectedMemoryCategory, setSelectedMemoryCategory] = useState<string>("ALL");
  const [escrowActionLoading, setEscrowActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadTradeRoom = async () => {
      try {
        const res = await fetch(`/api/trades/${encodeURIComponent(id)}`);
        const data = (await res.json()) as TradeRoomResponse;
        const loadedTrade = data.trade;
        if (active && data.success && loadedTrade) {
          setTrade(loadedTrade);
          if (Array.isArray(data.memories)) {
            setTradeMemories(data.memories);
          }
          setAmendedTermsText(loadedTrade.agreedTerms || "");
          const defaultTxHash = loadedTrade.txHash;
          if (defaultTxHash) {
            setTxHashInput((current) => current || defaultTxHash);
          }
          setActiveActor((current) => {
            if (current) return current;
            if (
              connectedWallet &&
              (connectedWallet.toLowerCase() === loadedTrade.buyer.toLowerCase() ||
                connectedWallet.toLowerCase() === loadedTrade.seller.toLowerCase() ||
                connectedWallet.toLowerCase() === loadedTrade.arbiter.toLowerCase())
            ) {
              return connectedWallet.toLowerCase();
            } else if (!loadedTrade.sellerAccepted) {
              return loadedTrade.seller;
            }
            return loadedTrade.buyer;
          });
        }
      } catch (err: unknown) {
        if (active) console.error("Error loading trade room:", err);
      } finally {
        if (active) setLoadedTradeId(id);
      }
    };
    void loadTradeRoom();
    return () => {
      active = false;
    };
  }, [id, connectedWallet]);

  const escrowAddress =
    trade &&
    escrowNetwork &&
    trade.asset === "ETH" &&
    trade.escrowAddress &&
    /^0x[a-fA-F0-9]{40}$/.test(trade.escrowAddress)
      ? (trade.escrowAddress as `0x${string}`)
      : undefined;
  const {
    data: onChainTradeId,
    isLoading: isLoadingOnChainTradeId,
    refetch: refetchTradeId,
  } = useReadContract({
    address: escrowAddress,
    abi: ACCORD_ESCROW_ABI,
    functionName: "tradeRefToId",
    args: trade ? [trade.reference] : undefined,
    chainId: escrowChainId,
    query: { enabled: Boolean(escrowAddress && trade) },
  });
  const { data: escrowVersion, isPending: isLoadingEscrowVersion } = useReadContract({
    address: escrowAddress,
    abi: ACCORD_ESCROW_ABI,
    functionName: "version",
    chainId: escrowChainId,
    query: { enabled: Boolean(escrowAddress) },
  });
  const isSupportedEscrow = escrowVersion === BigInt(2);
  const hasOnChainTrade = Boolean(onChainTradeId && onChainTradeId !== zeroHash);
  const { data: onChainTrade, refetch: refetchOnChainTrade } = useReadContract({
    address: escrowAddress,
    abi: ACCORD_ESCROW_ABI,
    functionName: "getTrade",
    args: hasOnChainTrade && onChainTradeId ? [onChainTradeId] : undefined,
    chainId: escrowChainId,
    query: { enabled: Boolean(escrowAddress && hasOnChainTrade && onChainTradeId) },
  });
  const chainTradeState = onChainTrade?.state;

  const runTradeAction = async (payload: TradeActionPayload, successNotice: string) => {
    if (!trade) return;
    const currentTrade = trade;
    setFeedback(null);
    const actionActor =
      typeof payload.actor === "string" ? payload.actor.toLowerCase() : "";
    if (
      currentTrade.settlementMode === "escrow" &&
      (!connectedWallet || connectedWallet.toLowerCase() !== actionActor)
    ) {
      setFeedback({
        type: "error",
        message: "Connect the wallet for the selected participant before recording this action.",
      });
      return;
    }
    if (
      !isEvmEscrowNetwork(currentTrade.network) ||
      !connectedWallet ||
      connectedWallet.toLowerCase() !== actionActor
    ) {
      setFeedback({
        type: "error",
        message: `Connect the participant wallet on ${escrowNetwork?.name || "the trade network"} before signing this action.`,
      });
      return;
    }

    const chainId = getTradeActionChainId(currentTrade.network);
    const expectedUpdatedAt = Date.parse(currentTrade.updatedAt);
    if (!chainId || !Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt <= 0) {
      setFeedback({ type: "error", message: "This trade cannot be safely authorized." });
      return;
    }

    setActionLoading(payload.action);
    try {
      await switchChainAsync({ chainId });
      const issuedAt = BigInt(Math.floor(Date.now() / 1000));
      const expiresAt = issuedAt + BigInt(300);
      const unsignedPayload = getAuthorizedPayload(payload);
      const typedData = createTradeActionTypedData({
        origin: window.location.origin,
        tradeReference: currentTrade.reference,
        payload: unsignedPayload,
        expectedUpdatedAt: BigInt(expectedUpdatedAt),
        issuedAt,
        expiresAt,
        chainId,
      });
      const signature = await signTypedDataAsync(typedData);
      const res = await fetch(`/api/trades/${encodeURIComponent(currentTrade.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          actor: connectedWallet,
          authorization: {
            signature,
            issuedAt: issuedAt.toString(),
            expiresAt: expiresAt.toString(),
            expectedUpdatedAt: expectedUpdatedAt.toString(),
          },
        }),
      });
      const data = (await res.json()) as TradeRoomResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Operation failed");
      }
      if (!data.trade) throw new Error("The updated trade was not returned.");
      setTrade(data.trade);
      if (Array.isArray(data.memories)) {
        setTradeMemories(data.memories);
      }
      setFeedback({ type: "success", message: successNotice });
    } catch (err: unknown) {
      setFeedback({ type: "error", message: getErrorMessage(err) });
    } finally {
      setActionLoading(null);
    }
  };

  const submitEscrowTransaction = async (
    action: string,
    functionName:
      | "createTrade"
      | "deposit"
      | "confirmFulfillment"
      | "approveRelease"
      | "refund"
      | "claimExpiredRefund",
    args: readonly unknown[],
    value?: bigint
  ) => {
    if (!trade || !escrowAddress || !connectedWallet) return;
    setFeedback(null);
    if (!isSupportedEscrow) {
      setFeedback({
        type: "error",
        message: "This escrow contract is outdated. Deploy and configure version 2 before submitting escrow actions.",
      });
      return;
    }
    setEscrowActionLoading(action);
    try {
      if (!connectedWallet) throw new Error("Connect the participant wallet first.");
      if (!publicClient || !escrowChainId || !escrowNetwork) {
        throw new Error("The escrow network RPC is unavailable.");
      }
      await switchChainAsync({ chainId: escrowChainId });
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ACCORD_ESCROW_ABI,
        functionName,
        args,
        account: connectedWallet,
        chainId: escrowChainId,
        ...(value === undefined ? {} : { value }),
      } as Parameters<typeof writeContractAsync>[0]);
      setFeedback({
        type: "success",
        message: `Transaction submitted: ${hash}. Waiting for ${escrowNetwork.name} confirmation…`,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error(`The escrow transaction reverted on ${escrowNetwork.name}.`);
      }
      await refetchTradeId();
      await refetchOnChainTrade();
      setFeedback({
        type: "success",
        message: `Escrow transaction confirmed on ${escrowNetwork.name}: ${hash}`,
      });
      return hash;
    } catch (error) {
      setFeedback({ type: "error", message: getErrorMessage(error) });
      return undefined;
    } finally {
      setEscrowActionLoading(null);
    }
  };

  const handleCreateOnChainTrade = async () => {
    if (!trade || !escrowAddress || !connectedWallet) return;
    if (connectedWallet.toLowerCase() !== trade.buyer.toLowerCase()) {
      setFeedback({ type: "error", message: "Connect the designated buyer wallet to create escrow." });
      return;
    }
    if (!trade.buyerAccepted || !trade.sellerAccepted) {
      setFeedback({ type: "error", message: "Both participants must accept the terms before escrow is created." });
      return;
    }
    if (trade.status !== "AwaitingDeposit") {
      setFeedback({ type: "error", message: "This agreement is not ready for escrow creation." });
      return;
    }
    if (hasOnChainTrade) {
      setFeedback({ type: "error", message: "An on-chain escrow already exists for this trade reference." });
      return;
    }

    await submitEscrowTransaction(
      "createTrade",
      "createTrade",
      [
        trade.reference,
        trade.seller as `0x${string}`,
        trade.arbiter as `0x${string}`,
        parseEther(trade.amount),
        BigInt(Math.floor(trade.expirationTimestamp / 1000)),
        trade.termsHash as `0x${string}`,
      ]
    );
  };

  const handleEscrowDeposit = async () => {
    if (!trade || !onChainTradeId || !connectedWallet) return;
    if (connectedWallet.toLowerCase() !== trade.buyer.toLowerCase()) {
      setFeedback({ type: "error", message: "Only the designated buyer wallet can deposit into this escrow." });
      return;
    }
    if (chainTradeState !== 2) {
      setFeedback({ type: "error", message: "The on-chain escrow is not awaiting a deposit." });
      return;
    }
    await submitEscrowTransaction("deposit", "deposit", [onChainTradeId], parseEther(trade.amount));
  };

  const handleEscrowFulfillment = async () => {
    if (!trade || !onChainTradeId || !connectedWallet) return;
    if (connectedWallet.toLowerCase() !== trade.seller.toLowerCase()) {
      setFeedback({ type: "error", message: "Connect the designated seller wallet to confirm fulfillment." });
      return;
    }
    const fulfillmentProofHash = keccak256(
      stringToHex(
        JSON.stringify({
          termsHash: trade.termsHash,
          conditions: trade.conditions.map((condition) => [
            condition.id,
            condition.completed,
            condition.completedAt || "",
            condition.completedBy || "",
            condition.evidenceHash || "",
            condition.txHash || "",
          ]),
        })
      )
    );
    const hash = await submitEscrowTransaction(
      "confirmFulfillment",
      "confirmFulfillment",
      [onChainTradeId, fulfillmentProofHash]
    );
    if (hash) {
      await runTradeAction(
        { action: "confirm_fulfillment", actor: connectedWallet, txHash: hash },
        "Seller fulfillment was confirmed on-chain and recorded in Accord."
      );
    }
  };

  const handleEscrowRelease = async () => {
    if (!trade || !onChainTradeId || !connectedWallet) return;
    if (connectedWallet.toLowerCase() !== trade.buyer.toLowerCase()) {
      setFeedback({ type: "error", message: "Connect the designated buyer wallet to release escrow." });
      return;
    }
    const hash = await submitEscrowTransaction(
      "approveRelease",
      "approveRelease",
      [onChainTradeId]
    );
    if (hash) {
      await runTradeAction(
        { action: "approve_release", actor: connectedWallet, txHash: hash },
        `Escrow release confirmed on ${escrowNetwork?.name || "the network"}.`
      );
    }
  };

  const handleEscrowRefund = async () => {
    if (!trade || !onChainTradeId || !connectedWallet) return;
    if (connectedWallet.toLowerCase() !== trade.seller.toLowerCase()) {
      setFeedback({ type: "error", message: "Connect the designated seller wallet to request a refund." });
      return;
    }
    const hash = await submitEscrowTransaction("refund", "refund", [onChainTradeId]);
    if (hash) {
      await runTradeAction(
        { action: "refund", actor: connectedWallet, txHash: hash },
        `Seller refund confirmed on ${escrowNetwork?.name || "the network"}.`
      );
    }
  };

  const handleVerifyDepositWithTatum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade || !txHashInput.trim()) return;
    if (
      !connectedWallet ||
      connectedWallet.toLowerCase() !== trade.buyer.toLowerCase() ||
      !isEvmEscrowNetwork(trade.network) ||
      trade.asset !== "ETH"
    ) {
      setFeedback({ type: "error", message: "Connect the designated buyer wallet on the trade network to verify the escrow deposit." });
      return;
    }
    const currentTrade = trade;
    setFeedback(null);
    setVerifyingTx(true);

    try {
      const chainId = getTradeActionChainId(currentTrade.network);
      const expectedUpdatedAt = Date.parse(currentTrade.updatedAt);
      if (!chainId || !Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt <= 0) {
        throw new Error("This trade cannot be safely authorized.");
      }
      await switchChainAsync({ chainId });
      const issuedAt = BigInt(Math.floor(Date.now() / 1000));
      const expiresAt = issuedAt + BigInt(300);
      const payload = {
        action: "verify_deposit",
        txHash: txHashInput.trim(),
        network: currentTrade.network,
      };
      const typedData = createTradeActionTypedData({
        origin: window.location.origin,
        tradeReference: currentTrade.reference,
        payload,
        expectedUpdatedAt: BigInt(expectedUpdatedAt),
        issuedAt,
        expiresAt,
        chainId,
      });
      const signature = await signTypedDataAsync(typedData);
      const res = await fetch(`/api/trades/${encodeURIComponent(currentTrade.id)}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          actor: connectedWallet,
          authorization: {
            signature,
            issuedAt: issuedAt.toString(),
            expiresAt: expiresAt.toString(),
            expectedUpdatedAt: expectedUpdatedAt.toString(),
          },
        }),
      });
      const data = (await res.json()) as VerificationResponse;
      if (data.trade) {
        setTrade(data.trade);
      }
      if (Array.isArray(data.memories)) {
        setTradeMemories(data.memories);
      }
      if (!res.ok || !data.verified || !data.verification) {
        throw new Error(
          data.message || data.error || "Tatum RPC could not verify this transaction receipt."
        );
      }
      setFeedback({
        type: "success",
        message: `Verified via Tatum RPC: Block #${data.verification.blockNumber} (${data.verification.confirmations} confirmations) on ${currentTrade.network}.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: "error", message: getErrorMessage(err) });
    } finally {
      setVerifyingTx(false);
    }
  };

  const askContextAssistant = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || !trade) return;
    const currentTrade = trade;
    setAskingAssistant(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          tradeId: currentTrade.id,
          tradeRef: currentTrade.reference,
          currentUser: activeActor || currentTrade.buyer,
          txHash: currentTrade.txHash || undefined,
          clientTradeSnapshot: currentTrade,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        question?: string;
        answer?: string;
        engineMode?: string;
        verifiedFacts?: string[];
        userClaims?: string[];
        error?: string;
      };
      if (data.success && typeof data.answer === "string") {
        setAssistantResponse({
          ...data,
          answer: data.answer,
          question: data.question || trimmed,
        });
        setAssistantQuestion("");
      } else {
        setAssistantResponse({
          question: trimmed,
          answer: `Unable to process inquiry: ${data.error || "Unknown error"}`,
          verifiedFacts: [],
          userClaims: [],
        });
      }
    } catch (err: unknown) {
      setAssistantResponse({
        question: trimmed,
        answer: `Assistant connection error: ${getErrorMessage(err)}`,
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
          ? `The seller should review and accept version ${latestVersion} of the terms.`
          : `The buyer should review and accept version ${latestVersion} of the terms.`;
      case "AwaitingDeposit":
        return "The buyer can submit a transaction ID for a payment check. Accord does not execute payment transactions or hold funds.";
      case "Funded":
      case "AwaitingConditions":
        return `Complete the remaining trade requirements (${
          trade.conditions.filter((condition: SettlementCondition) => !condition.completed).length
        } left).`;
      case "ReadyForRelease":
        return "The requirements are complete. The buyer can review the trade and take the next action shown below.";
      case "Disputed":
        return "A disagreement has been recorded. Follow the resolution steps shown in this trade room.";
      case "Completed":
        return "Accord has marked this trade complete. This status update does not send or release funds.";
      case "Refunded":
        return "A refund outcome has been recorded in Accord. This status does not confirm that funds were returned.";
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
            title="Back to trades"
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
                {STATUS_LABELS[trade.status] || trade.status}
              </span>
              <span className="status-pill">
                {trade.settlementMode === "escrow"
                  ? "Escrow contract available · wallet approval required"
                  : "Direct payment · not sent by Accord"}
              </span>
            </div>
            <h1 className="font-editorial text-[26px] sm:text-[32px] leading-tight text-[#F4F2ED] mt-1">
              {trade.amount} {trade.asset} trade
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
            <span className="px-2 text-[#6E6C65] hidden sm:inline">Preview role:</span>
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

      <div
        role="note"
        className="rounded-[3px] border border-[#C88A32]/35 bg-[#C88A32]/[0.07] px-4 py-3 text-[12px] leading-relaxed text-[#DEC392]"
      >
        {escrowNetwork?.testnet
          ? "Testnet only. Escrow controls submit wallet-approved test transactions. Agreement acceptance, delivery conditions, and dispute notes remain app records; never use testnet for real funds."
          : escrowNetwork
            ? "Mainnet uses real funds. This prototype has not had an independent security audit. Do not deposit funds unless the deployment has been independently audited and approved."
            : "This network does not have an enabled Accord escrow implementation."}
      </div>

      {/* Executive Summary Ledger Strip (4 Columns) */}
      <div className="surface-panel rounded-[4px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07]">
        <div className="p-4 sm:p-5">
          <div className="text-[10px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
            Trade amount &amp; network
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
            Agreement status · Version {latestVersion}
          </div>
          <div className="mt-1.5 space-y-1 font-mono-tabular text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[#A6A39B]">Buyer ({trade.buyer.slice(0, 6)}…)</span>
              <span className={trade.buyerAccepted ? "text-[#5CE0A8]" : "text-[#C88A32]"}>
                {trade.buyerAccepted ? "Accepted" : "Waiting"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#A6A39B]">Seller ({trade.seller.slice(0, 6)}…)</span>
              <span className={trade.sellerAccepted ? "text-[#5CE0A8]" : "text-[#C88A32]"}>
                {trade.sellerAccepted ? "Accepted" : "Waiting"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-[10px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
            Payment check
          </div>
          {trade.verification?.verified ? (
            <div className="mt-1.5 space-y-0.5 font-mono-tabular">
              <div className="text-[13px] text-[#5CE0A8] font-medium">
                Payment check passed
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
                No successful payment check yet
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
                      ? "Saving acceptance…"
                      : `Accept Version ${latestVersion}`}
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
                    {trade.termsVersions.map((ver: TermsVersion) => (
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

          {isEvmEscrowNetwork(trade.network) && trade.asset === "ETH" && (
            <section className="surface-panel rounded-[4px] overflow-hidden">
              <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono-tabular text-[11px] text-[#C5A46D]">ON-CHAIN ESCROW</span>
                  <h2 className="text-[14px] font-medium text-[#F4F2ED]">
                    {escrowNetwork?.name || trade.network} ETH escrow
                  </h2>
                </div>
                <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                  Chain ID {escrowNetwork?.chainId || "unavailable"}
                </span>
              </div>
              <div className="p-6 space-y-4">
                {escrowAddress ? (
                  <>
                    <p className="break-all font-mono-tabular text-[11px] text-[#A6A39B]">
                      Contract: {escrowAddress}
                    </p>
                    {isLoadingEscrowVersion ? (
                      <p className="text-[12px] text-[#A6A39B]">Checking escrow contract version…</p>
                    ) : !isSupportedEscrow ? (
                      <p className="text-[12px] text-[#DEC392]">
                        This deployed contract is outdated and its release rules are not supported. Configure a newly deployed Accord escrow version 2 contract before using on-chain actions.
                      </p>
                    ) : isLoadingOnChainTradeId ? (
                      <p className="text-[12px] text-[#A6A39B]">
                        Checking this trade on {escrowNetwork?.name || trade.network}…
                      </p>
                    ) : hasOnChainTrade ? (
                      <p className="text-[12px] text-[#5CE0A8]">
                        On-chain trade found · contract state {chainTradeState ?? "loading"}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#A6A39B]">
                        No escrow record exists on-chain yet. Both parties must accept the terms before the buyer creates one.
                      </p>
                    )}

                    {isSupportedEscrow && !hasOnChainTrade &&
                      trade.status === "AwaitingDeposit" &&
                      trade.buyerAccepted &&
                      trade.sellerAccepted && (
                        <button
                          type="button"
                          disabled={
                            !connectedWallet ||
                            connectedWallet.toLowerCase() !== trade.buyer.toLowerCase() ||
                            isLoadingOnChainTradeId ||
                            escrowActionLoading !== null
                          }
                          onClick={() => void handleCreateOnChainTrade()}
                          className="rounded-[3px] bg-[#C5A46D] px-4 py-2 text-[12px] font-medium text-[#090A0C] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {escrowActionLoading === "createTrade"
                            ? "Confirm in wallet…"
                            : "Create escrow (buyer)"}
                        </button>
                      )}

                    {isSupportedEscrow && hasOnChainTrade && chainTradeState === 2 && (
                      <button
                        type="button"
                        disabled={
                          !connectedWallet ||
                          connectedWallet.toLowerCase() !== trade.buyer.toLowerCase() ||
                          escrowActionLoading !== null
                        }
                        onClick={() => void handleEscrowDeposit()}
                        className="rounded-[3px] bg-[#C5A46D] px-4 py-2 text-[12px] font-medium text-[#090A0C] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {escrowActionLoading === "deposit"
                          ? "Confirm deposit in wallet…"
                          : `Deposit ${trade.amount} ETH (buyer)`}
                      </button>
                    )}

                    {isSupportedEscrow && hasOnChainTrade && (chainTradeState === 3 || chainTradeState === 5) && (
                      <p className="text-[12px] text-[#DEC392]">
                        Escrow is funded on-chain. Use “Check payment” below with the deposit transaction hash to sync Accord’s trade record.
                      </p>
                    )}

                    {isSupportedEscrow && hasOnChainTrade &&
                      (chainTradeState === 3 || chainTradeState === 4) &&
                      connectedWallet?.toLowerCase() === trade.seller.toLowerCase() && (
                        <button
                          type="button"
                          disabled={escrowActionLoading !== null}
                          onClick={() => void handleEscrowFulfillment()}
                          className="rounded-[3px] border border-white/[0.14] bg-[#13161C] px-4 py-2 text-[12px] text-[#F4F2ED] disabled:opacity-50"
                        >
                          {escrowActionLoading === "confirmFulfillment"
                            ? "Confirm in wallet…"
                            : "Confirm fulfillment on-chain (seller)"}
                        </button>
                      )}

                    {isSupportedEscrow && hasOnChainTrade &&
                      chainTradeState === 5 &&
                      trade.verification?.verified &&
                      trade.conditions.every((condition) => condition.completed) &&
                      connectedWallet?.toLowerCase() === trade.buyer.toLowerCase() && (
                        <button
                          type="button"
                          disabled={escrowActionLoading !== null}
                          onClick={() => void handleEscrowRelease()}
                          className="rounded-[3px] bg-[#C5A46D] px-4 py-2 text-[12px] font-medium text-[#090A0C] disabled:opacity-50"
                        >
                          {escrowActionLoading === "approveRelease"
                            ? "Confirm release in wallet…"
                            : "Release escrow to seller (buyer)"}
                        </button>
                      )}

                    {isSupportedEscrow && hasOnChainTrade &&
                      (chainTradeState === 3 || chainTradeState === 5) &&
                      connectedWallet?.toLowerCase() === trade.seller.toLowerCase() && (
                        <button
                          type="button"
                          disabled={escrowActionLoading !== null}
                          onClick={() => void handleEscrowRefund()}
                          className="rounded-[3px] border border-white/[0.14] bg-[#13161C] px-4 py-2 text-[12px] text-[#F4F2ED] disabled:opacity-50"
                        >
                          {escrowActionLoading === "refund"
                            ? "Confirm refund in wallet…"
                            : "Refund escrow to buyer (seller)"}
                        </button>
                      )}
                  </>
                ) : (
                  <p className="text-[12px] text-[#DEC392]">
                    No {escrowNetwork?.name || trade.network} escrow address is configured for this trade. Deploy or configure
                    the contract before creating an on-chain escrow.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* II. PAYMENT CHECK */}
          <section className="surface-panel rounded-[4px] overflow-hidden">
            <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] text-[#C5A46D]">SECTION II</span>
                <h2 className="text-[14px] font-medium text-[#F4F2ED]">
                  Check payment
                </h2>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                Payment network: {trade.network}
              </span>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] text-[#A6A39B] leading-relaxed">
                If payment has been sent, enter its transaction ID. Accord checks the selected
                network, sender, recipient, amount, and network confirmations. A submitted ID does
                not mean the payment has been confirmed.
              </p>

              <form onSubmit={handleVerifyDepositWithTatum} className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    aria-label="Payment transaction ID"
                    placeholder="Paste the payment transaction ID"
                    className="flex-1 px-3.5 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
                  />
                  <button
                    type="submit"
                    disabled={verifyingTx}
                    className="px-4 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium shrink-0 transition-colors"
                  >
                    {verifyingTx ? "Checking payment…" : "Check payment"}
                  </button>
                </div>

              </form>

              {trade.verification && (
                <div className="mt-4 border border-[#2E9B6E]/35 bg-[#090A0C] rounded-[3px] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#2E9B6E]/10 border-b border-[#2E9B6E]/25 flex items-center justify-between font-mono-tabular text-[11px]">
                    <span className="text-[#5CE0A8] font-medium">
                      PAYMENT CONFIRMED
                    </span>
                    <a
                      href={`${explorerBase}/tx/${trade.verification.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#A6A39B] hover:text-[#F4F2ED] inline-flex items-center gap-1"
                    >
                      <span>View transaction</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 font-mono-tabular text-[12px]">
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Recorded at block</dt>
                      <dd className="text-[#F4F2ED] mt-0.5 font-medium">
                        #{trade.verification.blockNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Network confirmations</dt>
                      <dd className="text-[#5CE0A8] mt-0.5 font-medium">
                        {trade.verification.confirmations} Blocks
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Amount checked</dt>
                      <dd className="text-[#F4F2ED] mt-0.5 font-medium">
                        {trade.verification.valueEth} {trade.asset}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-[#6E6C65] uppercase">Network fee units</dt>
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
                  Trade requirements &amp; next actions
                </h2>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#A6A39B]">
                {(trade.conditions || []).filter((condition) => condition.completed).length}/
                {(trade.conditions || []).length} complete
              </span>
            </div>

            <div className="divide-y divide-white/[0.07]">
              {(trade.conditions || []).map((cond, idx: number) => {
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
                                ? "Payment check passed"
                                              : "Confirmed by a participant"
                              : isOnChain
                                            ? "Needs a payment check"
                                            : "Waiting for confirmation"}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#A6A39B] pl-6">{cond.description}</p>
                        {cond.completed && (
                          <div className="pl-6 font-mono-tabular text-[11px] text-[#5CE0A8]">
                            Marked complete by {cond.completedBy?.slice(0, 14)}…
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
                                `You marked "${cond.title}" complete. This is a participant confirmation.`
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
                      disabled={
                        actionLoading === "confirm_fulfillment" || escrowActionLoading !== null
                      }
                      onClick={() =>
                        trade.settlementMode === "escrow"
                          ? void handleEscrowFulfillment()
                          : void runTradeAction(
                              { action: "confirm_fulfillment", actor: activeActor },
                              "Seller marked the delivery complete. This is a participant confirmation."
                            )
                      }
                      className="px-4 py-2 rounded-[3px] bg-[#13161C] hover:bg-[#181C24] border border-white/[0.14] font-mono-tabular text-[12px] text-[#F4F2ED]"
                    >
                      Mark delivery complete (seller)
                    </button>
                  )}

                {isBuyerActor &&
                  trade.verification?.verified &&
                  (trade.conditions || []).every((condition) => condition.completed) &&
                  trade.status !== "Disputed" &&
                  trade.status !== "Completed" &&
                  trade.status !== "Refunded" && (
                    <button
                      type="button"
                      disabled={
                        actionLoading === "approve_release" || escrowActionLoading !== null
                      }
                      onClick={() =>
                        trade.settlementMode === "escrow"
                          ? void handleEscrowRelease()
                          : void runTradeAction(
                              { action: "approve_release", actor: activeActor },
                              "Trade marked complete in Accord. This action does not move funds."
                            )
                      }
                      className="px-5 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium transition-colors"
                    >
                      Mark trade complete (buyer)
                    </button>
                  )}

                {isBuyerActor &&
                  trade.verification?.verified &&
                  !(trade.conditions || []).every((condition) => condition.completed) &&
                  trade.status !== "Disputed" &&
                  trade.status !== "Completed" &&
                  trade.status !== "Refunded" && (
                    <span className="px-3.5 py-1.5 rounded-[3px] bg-[#0E1014] border border-white/[0.08] font-mono-tabular text-[11px] text-[#6E6C65]">
                      Waiting for {(trade.conditions || []).filter((condition) => !condition.completed).length} requirement(s)
                    </span>
                  )}

                {isSellerActor &&
                  trade.status !== "Disputed" &&
                  trade.status !== "Completed" &&
                  trade.status !== "Refunded" && (
                    <button
                      type="button"
                      disabled={actionLoading === "refund" || escrowActionLoading !== null}
                      onClick={() =>
                        trade.settlementMode === "escrow"
                          ? void handleEscrowRefund()
                          : void runTradeAction(
                              { action: "refund", actor: activeActor },
                              "Refund approval recorded in Accord. This action does not move funds."
                            )
                      }
                      className="px-3.5 py-2 rounded-[3px] bg-[#090A0C] hover:bg-[#13161C] border border-white/[0.1] font-mono-tabular text-[11px] text-[#A6A39B] hover:text-[#F4F2ED]"
                    >
                      Record refund approval (seller)
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
                    {showDisputeForm ? "Cancel" : "Raise a disagreement"}
                  </button>
                )}
            </div>

            {/* Dispute Filing Drawer */}
            {showDisputeForm && (
              <div className="p-6 bg-[#090A0C] border-t border-[#C94A4A]/40 space-y-3">
                <div className="font-mono-tabular text-[11px] text-[#F28B8B] uppercase">
                  Describe the disagreement
                </div>
                <input
                  type="text"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="What went wrong?"
                  className="w-full px-3.5 py-2 rounded-[3px] bg-[#0E1014] border border-white/[0.12] text-[12px] text-[#F4F2ED]"
                />
                <textarea
                  rows={2}
                  value={disputeEvidenceText}
                  onChange={(e) => setDisputeEvidenceText(e.target.value)}
                  placeholder="Add notes or references that may help explain what happened."
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
                      "Disagreement and supporting details recorded in Accord."
                    );
                    setShowDisputeForm(false);
                    setDisputeReason("");
                    setDisputeEvidenceText("");
                  }}
                  className="px-4 py-2 rounded-[3px] bg-[#C94A4A] text-[#F4F2ED] font-mono-tabular text-[12px] font-medium"
                >
                  Record disagreement
                </button>
              </div>
            )}

            {/* Neutral Arbiter Ruling Panel */}
            {trade.status === "Disputed" && (
              <div className="p-6 bg-[#090A0C] border-t border-[#C5A46D]/40 space-y-4">
                <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                  <span className="text-[#C5A46D] uppercase">
                    Record a proposed outcome
                  </span>
                  <span className="text-[#6E6C65]">
                    Dispute resolver: {trade.arbiter.slice(0, 10)}…
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block font-mono-tabular text-[11px] text-[#A6A39B] mb-1">
                      Proposed buyer share: {arbiterBuyerSplitPct}% · seller share:{" "}
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
                    placeholder="Explain the proposed outcome"
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
                      "The proposed dispute outcome was recorded in Accord. This action does not move funds."
                    )
                  }
                  className="px-4 py-2 rounded-[3px] bg-[#C5A46D] disabled:opacity-40 text-[#090A0C] font-mono-tabular text-[12px] font-medium"
                >
                  {isArbiterActor
                    ? "Record proposed outcome"
                    : "Select “View as: Arbiter” above to record an outcome"}
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
                .map((act: TradeActivity) => (
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
                      : tradeMemories.filter((memory) => memory.category === cat).length;
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
                    (memory) =>
                      selectedMemoryCategory === "ALL" || memory.category === selectedMemoryCategory
                  )
                  .slice(0, 12)
                  .map((mem) => (
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
                          {new Date(mem.metadata.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  ))}

                {tradeMemories.filter(
                  (memory) =>
                    selectedMemoryCategory === "ALL" || memory.category === selectedMemoryCategory
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

                  {assistantResponse.verifiedFacts &&
                    assistantResponse.verifiedFacts.length > 0 && (
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

                  {assistantResponse.userClaims && assistantResponse.userClaims.length > 0 && (
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
