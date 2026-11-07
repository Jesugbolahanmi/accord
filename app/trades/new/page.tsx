"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import type { WalrusTradeMemory } from "@/lib/walrus/memory";
import type { Trade } from "@/lib/trades/store";
import {
  createTradeActionTypedData,
  getTradeActionChainId,
} from "@/lib/trades/action-auth";
import {
  EVM_ESCROW_NETWORKS,
  getEvmEscrowNetwork,
  isMainnetEscrowPubliclyEnabled,
} from "@/lib/contracts/escrow-networks";

interface ConditionDraft {
  title: string;
  description: string;
  type: "onchain_receipt" | "external_delivery" | "inspection" | "mutual_signature";
}

interface RecallResponse {
  success?: boolean;
  memories?: WalrusTradeMemory[];
}

interface CreateTradeResponse {
  success?: boolean;
  error?: string;
  trade?: Trade;
}

interface RecallState {
  counterparty: string;
  memories: WalrusTradeMemory[];
  loading: boolean;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export default function CreateTradePage() {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [creatorRole, setCreatorRole] = useState<"buyer" | "seller">("buyer");
  const [buyer, setBuyer] = useState("");
  const [seller, setSeller] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [asset, setAsset] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState("base-sepolia");
  const [expirationHours, setExpirationHours] = useState(72);
  const [agreedTerms, setAgreedTerms] = useState(
    "The buyer sends the agreed amount using the payment arrangement shown in the trade room. Accord checks the submitted transaction on the selected network. The seller completes the agreed delivery by the deadline, and the buyer reviews and confirms it."
  );

  const [conditions, setConditions] = useState<ConditionDraft[]>([
    {
      title: "Payment confirmed",
      description: "Accord checks the submitted payment transaction against the selected network.",
      type: "onchain_receipt",
    },
    {
      title: "Delivery completed",
      description: "The seller completes the delivery described in the agreed terms.",
      type: "external_delivery",
    },
    {
      title: "Buyer confirms delivery",
      description: "The buyer reviews the delivery and records whether the agreed work is complete.",
      type: "inspection",
    },
  ]);

  const [newCondTitle, setNewCondTitle] = useState("");
  const [newCondDesc, setNewCondDesc] = useState("");
  const [newCondType, setNewCondType] = useState<ConditionDraft["type"]>("external_delivery");

  const [recallState, setRecallState] = useState<RecallState>({
    counterparty: "",
    memories: [],
    loading: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdTrade, setCreatedTrade] = useState<Trade | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!connectedAddress) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (creatorRole === "buyer") {
        setBuyer(connectedAddress);
      } else {
        setSeller(connectedAddress);
      }
    });
    return () => {
      active = false;
    };
  }, [connectedAddress, creatorRole]);

  const counterpartyAddress = creatorRole === "buyer" ? seller : buyer;
  const recallIsCurrent = recallState.counterparty === counterpartyAddress;
  const recalledMemories = recallIsCurrent ? recallState.memories : [];
  const loadingRecall =
    recallIsCurrent && recallState.loading;

  useEffect(() => {
    if (!counterpartyAddress || counterpartyAddress.length < 10) return;

    let active = true;
    const timer = setTimeout(() => {
      setRecallState({ counterparty: counterpartyAddress, memories: [], loading: true });
      void (async () => {
        let memories: WalrusTradeMemory[] = [];
        try {
          const res = await fetch(
            `/api/memory/recall?q=*&participant=${encodeURIComponent(counterpartyAddress)}&limit=4`
          );
          const data = (await res.json()) as RecallResponse;
          if (data.success && Array.isArray(data.memories)) {
            memories = data.memories;
          }
        } catch {
          // ignore
        } finally {
          if (active) {
            setRecallState({ counterparty: counterpartyAddress, memories, loading: false });
          }
        }
      })();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [counterpartyAddress]);

  // Contextual validation for Step 1
  const validateStep1 = (): string | null => {
    if (!amount.trim() || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return "Enter an amount greater than zero.";
    }
    if (!ETH_ADDR_RE.test(buyer.trim())) {
      return "Enter a valid wallet address for the buyer.";
    }
    if (!ETH_ADDR_RE.test(seller.trim())) {
      return "Enter a valid wallet address for the seller.";
    }
    if (buyer.trim().toLowerCase() === seller.trim().toLowerCase()) {
      return "Buyer and Seller must be distinct wallet addresses.";
    }
    if (arbiter.trim()) {
      if (!ETH_ADDR_RE.test(arbiter.trim())) {
        return "Enter a valid wallet address for the independent dispute resolver.";
      }
      const arbLower = arbiter.trim().toLowerCase();
      if (
        arbLower === buyer.trim().toLowerCase() ||
        arbLower === seller.trim().toLowerCase()
      ) {
        return "The dispute resolver must be different from the buyer and seller.";
      }
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!agreedTerms.trim() || agreedTerms.trim().length < 15) {
      return "Describe the trade clearly (at least 15 characters).";
    }
    if (conditions.length === 0) {
      return "Add at least one requirement for completing the trade.";
    }
    return null;
  };

  const goToStep = (target: 1 | 2 | 3) => {
    setErrorMsg(null);
    if (target > 1) {
      const err1 = validateStep1();
      if (err1) {
        setErrorMsg(err1);
        setStep(1);
        return;
      }
    }
    if (target > 2) {
      const err2 = validateStep2();
      if (err2) {
        setErrorMsg(err2);
        setStep(2);
        return;
      }
    }
    setStep(target);
  };

  const handleAddCondition = () => {
    if (!newCondTitle.trim()) return;
    setConditions([
      ...conditions,
      {
        title: newCondTitle.trim(),
        description:
          newCondDesc.trim() ||
          (newCondType === "onchain_receipt"
            ? "Accord checks the payment on the selected network."
            : "The people in the trade confirm this requirement."),
        type: newCondType,
      },
    ]);
    setNewCondTitle("");
    setNewCondDesc("");
  };

  const handleRemoveCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const err1 = validateStep1();
    if (err1) {
      setErrorMsg(err1);
      setStep(1);
      return;
    }
    const err2 = validateStep2();
    if (err2) {
      setErrorMsg(err2);
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const creator = creatorRole === "buyer" ? buyer : seller;
      if (!connectedAddress || connectedAddress.toLowerCase() !== creator.toLowerCase()) {
        throw new Error("Connect the buyer or seller wallet that is creating this agreement.");
      }
      const networkConfig = getEvmEscrowNetwork(network);
      if (!networkConfig || (!networkConfig.testnet && !isMainnetEscrowPubliclyEnabled())) {
        throw new Error("This network is not enabled for escrow agreements.");
      }
      const chainId = getTradeActionChainId(network);
      if (!chainId) throw new Error("This network cannot be used for a signed agreement.");
      await switchChainAsync({ chainId: networkConfig.chainId });

      const authorizationNonce = window.crypto.randomUUID();
      const issuedAt = BigInt(Math.floor(Date.now() / 1000));
      const expiresAt = issuedAt + BigInt(300);
      const signedPayload = {
        action: "create_trade",
        authorizationNonce,
        creator,
        creatorRole,
        buyer,
        seller,
        arbiter,
        asset,
        amount,
        network,
        agreedTerms,
        conditions,
        expirationHours,
      };
      const signature = await signTypedDataAsync(
        createTradeActionTypedData({
          origin: window.location.origin,
          tradeReference: `create:${authorizationNonce}`,
          payload: signedPayload,
          expectedUpdatedAt: BigInt(0),
          issuedAt,
          expiresAt,
          chainId,
        })
      );

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...signedPayload,
          authorization: {
            signature,
            issuedAt: issuedAt.toString(),
            expiresAt: expiresAt.toString(),
            expectedUpdatedAt: "0",
          },
        }),
      });

      const data = (await res.json()) as CreateTradeResponse;
      if (!res.ok || !data.success || !data.trade) {
        throw new Error(data.error || "Failed to initialize agreement");
      }

      setCreatedTrade(data.trade);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const shareableUrl =
    typeof window !== "undefined" && createdTrade
      ? `${window.location.origin}/trade/${createdTrade.reference}`
      : createdTrade
      ? `/trade/${createdTrade.reference}`
      : "";

  const copyInviteLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (createdTrade) {
    return (
      <div className="max-w-[820px] mx-auto px-4 sm:px-8 py-14">
        <div className="surface-instrument rounded-[4px] overflow-hidden">
          <div className="px-6 py-4 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between">
            <span className="font-mono-tabular text-[12px] text-[#C5A46D]">
              AGREEMENT ISSUED — {createdTrade.reference}
            </span>
            <span className="status-pill status-pill-brass">{createdTrade.status}</span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h1 className="font-editorial text-[30px] sm:text-[36px] leading-tight text-[#F4F2ED]">
                Your trade is ready to share.
              </h1>
              <p className="text-[14px] text-[#A6A39B] leading-relaxed">
                The first version of your terms has been saved. Send this link to the other person
                so they can review and accept the terms before anyone sends payment.
              </p>
            </div>

            {/* Shareable Invitation URL */}
            <div className="p-4 bg-[#090A0C] border border-white/[0.12] rounded-[3px] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#6E6C65]">
                <span>TRADE INVITATION LINK</span>
                <span>The other person needs to accept the terms</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  readOnly
                  value={shareableUrl}
                  className="flex-1 bg-transparent font-mono-tabular text-[13px] text-[#F4F2ED] focus:outline-none py-1"
                />
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="px-4 py-2 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] font-mono-tabular text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Invitation Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Summary Ledger */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/[0.08] font-mono-tabular text-[12px]">
              <div>
                <dt className="text-[11px] text-[#6E6C65] uppercase">Amount</dt>
                <dd className="text-[#F4F2ED] mt-1 font-medium">
                  {createdTrade.amount} {createdTrade.asset}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#6E6C65] uppercase">Network</dt>
                <dd className="text-[#F4F2ED] mt-1">{createdTrade.network}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#6E6C65] uppercase">Requirements</dt>
                <dd className="text-[#F4F2ED] mt-1">{createdTrade.conditions.length}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#6E6C65] uppercase">You are the</dt>
                <dd className="text-[#C5A46D] mt-1 uppercase">{createdTrade.creatorRole}</dd>
              </div>
            </dl>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
              <Link
                href="/trades"
                className="w-full sm:w-auto px-4 py-2.5 rounded-[3px] border border-white/[0.1] text-[12px] font-mono-tabular text-[#A6A39B] hover:text-[#F4F2ED] text-center"
              >
                Back to trades
              </Link>
              <button
                type="button"
                onClick={() => router.push(`/trade/${createdTrade.reference}`)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Open trade room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
      {/* Header & Stepper */}
      <div className="pb-8 border-b border-white/[0.08] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#6E6C65]">
            Start a trade
          </div>
          <h1 className="font-editorial text-[34px] sm:text-[42px] leading-[1.08] tracking-[-0.02em] text-[#F4F2ED]">
            Set up a trade
          </h1>
          <p className="text-[14px] text-[#A6A39B] max-w-[60ch]">
            Add the people, amount, network, and responsibilities. Then share the trade so the
            other person can review the terms.
          </p>
        </div>

        {/* 3-Step Progression Bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono-tabular text-[11px] shrink-0">
          {[
            { num: 1 as const, label: "Counterparties & Asset" },
            { num: 2 as const, label: "Agree on details" },
            { num: 3 as const, label: "Review & share" },
          ].map((s) => {
            const active = step === s.num;
            const passed = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => goToStep(s.num)}
                className={`px-3 py-2 rounded-[3px] border text-left transition-colors ${
                  active
                    ? "bg-[#13161C] border-[#C5A46D] text-[#F4F2ED]"
                    : passed
                    ? "bg-[#0E1014] border-white/[0.14] text-[#A6A39B]"
                    : "bg-transparent border-white/[0.07] text-[#6E6C65]"
                }`}
              >
                <div className="text-[10px] text-[#C5A46D]">0{s.num}</div>
                <div className="truncate mt-0.5">{s.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-[3px] bg-[#C94A4A]/10 border border-[#C94A4A]/40 text-[#F28B8B] text-[12px] font-mono-tabular flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleCreateTrade} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left 7 Columns: Active Step Form */}
        <div className="lg:col-span-7 space-y-6">
          {step === 1 && (
            <div className="surface-panel rounded-[4px] p-6 sm:p-8 space-y-7">
              <div className="border-b border-white/[0.07] pb-4">
                <div className="font-mono-tabular text-[11px] text-[#C5A46D] uppercase">
                  Stage 01 of 03
                </div>
                <h2 className="text-[18px] font-medium text-[#F4F2ED] mt-1">
                  People and payment details
                </h2>
              </div>

              {/* Initiator Role */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B]">
                  Your role in this trade
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreatorRole("buyer")}
                    className={`p-4 rounded-[3px] border text-left transition-colors ${
                      creatorRole === "buyer"
                        ? "bg-[#13161C] border-[#C5A46D] text-[#F4F2ED]"
                        : "bg-[#090A0C] border-white/[0.08] text-[#A6A39B]"
                    }`}
                  >
                    <div className="font-mono-tabular text-[12px] text-[#C5A46D]">
                      BUYER (PAYS)
                    </div>
                    <div className="text-[12px] text-[#A6A39B] mt-1">
                      Sends payment using the arrangement shown in the trade room.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatorRole("seller")}
                    className={`p-4 rounded-[3px] border text-left transition-colors ${
                      creatorRole === "seller"
                        ? "bg-[#13161C] border-[#C5A46D] text-[#F4F2ED]"
                        : "bg-[#090A0C] border-white/[0.08] text-[#A6A39B]"
                    }`}
                  >
                    <div className="font-mono-tabular text-[12px] text-[#C5A46D]">
                      SELLER (RECEIVES PAYMENT)
                    </div>
                    <div className="text-[12px] text-[#A6A39B] mt-1">
                      Completes the delivery described in the agreed terms.
                    </div>
                  </button>
                </div>
              </div>

              {/* Principal & Network */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Trade amount
                  </label>
                  <input
                    type="text"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[14px] text-[#F4F2ED]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Asset
                  </label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[13px] text-[#F4F2ED]"
                  >
                    <option value="ETH">ETH (Native)</option>
                  </select>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#6E6C65]">
                    Only native ETH escrow is supported. Mainnet availability is controlled by the
                    deployment operator and remains off by default.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Payment network
                  </label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[13px] text-[#F4F2ED]"
                  >
                    {Object.entries(EVM_ESCROW_NETWORKS)
                      .filter(([, config]) => config.testnet || isMainnetEscrowPubliclyEnabled())
                      .map(([networkId, config]) => (
                        <option key={networkId} value={networkId}>
                          {config.name} ({config.chainId})
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#6E6C65]">
                    Mainnet networks appear only when explicitly enabled in the public deployment
                    configuration. Server-side escrow remains independently gated.
                  </p>
                </div>
              </div>

              {/* Wallet Addresses */}
              <div className="space-y-4 pt-2 border-t border-white/[0.07]">
                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Buyer wallet address {creatorRole === "buyer" && "(you)"}
                  </label>
                  <input
                    type="text"
                    required
                    value={buyer}
                    onChange={(e) => setBuyer(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Seller wallet address {creatorRole === "seller" && "(you)"}
                  </label>
                  <input
                    type="text"
                    required
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Optional independent dispute resolver
                  </label>
                  <input
                    type="text"
                    value={arbiter}
                    onChange={(e) => setArbiter(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#A6A39B]"
                  />
                  <p className="text-[11px] text-[#6E6C65] mt-1">
                    If you add someone to help resolve a disagreement, they must not be the buyer
                    or seller.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="px-5 py-2.5 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[12px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <span>Continue to trade details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="surface-panel rounded-[4px] p-6 sm:p-8 space-y-7">
              <div className="border-b border-white/[0.07] pb-4 flex items-center justify-between">
                <div>
                  <div className="font-mono-tabular text-[11px] text-[#C5A46D] uppercase">
                    Stage 02 of 03
                  </div>
                  <h2 className="text-[18px] font-medium text-[#F4F2ED] mt-1">
                    Agree on the details
                  </h2>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-[#A6A39B]">
                  <span>Expiration:</span>
                  <select
                    value={expirationHours}
                    onChange={(e) => setExpirationHours(Number(e.target.value))}
                    className="bg-[#090A0C] border border-white/[0.12] rounded-[3px] px-2.5 py-1 text-[#F4F2ED]"
                  >
                    <option value={24}>24 Hours</option>
                    <option value={48}>48 Hours</option>
                    <option value={72}>72 Hours</option>
                    <option value={168}>7 Days</option>
                  </select>
                </div>
              </div>

              {/* Written Agreement Clause */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B]">
                  What each person agrees to do
                </label>
                <textarea
                  rows={4}
                  required
                  value={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.value)}
                  className="w-full px-4 py-3 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[14px] text-[#F4F2ED] leading-relaxed"
                />
                <p className="text-[11px] text-[#6E6C65]">
                  Be specific about what is being exchanged, who does each part, and any deadlines.
                  If the terms change later, both people must review and accept the update.
                </p>
              </div>

              {/* Conditions List */}
              <div className="space-y-3 pt-2 border-t border-white/[0.07]">
                <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B]">
                  Requirements to complete the trade ({conditions.length})
                </label>

                <div className="divide-y divide-white/[0.07] border border-white/[0.08] rounded-[3px] bg-[#090A0C]">
                  {conditions.map((cond, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-tabular text-[11px] text-[#6E6C65]">
                            0{idx + 1}
                          </span>
                          <span className="text-[13px] font-medium text-[#F4F2ED]">
                            {cond.title}
                          </span>
                          <span
                            className={`status-pill ${
                              cond.type === "onchain_receipt"
                                ? "status-pill-verified"
                                : "status-pill-brass"
                            }`}
                          >
                            {cond.type === "onchain_receipt"
                              ? "Payment check"
                              : "People confirm"}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#A6A39B] pl-6">{cond.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="text-[#6E6C65] hover:text-[#F28B8B] p-1 transition-colors"
                        title="Remove requirement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Clause Controls */}
                <div className="p-4 rounded-[3px] bg-[#0B0D10] border border-white/[0.08] space-y-3">
                  <div className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                    Add a requirement
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCondTitle}
                      onChange={(e) => setNewCondTitle(e.target.value)}
                      placeholder="Requirement (e.g., transfer account ownership)"
                      className="px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.1] text-[12px] text-[#F4F2ED]"
                    />
                    <select
                      value={newCondType}
                      onChange={(e) => setNewCondType(e.target.value as ConditionDraft["type"])}
                      className="px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.1] font-mono-tabular text-[12px] text-[#F4F2ED]"
                    >
                      <option value="external_delivery">
                        Delivery completed
                      </option>
                      <option value="inspection">
                        Buyer confirms delivery
                      </option>
                      <option value="onchain_receipt">
                        Payment confirmed
                      </option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCondDesc}
                      onChange={(e) => setNewCondDesc(e.target.value)}
                      placeholder="How will you know it is complete?"
                      className="flex-1 px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.1] text-[12px] text-[#F4F2ED]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="px-3.5 py-2 rounded-[3px] bg-[#13161C] hover:bg-[#181C24] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED] inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add requirement</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-[3px] border border-white/[0.1] font-mono-tabular text-[12px] text-[#A6A39B] hover:text-[#F4F2ED] inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="px-5 py-2.5 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[12px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <span>Review trade</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="surface-panel rounded-[4px] p-6 sm:p-8 space-y-6">
              <div className="border-b border-white/[0.07] pb-4">
                <div className="font-mono-tabular text-[11px] text-[#C5A46D] uppercase">
                  Stage 03 of 03
                </div>
                <h2 className="text-[18px] font-medium text-[#F4F2ED] mt-1">
                  Review and share the trade
                </h2>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px] font-mono-tabular border-b border-white/[0.07] pb-6">
                <div>
                  <dt className="text-[#6E6C65]">SETTLEMENT PRINCIPAL</dt>
                  <dd className="text-[16px] text-[#F4F2ED] mt-1">
                    {amount} {asset} ({network})
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6E6C65]">INITIATOR &amp; EXPIRATION</dt>
                  <dd className="text-[#F4F2ED] mt-1 uppercase">
                    {creatorRole} · {expirationHours} Hours
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6E6C65]">BUYER ADDRESS</dt>
                  <dd className="text-[#F4F2ED] mt-1 break-all">{buyer}</dd>
                </div>
                <div>
                  <dt className="text-[#6E6C65]">SELLER ADDRESS</dt>
                  <dd className="text-[#F4F2ED] mt-1 break-all">{seller}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <div className="text-[11px] font-mono-tabular text-[#6E6C65] uppercase">
                  Version 1 terms
                </div>
                <div className="p-4 rounded-[3px] bg-[#090A0C] border border-white/[0.08] text-[13px] text-[#D8D5CE] leading-relaxed">
                  {agreedTerms}
                </div>
              </div>

              <div className="p-4 rounded-[3px] bg-[#13161C] border border-white/[0.08] text-[12px] text-[#A6A39B] leading-relaxed">
                <strong className="text-[#F4F2ED] font-medium">What happens next:</strong> Accord
                saves these details and creates a link for the other person to review and accept
                the terms. Do not send payment until both people have agreed and you have checked
                the payment arrangement in the trade room.
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-[3px] border border-white/[0.1] font-mono-tabular text-[12px] text-[#A6A39B] hover:text-[#F4F2ED] inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit requirements</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[13px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <span>
                    {submitting
                      ? "Creating your trade…"
                      : "Create trade and get invite link"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trade preview and saved history */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Live Draft Instrument Preview */}
          <div className="surface-instrument rounded-[4px] overflow-hidden">
            <div className="px-5 py-3 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between text-[11px] font-mono-tabular">
              <span className="text-[#A6A39B]">DRAFT INSTRUMENT PREVIEW</span>
              <span className="text-[#C5A46D]">CLAUSE V1</span>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-baseline justify-between border-b border-white/[0.07] pb-4">
                <div>
                  <div className="text-[10px] font-mono-tabular uppercase text-[#6E6C65]">
                    Principal
                  </div>
                  <div className="font-mono-tabular text-[22px] text-[#F4F2ED] mt-0.5">
                    {amount || "0.00"} <span className="text-[13px] text-[#A6A39B]">{asset}</span>
                  </div>
                </div>
                <div className="text-right font-mono-tabular text-[11px] text-[#A6A39B]">
                  <div>{network}</div>
                  <div className="text-[#6E6C65]">Expires in {expirationHours}h</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono-tabular text-[11px]">
                <div>
                  <div className="text-[#6E6C65]">BUYER</div>
                  <div className="text-[#F4F2ED] truncate mt-0.5">{buyer}</div>
                </div>
                <div>
                  <div className="text-[#6E6C65]">SELLER</div>
                  <div className="text-[#F4F2ED] truncate mt-0.5">{seller}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.07]">
                <div className="text-[10px] font-mono-tabular uppercase text-[#6E6C65] mb-1">
                  Requirements ({conditions.length})
                </div>
                <ul className="space-y-1 text-[12px] text-[#A6A39B]">
                  {conditions.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {i + 1}. {c.title}
                      </span>
                      <span className="font-mono-tabular text-[10px] text-[#6E6C65] shrink-0">
                        {c.type === "onchain_receipt" ? "Payment check" : "People confirm"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Relevant saved trade history */}
          <div className="surface-panel rounded-[4px] p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5 font-mono-tabular text-[11px]">
              <span className="text-[#C5A46D] uppercase tracking-[0.06em]">
                Relevant history for this trading partner
              </span>
              <span className="text-[#6E6C65]">
                {counterpartyAddress.slice(0, 8)}…{counterpartyAddress.slice(-4)}
              </span>
            </div>

            {loadingRecall ? (
              <div className="py-4 text-[12px] font-mono-tabular text-[#6E6C65]">
                Looking for saved trade history…
              </div>
            ) : recalledMemories.length === 0 ? (
              <p className="text-[12px] text-[#A6A39B] leading-relaxed">
                No earlier trade records or disagreement notices were found for this wallet.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {recalledMemories.map((mem) => (
                  <div key={mem.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between font-mono-tabular text-[10px]">
                      <span className="text-[#C5A46D]">{mem.type}</span>
                      <span className="text-[#6E6C65]">{mem.tradeRef}</span>
                    </div>
                    <p className="text-[12px] text-[#A6A39B] leading-snug">{mem.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
