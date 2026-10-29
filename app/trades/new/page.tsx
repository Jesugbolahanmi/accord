"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

interface ConditionDraft {
  title: string;
  description: string;
  type: "onchain_receipt" | "external_delivery" | "inspection" | "mutual_signature";
}

const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export default function CreateTradePage() {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [creatorRole, setCreatorRole] = useState<"buyer" | "seller">("buyer");
  const [buyer, setBuyer] = useState("0xf5bdce6674389d937df8ad3363c10fc3fa060b75");
  const [seller, setSeller] = useState("0x0729e2a4716d9f7dd17858d5d504426d228697f7");
  const [arbiter, setArbiter] = useState("0x12c4E5496F5bAbE7F9159958742D2635B1a084c7");
  const [asset, setAsset] = useState("ETH");
  const [amount, setAmount] = useState("0.25");
  const [network, setNetwork] = useState("base-mainnet");
  const [expirationHours, setExpirationHours] = useState(72);
  const [agreedTerms, setAgreedTerms] = useState(
    "Buyer transfers agreed ETH on Base Mainnet (verified via Tatum RPC with status 0x1). Seller delivers the signed deliverable package and SHA-256 checksum within 2 hours of confirmation. Buyer inspects and authorizes settlement release."
  );

  const [conditions, setConditions] = useState<ConditionDraft[]>([
    {
      title: "On-Chain Deposit Receipt (Tatum RPC)",
      description: "Verify buyer deposit transaction receipt with status 0x1 on the selected network.",
      type: "onchain_receipt",
    },
    {
      title: "Counterparty Deliverable Handover",
      description: "Seller delivers agreed digital/off-chain asset and anchors SHA-256 receipt hash.",
      type: "external_delivery",
    },
    {
      title: "Buyer Verification & Sign-Off",
      description: "Buyer inspects deliverable and attests completion before releasing funds.",
      type: "inspection",
    },
  ]);

  const [newCondTitle, setNewCondTitle] = useState("");
  const [newCondDesc, setNewCondDesc] = useState("");
  const [newCondType, setNewCondType] = useState<ConditionDraft["type"]>("external_delivery");

  const [recalledMemories, setRecalledMemories] = useState<any[]>([]);
  const [loadingRecall, setLoadingRecall] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdTrade, setCreatedTrade] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (connectedAddress) {
      if (creatorRole === "buyer") {
        setBuyer(connectedAddress);
      } else {
        setSeller(connectedAddress);
      }
    }
  }, [connectedAddress, creatorRole]);

  const counterpartyAddress = creatorRole === "buyer" ? seller : buyer;

  useEffect(() => {
    if (!counterpartyAddress || counterpartyAddress.length < 10) {
      setRecalledMemories([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingRecall(true);
      try {
        const res = await fetch(
          `/api/memory/recall?q=*&participant=${encodeURIComponent(counterpartyAddress)}&limit=4`
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.memories)) {
          setRecalledMemories(data.memories);
        }
      } catch {
        // ignore
      } finally {
        setLoadingRecall(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [counterpartyAddress]);

  // Contextual validation for Step 1
  const validateStep1 = (): string | null => {
    if (!amount.trim() || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return "Enter a valid positive settlement amount.";
    }
    if (!ETH_ADDR_RE.test(buyer.trim())) {
      return "Buyer address must be a valid 42-character hexadecimal address (0x…).";
    }
    if (!ETH_ADDR_RE.test(seller.trim())) {
      return "Seller address must be a valid 42-character hexadecimal address (0x…).";
    }
    if (buyer.trim().toLowerCase() === seller.trim().toLowerCase()) {
      return "Buyer and Seller must be distinct wallet addresses.";
    }
    if (arbiter.trim()) {
      if (!ETH_ADDR_RE.test(arbiter.trim())) {
        return "Neutral Arbiter must be a valid 42-character hexadecimal address (0x…).";
      }
      const arbLower = arbiter.trim().toLowerCase();
      if (
        arbLower === buyer.trim().toLowerCase() ||
        arbLower === seller.trim().toLowerCase()
      ) {
        return "Neutral Arbiter must be independent and cannot match the Buyer or Seller address.";
      }
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!agreedTerms.trim() || agreedTerms.trim().length < 15) {
      return "Please provide clear, specific trade terms (at least 15 characters).";
    }
    if (conditions.length === 0) {
      return "Include at least one settlement condition.";
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
            ? "Verified on-chain via Tatum RPC receipt"
            : "Participant attestation anchored to Walrus Memory"),
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
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize agreement");
      }

      setCreatedTrade(data.trade);
    } catch (err: any) {
      setErrorMsg(err.message);
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
                Counterparty invitation ready.
              </h1>
              <p className="text-[14px] text-[#A6A39B] leading-relaxed">
                Version 1 of the agreement (SHA-256:{" "}
                <code className="font-mono-tabular text-[12px] text-[#F4F2ED]">
                  {createdTrade.termsHash?.slice(0, 18)}…
                </code>
                ) has been recorded. Send the invitation link below to the counterparty so they can
                review and sign the terms before any deposit is made.
              </p>
            </div>

            {/* Shareable Invitation URL */}
            <div className="p-4 bg-[#090A0C] border border-white/[0.12] rounded-[3px] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#6E6C65]">
                <span>COUNTERPARTY INVITATION URL</span>
                <span>Requires counterparty signature</span>
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
                <dt className="text-[11px] text-[#6E6C65] uppercase">Principal</dt>
                <dd className="text-[#F4F2ED] mt-1 font-medium">
                  {createdTrade.amount} {createdTrade.asset}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#6E6C65] uppercase">Network</dt>
                <dd className="text-[#F4F2ED] mt-1">{createdTrade.network}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#6E6C65] uppercase">Conditions</dt>
                <dd className="text-[#F4F2ED] mt-1">
                  {createdTrade.conditions.length} Clauses
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#6E6C65] uppercase">Initiator Role</dt>
                <dd className="text-[#C5A46D] mt-1 uppercase">{createdTrade.creatorRole}</dd>
              </div>
            </dl>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
              <Link
                href="/trades"
                className="w-full sm:w-auto px-4 py-2.5 rounded-[3px] border border-white/[0.1] text-[12px] font-mono-tabular text-[#A6A39B] hover:text-[#F4F2ED] text-center"
              >
                Return to Register
              </Link>
              <button
                type="button"
                onClick={() => router.push(`/trade/${createdTrade.reference}`)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Open Shared Trade Room</span>
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
            Agreement Drafting Workflow
          </div>
          <h1 className="font-editorial text-[34px] sm:text-[42px] leading-[1.08] tracking-[-0.02em] text-[#F4F2ED]">
            Draft a Peer-to-Peer Agreement
          </h1>
          <p className="text-[14px] text-[#A6A39B] max-w-[60ch]">
            Specify the settlement principal, designate both counterparties and an independent
            neutral arbiter, and define verifiable settlement clauses.
          </p>
        </div>

        {/* 3-Step Progression Bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono-tabular text-[11px] shrink-0">
          {[
            { num: 1 as const, label: "Counterparties & Asset" },
            { num: 2 as const, label: "Terms & Conditions" },
            { num: 3 as const, label: "Review & Issue" },
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
                  Participant Role, Asset &amp; Counterparty Addresses
                </h2>
              </div>

              {/* Initiator Role */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B]">
                  Your Role in This Agreement
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
                      BUYER (DEPOSITOR)
                    </div>
                    <div className="text-[12px] text-[#A6A39B] mt-1">
                      Deposits the crypto principal and authorizes release once conditions are met.
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
                      SELLER (RECIPIENT)
                    </div>
                    <div className="text-[12px] text-[#A6A39B] mt-1">
                      Fulfills the agreed deliverables and receives settlement upon release.
                    </div>
                  </button>
                </div>
              </div>

              {/* Principal & Network */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Principal Amount
                  </label>
                  <input
                    type="text"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
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
                    <option value="USDC">USDC</option>
                    <option value="POL">POL (Polygon)</option>
                    <option value="WBTC">WBTC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Settlement Network
                  </label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[13px] text-[#F4F2ED]"
                  >
                    <option value="base-mainnet">Base Mainnet (8453)</option>
                    <option value="base-sepolia">Base Sepolia (84532)</option>
                    <option value="ethereum-mainnet">Ethereum Mainnet (1)</option>
                    <option value="polygon-mainnet">Polygon Mainnet (137)</option>
                  </select>
                </div>
              </div>

              {/* Wallet Addresses */}
              <div className="space-y-4 pt-2 border-t border-white/[0.07]">
                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B] mb-1.5">
                    Buyer Wallet Address {creatorRole === "buyer" && "(Initiator)"}
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
                    Seller Wallet Address {creatorRole === "seller" && "(Initiator)"}
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
                    Independent Neutral Arbiter (Must be distinct from Buyer &amp; Seller)
                  </label>
                  <input
                    type="text"
                    value={arbiter}
                    onChange={(e) => setArbiter(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3.5 py-2.5 rounded-[3px] bg-[#090A0C] border border-white/[0.12] font-mono-tabular text-[12px] text-[#A6A39B]"
                  />
                  <p className="text-[11px] text-[#6E6C65] mt-1">
                    Accord enforces separation of duties: neither Buyer nor Seller may act as
                    arbiter over their own trade.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="px-5 py-2.5 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[12px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <span>Continue to Terms &amp; Clauses</span>
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
                    Agreed Terms &amp; Settlement Conditions
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
                  Written Agreement Clause (Version 1)
                </label>
                <textarea
                  rows={4}
                  required
                  value={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.value)}
                  className="w-full px-4 py-3 rounded-[3px] bg-[#090A0C] border border-white/[0.12] text-[14px] text-[#F4F2ED] leading-relaxed"
                />
                <p className="text-[11px] text-[#6E6C65]">
                  This clause is hashed with SHA-256 upon creation. Any subsequent amendment will
                  increment the version number and require fresh counterparty acceptance.
                </p>
              </div>

              {/* Conditions List */}
              <div className="space-y-3 pt-2 border-t border-white/[0.07]">
                <label className="block text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#A6A39B]">
                  Required Settlement Conditions ({conditions.length})
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
                              ? "On-Chain · Tatum RPC"
                              : "Off-Chain · Participant Attestation"}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#A6A39B] pl-6">{cond.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="text-[#6E6C65] hover:text-[#F28B8B] p-1 transition-colors"
                        title="Remove clause"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Clause Controls */}
                <div className="p-4 rounded-[3px] bg-[#0B0D10] border border-white/[0.08] space-y-3">
                  <div className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                    Append Settlement Clause
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCondTitle}
                      onChange={(e) => setNewCondTitle(e.target.value)}
                      placeholder="Clause title (e.g., Domain Registrant Transfer)"
                      className="px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.1] text-[12px] text-[#F4F2ED]"
                    />
                    <select
                      value={newCondType}
                      onChange={(e) => setNewCondType(e.target.value as ConditionDraft["type"])}
                      className="px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.1] font-mono-tabular text-[12px] text-[#F4F2ED]"
                    >
                      <option value="external_delivery">
                        Off-Chain: Deliverable Handover Attestation
                      </option>
                      <option value="inspection">
                        Off-Chain: Buyer Inspection Sign-Off
                      </option>
                      <option value="onchain_receipt">
                        On-Chain: Tatum RPC Receipt Proof
                      </option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCondDesc}
                      onChange={(e) => setNewCondDesc(e.target.value)}
                      placeholder="Verification criteria…"
                      className="flex-1 px-3 py-2 rounded-[3px] bg-[#090A0C] border border-white/[0.1] text-[12px] text-[#F4F2ED]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="px-3.5 py-2 rounded-[3px] bg-[#13161C] hover:bg-[#181C24] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED] inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Clause</span>
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
                  <span>Review Agreement</span>
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
                  Review &amp; Issue Agreement Invitation
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
                  Version 1 Agreed Terms
                </div>
                <div className="p-4 rounded-[3px] bg-[#090A0C] border border-white/[0.08] text-[13px] text-[#D8D5CE] leading-relaxed">
                  {agreedTerms}
                </div>
              </div>

              <div className="p-4 rounded-[3px] bg-[#13161C] border border-white/[0.08] text-[12px] text-[#A6A39B] leading-relaxed">
                <strong className="text-[#F4F2ED] font-medium">What happens next:</strong> Issuing
                this agreement records Version 1 in Walrus Memory and generates a unique
                counterparty invitation link. No funds are transferred until the counterparty
                reviews and signs the agreement.
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-[3px] border border-white/[0.1] font-mono-tabular text-[12px] text-[#A6A39B] hover:text-[#F4F2ED] inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit Clauses</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[13px] font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <span>
                    {submitting
                      ? "Issuing Agreement & Anchoring Memory…"
                      : "Issue Agreement & Generate Invite Link"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Live Instrument Preview & Walrus Counterparty Recall */}
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
                  Conditions ({conditions.length})
                </div>
                <ul className="space-y-1 text-[12px] text-[#A6A39B]">
                  {conditions.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {i + 1}. {c.title}
                      </span>
                      <span className="font-mono-tabular text-[10px] text-[#6E6C65] shrink-0">
                        {c.type === "onchain_receipt" ? "Tatum RPC" : "Attestation"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Persistent Walrus Memory Counterparty Recall */}
          <div className="surface-panel rounded-[4px] p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5 font-mono-tabular text-[11px]">
              <span className="text-[#C5A46D] uppercase tracking-[0.06em]">
                Walrus Memory — Counterparty Context
              </span>
              <span className="text-[#6E6C65]">
                {counterpartyAddress.slice(0, 8)}…{counterpartyAddress.slice(-4)}
              </span>
            </div>

            {loadingRecall ? (
              <div className="py-4 text-[12px] font-mono-tabular text-[#6E6C65]">
                Querying persistent memory records…
              </div>
            ) : recalledMemories.length === 0 ? (
              <p className="text-[12px] text-[#A6A39B] leading-relaxed">
                No prior trade records or dispute notices found in Walrus Memory for this
                counterparty address.
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
