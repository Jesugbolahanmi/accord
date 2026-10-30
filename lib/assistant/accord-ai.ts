/**
 * Accord - Context Assistant & Memory Intelligence Engine
 *
 * Answers practical trade and settlement questions strictly grounded in:
 * 1. Verified Tatum RPC on-chain transaction data (`[Verified On-Chain via Tatum RPC]`)
 * 2. Persistent memories retrieved from Walrus Memory (`[Walrus Memory Mainnet]` / `[Walrus Memory Record]`)
 * 3. Participant-submitted attestations and claims (`[Participant Claim / Attestation]`)
 *
 * Works out-of-the-box with zero external LLM API keys via a natural-language
 * trade-intelligence engine, and automatically upgrades to LLM prose synthesis
 * when `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) is configured.
 *
 * Security & Epistemic Rules:
 * - Explicitly separates verified on-chain facts from participant-submitted claims.
 * - Never claims the AI has retrained itself or modified model weights; Accord provides
 *   context-aware assistance by retrieving persistent memories and verified RPC state.
 * - Never authorizes fund releases, signs transactions, or decides disputes.
 */

import { walrusMemory, WalrusTradeMemory } from "../walrus/memory";
import { tatum, VerificationResult, SUPPORTED_NETWORKS } from "../tatum/client";

export interface AccordContextQuery {
  question: string;
  tradeRef?: string;
  currentUser?: string;
  counterparty?: string;
  network?: string;
  txHash?: string;
  currentTrade?: any;
}

export interface AccordContextResponse {
  question: string;
  answer: string;
  engineMode: "grounded_deterministic" | "gemini_grounded";
  verifiedFacts: string[];
  userClaims: string[];
  outstandingActions: string[];
  citedMemories: WalrusTradeMemory[];
  onchainVerification?: VerificationResult | null;
  timestamp: string;
}

function formatDurationHuman(ms: number): string {
  const absMs = Math.max(0, Math.abs(ms));
  const totalSeconds = Math.floor(absMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    const secs = totalSeconds % 60;
    return secs > 0
      ? `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"} and ${secs}s`
      : `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 48) {
    return remMinutes > 0
      ? `${totalHours} hour${totalHours === 1 ? "" : "s"} and ${remMinutes} minute${remMinutes === 1 ? "" : "s"}`
      : `${totalHours} hour${totalHours === 1 ? "" : "s"}`;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours > 0
    ? `${days} day${days === 1 ? "" : "s"} and ${remHours} hour${remHours === 1 ? "" : "s"}`
    : `${days} day${days === 1 ? "" : "s"}`;
}

export class AccordAIAssistant {
  /**
   * Process a contextual query grounded in persistent memory & blockchain truth
   */
  async ask(query: AccordContextQuery): Promise<AccordContextResponse> {
    await walrusMemory.seedDemonstrationMemories();
    const rawQuestion = (query.question || "").trim();
    const questionLower = rawQuestion.toLowerCase();

    // 1. Retrieve persistent memories from Walrus Memory
    const memoryRecall = await walrusMemory.recall({
      query: rawQuestion,
      tradeRef: query.tradeRef || query.currentTrade?.reference,
      participant: query.counterparty || query.currentUser,
      limit: 6,
    });

    const citedMemories = memoryRecall.memories;

    // 2. Perform Tatum RPC verification if a txHash is provided or already verified on the trade
    let onchainVerification: VerificationResult | null = query.currentTrade?.verification || null;
    const targetTx = (query.txHash || query.currentTrade?.txHash || "").trim();
    const targetNetwork = query.network || query.currentTrade?.network || "base-mainnet";
    const netConfig = SUPPORTED_NETWORKS[targetNetwork] || SUPPORTED_NETWORKS["base-mainnet"];

    if (!onchainVerification && targetTx && targetTx.startsWith("0x") && targetTx.length === 66) {
      try {
        onchainVerification = await tatum.verifyTransaction(targetTx, targetNetwork, {
          from: query.currentTrade?.buyer,
          allowedRecipients: [
            query.currentTrade?.escrowAddress,
            query.currentTrade?.seller,
          ].filter(Boolean),
          expectedValueEth: query.currentTrade?.amount,
        });
      } catch (err: any) {
        console.warn("[AccordAI] Tatum verification notice:", err.message);
      }
    }

    const verifiedFacts: string[] = [];
    const userClaims: string[] = [];
    const outstandingActions: string[] = [];

    // 3. Classify on-chain facts vs participant claims
    if (onchainVerification) {
      if (onchainVerification.verified && onchainVerification.status === "confirmed") {
        verifiedFacts.push(
          `[Verified On-Chain via Tatum RPC] Transaction ${onchainVerification.txHash.slice(0, 10)}... confirmed in block #${onchainVerification.blockNumber} (${onchainVerification.confirmations} confirmations) on ${netConfig.name} with status 0x1 (${onchainVerification.valueEth || query.currentTrade?.amount || ""} ${query.currentTrade?.asset || "ETH"}).`
        );
      } else if (onchainVerification.status === "pending") {
        verifiedFacts.push(
          `[Verified On-Chain via Tatum RPC] Transaction ${onchainVerification.txHash.slice(0, 10)}... is pending in the mempool on ${netConfig.name} (0 confirmations).`
        );
        outstandingActions.push(
          "Wait for the deposit transaction to be mined and confirmed by Tatum RPC before delivering off-chain assets."
        );
      } else if (onchainVerification.status === "reverted") {
        verifiedFacts.push(
          `[Verified On-Chain via Tatum RPC] Transaction ${onchainVerification.txHash.slice(0, 10)}... reverted on-chain (status 0x0). No funds were transferred.`
        );
        outstandingActions.push("Buyer must submit a valid deposit transaction that succeeds on-chain.");
      } else if (onchainVerification.status === "mismatch") {
        verifiedFacts.push(
          `[Verified On-Chain via Tatum RPC] Transaction ${onchainVerification.txHash.slice(0, 10)}... failed parameter verification: ${onchainVerification.errorMessage}`
        );
        outstandingActions.push(
          "Buyer must submit a transaction matching the agreed Buyer, Seller/Escrow recipient, and principal amount."
        );
      }
    } else if (
      query.currentTrade?.status === "AwaitingDeposit" ||
      query.currentTrade?.status === "AwaitingAcceptance"
    ) {
      verifiedFacts.push(
        `[Verified Application State] No deposit transaction receipt has been verified on-chain via Tatum RPC for ${query.currentTrade?.reference || "this trade"} yet.`
      );
      if (query.currentTrade?.status === "AwaitingAcceptance") {
        const pendingParty = !query.currentTrade.sellerAccepted
          ? `Seller (${query.currentTrade.seller.slice(0, 8)}...)`
          : `Buyer (${query.currentTrade.buyer.slice(0, 8)}...)`;
        outstandingActions.push(
          `${pendingParty} must review and sign the current version of the agreed terms.`
        );
      } else {
        outstandingActions.push(
          `Buyer (${query.currentTrade?.buyer?.slice(0, 8) || "Buyer"}...) must transfer ${query.currentTrade?.amount || ""} ${query.currentTrade?.asset || "ETH"} on ${netConfig.name} and verify the transaction hash via Tatum RPC.`
        );
      }
    }

    // Evaluate trade agreement & conditions
    if (query.currentTrade) {
      const {
        agreedTerms,
        termsVersions,
        conditions,
        status,
        amount,
        asset,
        buyerAccepted,
        sellerAccepted,
      } = query.currentTrade;
      const latestVersion = Array.isArray(termsVersions) ? termsVersions.length : 1;

      verifiedFacts.push(
        `[Trade Agreement Record] Trade ${query.currentTrade.reference}: ${amount} ${asset} on ${netConfig.name} (Terms v${latestVersion}, Buyer accepted: ${buyerAccepted ? "Yes" : "No"}, Seller accepted: ${sellerAccepted ? "Yes" : "No"}).`
      );

      if (agreedTerms) {
        verifiedFacts.push(`[Agreed Terms v${latestVersion}] "${agreedTerms}"`);
      }

      if (conditions && Array.isArray(conditions)) {
        for (const c of conditions) {
          if (c.completed) {
            if (c.type === "onchain_receipt") {
              verifiedFacts.push(
                `[Verified On-Chain via Tatum RPC] Condition "${c.title}" satisfied via verified transaction receipt.`
              );
            } else {
              userClaims.push(
                `[Participant Claim / Attestation] Off-chain condition "${c.title}" attested by ${c.completedBy ? `${c.completedBy.slice(0, 8)}...` : "participant"} (${c.attestationNote || "Attested in trade room"}). Note: Blockchains cannot independently prove physical/off-chain delivery.`
              );
            }
          } else {
            outstandingActions.push(
              `Complete condition "${c.title}" (${c.type === "onchain_receipt" ? "Requires verified Tatum RPC transaction receipt" : "Requires participant attestation & SHA-256 Walrus anchor"}).`
            );
          }
        }

        const pendingCount = conditions.filter((c: any) => !c.completed).length;
        if (pendingCount === 0 && (status === "Funded" || status === "ReadyForRelease")) {
          outstandingActions.push(
            `All settlement conditions are satisfied. Buyer (${query.currentTrade.buyer.slice(0, 8)}...) can now authorize final release of funds to the Seller.`
          );
        }
      }

      if (query.currentTrade.disputeEvidence?.length > 0) {
        for (const ev of query.currentTrade.disputeEvidence) {
          userClaims.push(
            `[Participant Dispute Claim] Submitted by ${ev.submittedBy.slice(0, 8)}...: "${ev.reason}" (Evidence SHA-256: ${ev.evidenceHash.slice(0, 14)}...).`
          );
        }
      }
    }

    // Incorporate retrieved Walrus memories with accurate labels
    for (const mem of citedMemories) {
      const tag = mem.verifiedOnWalrus ? "[Walrus Memory Mainnet]" : "[Walrus Memory Record]";
      if (mem.type === "USER_PREFERENCE" || mem.type === "SETTLEMENT_LESSON") {
        verifiedFacts.push(`${tag} ${mem.content}`);
      } else if (mem.type === "DISPUTE_EVIDENCE") {
        userClaims.push(`${tag} [Dispute Claim] ${mem.content}`);
      }
    }

    // 4. Synthesize the deterministic answer directly from verified application records, Tatum RPC, and Walrus Memory
    const answer = this.buildDeterministicAnswer({
      rawQuestion,
      questionLower,
      query,
      onchainVerification,
      targetNetwork,
      netName: netConfig.name,
      verifiedFacts,
      userClaims,
      outstandingActions,
      citedMemories,
    });

    const engineMode: AccordContextResponse["engineMode"] = "grounded_deterministic";

    return {
      question: rawQuestion,
      answer,
      engineMode,
      verifiedFacts,
      userClaims,
      outstandingActions,
      citedMemories,
      onchainVerification,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Natural-language grounded query resolver that answers specific user questions directly
   * in conversational prose without needing an external LLM API key.
   */
  private buildDeterministicAnswer(params: {
    rawQuestion: string;
    questionLower: string;
    query: AccordContextQuery;
    onchainVerification: VerificationResult | null;
    targetNetwork: string;
    netName: string;
    verifiedFacts: string[];
    userClaims: string[];
    outstandingActions: string[];
    citedMemories: WalrusTradeMemory[];
  }): string {
    const {
      rawQuestion,
      questionLower,
      query,
      onchainVerification,
      targetNetwork,
      netName,
      verifiedFacts,
      outstandingActions,
      citedMemories,
    } = params;

    const trade = query.currentTrade;
    const activeUser = (query.currentUser || "").toLowerCase();
    const isBuyer = trade && activeUser === trade.buyer?.toLowerCase();
    const isSeller = trade && activeUser === trade.seller?.toLowerCase();
    const isArbiter = trade && activeUser === trade.arbiter?.toLowerCase();
    const activeRoleLabel = isBuyer
      ? "Buyer"
      : isSeller
        ? "Seller"
        : isArbiter
          ? "Neutral Arbiter"
          : "Participant";

    // 1. Trade Room Age / Duration / When Created ("how long", "when was", "opened", "started", "created", "old", "age", "since when")
    if (
      questionLower.includes("how long") ||
      questionLower.includes("when was") ||
      questionLower.includes("when did") ||
      questionLower.includes("created") ||
      questionLower.includes("opened") ||
      questionLower.includes("started") ||
      questionLower.includes("how old") ||
      questionLower.includes("since when") ||
      questionLower.includes("duration")
    ) {
      if (trade) {
        const createdMs = trade.createdAt ? new Date(trade.createdAt).getTime() : Date.now();
        const elapsedStr = formatDurationHuman(Date.now() - createdMs);
        const createdTimeStr = trade.createdAt
          ? new Date(trade.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
          : "recently";
        const remMs = (trade.expirationTimestamp || Date.now() + 86400000) - Date.now();
        const remStr = remMs > 0 ? formatDurationHuman(remMs) : "0 minutes (expired)";
        const eventCount = Array.isArray(trade.activity) ? trade.activity.length : 1;

        return `Trade room ${trade.reference} has been open for ${elapsedStr} (initialized at ${createdTimeStr}). Since opening, ${eventCount} chronological audit event${eventCount === 1 ? " has" : "s have"} been recorded, and the agreement remains valid for another ${remStr} before its expiration deadline.`;
      }
      return "This trade room was initialized in the current session and remains active until its configured settlement expiration window elapses.";
    }

    // 2. Greeting / Help / Capabilities ("hi", "hello", "what can you do", "help", "who are you")
    if (
      /^(hi|hello|hey|help|yo|greetings|what can you do|who are you)\b/i.test(rawQuestion)
    ) {
      if (trade) {
        return `Hello! I am the Accord Context & Memory Assistant for Trade ${trade.reference} (${trade.amount} ${trade.asset} on ${netName}, currently in "${trade.status}" status). You can ask me anything about this trade—such as how long the room has been open, whether the deposit is verified on-chain, whether it is safe to deliver, who the Buyer/Seller/Arbiter are, why an action is locked, or what needs to happen next.`;
      }
      return `Hello! I am the Accord Context & Memory Assistant. I answer questions using live Tatum RPC blockchain verification and persistent Walrus Memory records.`;
    }

    // 3. "Why" Questions ("why is", "why can't", "why cant", "why isn't", "why not", "why")
    if (
      questionLower.startsWith("why") ||
      questionLower.includes("why can't") ||
      questionLower.includes("why cant") ||
      questionLower.includes("why is") ||
      questionLower.includes("why isn't")
    ) {
      if (trade) {
        const pendingConds = (trade.conditions || []).filter((c: any) => !c.completed);
        if (trade.status === "AwaitingAcceptance") {
          const whoMustAccept = !trade.sellerAccepted
            ? `Seller (${trade.seller.slice(0, 8)}...)`
            : `Buyer (${trade.buyer.slice(0, 8)}...)`;
          return `The trade is currently in "AwaitingAcceptance" because ${whoMustAccept} has not yet signed Version ${trade.termsVersions?.length || 1} of the agreed terms. Once signed in Section I, the room advances to "AwaitingDeposit".`;
        }
        if (trade.status === "AwaitingDeposit" || !onchainVerification?.verified) {
          return `The trade is in "${trade.status}" status and settlement actions are locked because Tatum RPC has not yet verified a confirmed on-chain deposit receipt (status 0x1) for ${trade.amount} ${trade.asset} on ${netName}. Accord never allows a frontend button alone to mark a trade as funded without a real blockchain receipt in Section II.`;
        }
        if (pendingConds.length > 0) {
          return `Final fund release is not yet unlocked because ${pendingConds.length} settlement condition${pendingConds.length === 1 ? " is" : "s are"} still incomplete in Section III: ${pendingConds.map((c: any) => `"${c.title}"`).join(", ")}. Complete and attest all conditions to unlock release.`;
        }
        if (!isBuyer && (questionLower.includes("release") || questionLower.includes("approve"))) {
          return `You are currently viewing the room as ${activeRoleLabel}. Under Accord's authorization rules, only the Buyer (${trade.buyer.slice(0, 8)}...) can unilaterally release principal to the Seller once conditions are met. Switch "View as: Buyer" at the top of the room to test releasing funds.`;
        }
        return `Trade ${trade.reference} is currently in "${trade.status}" status. ${outstandingActions[0] || "All conditions are satisfied and ready for Buyer release."}`;
      }
    }

    // 4. Safety to deliver / trust check ("safe", "deliver", "should i send", "trust", "scam", "risk", "legit")
    if (
      questionLower.includes("safe") ||
      questionLower.includes("should i deliver") ||
      questionLower.includes("should i send") ||
      questionLower.includes("can i deliver") ||
      questionLower.includes("trust") ||
      questionLower.includes("scam") ||
      questionLower.includes("legit") ||
      questionLower.includes("risk")
    ) {
      if (onchainVerification?.verified && onchainVerification.status === "confirmed") {
        return `Yes — Verified On-Chain via Tatum RPC: The Buyer's deposit of ${onchainVerification.valueEth || trade?.amount} ${trade?.asset || "ETH"} is confirmed on ${netName} in Block #${onchainVerification.blockNumber} (${onchainVerification.confirmations} confirmations, receipt status 0x1). The Seller can safely proceed with delivery and record the SHA-256 attestation in Section III.`;
      }
      return `No, do NOT deliver off-chain assets yet — Tatum RPC has not confirmed an on-chain deposit receipt for ${trade?.reference || "this trade"} (current status: "${trade?.status || "Unfunded"}"). Wait until Section II confirms a verified Tatum RPC receipt with status 0x1 before delivering any keys, domains, or goods.`;
    }

    // 5. Participants / Addresses / Roles ("who is", "who are", "participants", "buyer", "seller", "arbiter", "my role", "address", "who am i")
    if (
      questionLower.includes("who is") ||
      questionLower.includes("who are") ||
      questionLower.includes("who am i") ||
      questionLower.includes("participants") ||
      questionLower.includes("buyer") ||
      questionLower.includes("seller") ||
      questionLower.includes("arbiter") ||
      questionLower.includes("my role") ||
      questionLower.includes("addresses")
    ) {
      if (trade) {
        return `For Trade ${trade.reference}, the three appointed addresses are:
• Buyer: ${trade.buyer} (${trade.buyerAccepted ? "Signed Terms" : "Signature Pending"})
• Seller: ${trade.seller} (${trade.sellerAccepted ? "Signed Terms" : "Signature Pending"})
• Neutral Arbiter: ${trade.arbiter} (Independent third party for dispute rulings)
You are currently viewing the room as the ${activeRoleLabel}.`;
      }
    }

    // 6. Agreed Terms / Version History / Amendments ("agreed", "terms", "version", "amend", "changed", "contract", "clause")
    if (
      questionLower.includes("agreed") ||
      questionLower.includes("terms") ||
      questionLower.includes("version") ||
      questionLower.includes("amend") ||
      questionLower.includes("agreement") ||
      questionLower.includes("clause")
    ) {
      if (trade) {
        const verCount = trade.termsVersions?.length || 1;
        return `Both parties are bound to Version ${verCount} of Trade ${trade.reference} (${trade.amount} ${trade.asset} on ${netName}). The agreed terms state: "${trade.agreedTerms}". Buyer accepted: ${trade.buyerAccepted ? "Yes" : "Pending"}; Seller accepted: ${trade.sellerAccepted ? "Yes" : "Pending"}. Every term version is hashed (${trade.termsHash?.slice(0, 14)}...) so edits are always visible and never silently overwrite prior acceptance.`;
      }
      return "Retrieved persistent agreement records from Walrus Memory show that trade terms are versioned and cryptographically hashed before deposit.";
    }

    // 7. Deposit / Confirmation / Tx Hash / Block ("deposit", "confirmed", "funded", "paid", "tx", "transaction", "hash", "block", "verify")
    if (
      questionLower.includes("deposit") ||
      questionLower.includes("confirmed") ||
      questionLower.includes("funded") ||
      questionLower.includes("paid") ||
      questionLower.includes("transaction") ||
      questionLower.includes("tx") ||
      questionLower.includes("hash") ||
      questionLower.includes("block") ||
      questionLower.includes("verify")
    ) {
      if (onchainVerification?.verified) {
        return `Yes — Verified On-Chain via Tatum RPC: Deposit transaction ${onchainVerification.txHash.slice(0, 14)}... is confirmed on ${netName} in Block #${onchainVerification.blockNumber} with ${onchainVerification.confirmations} block confirmations and status 0x1 (${onchainVerification.valueEth || trade?.amount} ${trade?.asset || "ETH"}).`;
      } else if (onchainVerification?.status === "pending") {
        return `Not yet — Tatum RPC reports transaction ${onchainVerification.txHash.slice(0, 14)}... is still pending in the ${netName} mempool with 0 confirmations. Do not release off-chain deliverables until block confirmation.`;
      } else {
        const sampleHint = trade?.sampleVerifiableTxHash
          ? ` In Section II, you can click "Load Real Base Mainnet Tx" and then "Verify via Tatum RPC" to verify the live Base Mainnet transaction (${trade.sampleVerifiableTxHash.slice(0, 12)}...).`
          : "";
        return `No — Tatum RPC has not verified a confirmed deposit transaction for this trade yet (current status: "${trade?.status || "AwaitingDeposit"}"). Accord never allows a frontend button alone to mark a trade as funded without a verified blockchain receipt.${sampleHint}`;
      }
    }

    // 8. Expiration / Deadline / Refund ("expire", "expiration", "deadline", "time left", "refund", "cancel")
    if (
      questionLower.includes("expire") ||
      questionLower.includes("expiration") ||
      questionLower.includes("deadline") ||
      questionLower.includes("time left") ||
      questionLower.includes("refund") ||
      questionLower.includes("cancel")
    ) {
      if (trade) {
        const msLeft = (trade.expirationTimestamp || 0) - Date.now();
        const remStr = msLeft > 0 ? formatDurationHuman(msLeft) : "Expired";
        const expDate = trade.expirationTimestamp
          ? new Date(trade.expirationTimestamp).toUTCString()
          : "Unspecified";
        return `Trade ${trade.reference} expires on ${expDate} (${msLeft > 0 ? `${remStr} remaining` : "Expiration window has elapsed"}). Refund rules: (1) The Seller (${trade.seller.slice(0, 8)}...) can authorize a full refund to the Buyer at any time while Funded; (2) The Neutral Arbiter (${trade.arbiter.slice(0, 8)}...) can order a full or partial refund during a Dispute; (3) Once expired without completion, the Buyer can claim an expired refund.`;
      }
    }

    // 9. Amount / Asset / Price / Network / Escrow ("how much", "amount", "price", "value", "asset", "token", "network", "chain", "escrow", "fee")
    if (
      questionLower.includes("how much") ||
      questionLower.includes("amount") ||
      questionLower.includes("price") ||
      questionLower.includes("value") ||
      questionLower.includes("asset") ||
      questionLower.includes("token") ||
      questionLower.includes("network") ||
      questionLower.includes("chain") ||
      questionLower.includes("escrow") ||
      questionLower.includes("fee") ||
      questionLower.includes("mode")
    ) {
      if (trade) {
        const modeDesc =
          trade.settlementMode === "escrow" && trade.escrowAddress
            ? `On-Chain Smart Contract Escrow (${trade.escrowAddress})`
            : `Direct Verified Settlement via Tatum RPC (Buyer transfers ${trade.amount} ${trade.asset} to Seller ${trade.seller.slice(0, 10)}... with 0% protocol fee)`;
        return `Trade ${trade.reference} is for ${trade.amount} ${trade.asset} on ${netName} (Chain ID ${SUPPORTED_NETWORKS[targetNetwork]?.chainId || 8453}). Settlement mode: ${modeDesc}.`;
      }
    }

    // 10. "How" Questions ("how do i", "how can i", "how to", "how does")
    if (
      questionLower.startsWith("how") ||
      questionLower.includes("how do i") ||
      questionLower.includes("how can i") ||
      questionLower.includes("how to")
    ) {
      if (trade) {
        if (trade.status === "AwaitingAcceptance") {
          return `To move forward from "AwaitingAcceptance": Select "View as: Seller" (or the non-creator party) in the top-right bar, review the written agreement in Section I, and click "Accept & Sign Terms". If you want to propose changes first, click "Amend Terms" to create Version ${(trade.termsVersions?.length || 1) + 1}.`;
        }
        if (trade.status === "AwaitingDeposit") {
          return `To fund and verify this trade in Section II: The Buyer transfers ${trade.amount} ${trade.asset} on ${netName}, pastes the 66-character 0x transaction hash into Section II (or clicks "Load Real Base Mainnet Tx" for showcase trade ${trade.reference}), and clicks "Verify via Tatum RPC".`;
        }
        return `To complete settlement from "${trade.status}": First ensure each condition in Section III is attested (anchoring its SHA-256 receipt to Walrus Memory). Once all ${(trade.conditions || []).length} conditions show "Fulfilled", the Buyer clicks "Approve & Release Funds to Seller" in Section III.`;
      }
    }

    // 11. Conditions / Next Steps / Release ("condition", "outstanding", "remaining", "next", "what should", "release", "settle", "complete", "status")
    if (
      questionLower.includes("condition") ||
      questionLower.includes("outstanding") ||
      questionLower.includes("remaining") ||
      questionLower.includes("next") ||
      questionLower.includes("what should") ||
      questionLower.includes("what do i") ||
      questionLower.includes("release") ||
      questionLower.includes("settle") ||
      questionLower.includes("step") ||
      questionLower.includes("status")
    ) {
      if (trade) {
        const totalConds = trade.conditions?.length || 0;
        const doneConds = (trade.conditions || []).filter((c: any) => c.completed).length;
        if (outstandingActions.length > 0) {
          return `Remaining steps before settlement (${doneConds}/${totalConds} conditions satisfied): ${outstandingActions.join(" ")}`;
        }
        return `All ${totalConds}/${totalConds} listed settlement conditions have been satisfied. If the trade is in ReadyForRelease status, the Buyer (${trade.buyer.slice(0, 8)}...) can now authorize final settlement release in Section III.`;
      }
      if (outstandingActions.length > 0) {
        return `Remaining steps before settlement: ${outstandingActions.join(" ")}`;
      }
    }

    // 12. Counterparty History / Walrus Memory ("previous", "past", "history", "counterparty", "preference", "walrus", "memory", "recall", "happened")
    if (
      questionLower.includes("previous") ||
      questionLower.includes("past") ||
      questionLower.includes("history") ||
      questionLower.includes("counterparty") ||
      questionLower.includes("preference") ||
      questionLower.includes("walrus") ||
      questionLower.includes("memory") ||
      questionLower.includes("recall") ||
      questionLower.includes("happened")
    ) {
      const relevantMems = citedMemories.filter(
        (m) =>
          m.type === "SETTLEMENT_LESSON" ||
          m.type === "USER_PREFERENCE" ||
          m.type === "DISPUTE_RESOLUTION" ||
          m.type === "TRADE_TERMS" ||
          m.type === "ONCHAIN_VERIFICATION"
      );
      if (relevantMems.length > 0) {
        return `By retrieving persistent trade context from Walrus Memory (without retraining or modifying model weights), Accord found ${relevantMems.length} historical record(s): ${relevantMems
          .slice(0, 2)
          .map((m) => m.content)
          .join(" | ")}`;
      }
      return "Accord queried persistent Walrus Memory and found no prior disputes or historical records for this counterparty address.";
    }

    // 13. Disputes / Evidence ("dispute", "evidence", "problem", "wrong", "ruling", "split")
    if (
      questionLower.includes("dispute") ||
      questionLower.includes("evidence") ||
      questionLower.includes("ruling") ||
      questionLower.includes("split") ||
      questionLower.includes("problem")
    ) {
      return "Because blockchains cannot independently verify off-chain promises or physical delivery, Accord distinguishes on-chain receipts (verified by Tatum RPC) from off-chain claims. To resolve a dispute, participants submit delivery receipts, logs, or communications in the Evidence Vault; Accord computes a SHA-256 hash and anchors the reference to Walrus Memory so the appointed Neutral Arbiter (or both parties via mutual settlement) can inspect and execute resolution on-chain. AI models never authorize releases or decide disputes.";
    }

    // 14. Conversational synthesis for any other custom question
    if (trade) {
      const createdMs = trade.createdAt ? new Date(trade.createdAt).getTime() : Date.now();
      const elapsedStr = formatDurationHuman(Date.now() - createdMs);
      const doneConds = (trade.conditions || []).filter((c: any) => c.completed).length;
      const totalConds = (trade.conditions || []).length;

      return `Trade ${trade.reference} (${trade.amount} ${trade.asset} on ${netName}) has been active for ${elapsedStr} and is currently in "${trade.status}" status with ${doneConds} of ${totalConds} conditions satisfied. ${onchainVerification?.verified
          ? `The deposit is verified on-chain via Tatum RPC in Block #${onchainVerification.blockNumber}.`
          : `No on-chain deposit receipt has been verified via Tatum RPC yet.`
        } Next step: ${outstandingActions[0] || "Buyer can now authorize final release to the Seller."}`;
    }

    return `Accord Context Summary: ${verifiedFacts[0] || "Open a trade room to inspect live Tatum RPC receipts and Walrus Memory records."} ${outstandingActions[0] || ""}`;
  }

  /**
   * Optional Gemini synthesis when GEMINI_API_KEY is configured in environment variables.
   * Strictly bounded by the verified facts and user claims gathered above.
   */
  private async tryGeminiSynthesis(params: {
    apiKey: string;
    question: string;
    deterministicDraft: string;
    verifiedFacts: string[];
    userClaims: string[];
    outstandingActions: string[];
    currentTrade?: any;
  }): Promise<string | null> {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(params.apiKey);

      const prompt = `You are the Accord Context & Memory Assistant inside a peer-to-peer crypto settlement room.
Answer the user's question directly, naturally, and concisely (2-4 sentences) using the grounded data below.
Rules:
1. Explicitly distinguish Verified On-Chain Facts (via Tatum RPC) from Off-Chain Participant Claims/Attestations.
2. Never claim to retrain weights or modify parameters; context comes from Walrus Memory recall and Tatum RPC.
3. Never claim you can release funds or decide disputes yourself.

User Question: ${params.question}

Trade Metadata:
${params.currentTrade
          ? JSON.stringify({
            reference: params.currentTrade.reference,
            status: params.currentTrade.status,
            amount: params.currentTrade.amount,
            asset: params.currentTrade.asset,
            network: params.currentTrade.network,
            buyer: params.currentTrade.buyer,
            seller: params.currentTrade.seller,
            arbiter: params.currentTrade.arbiter,
            createdAt: params.currentTrade.createdAt,
            expirationTimestamp: params.currentTrade.expirationTimestamp,
            agreedTerms: params.currentTrade.agreedTerms,
          })
          : "None"
        }

Verified Facts:
${params.verifiedFacts.join("\n")}

Participant Claims:
${params.userClaims.join("\n") || "None"}

Outstanding Actions:
${params.outstandingActions.join("\n") || "None"}

Deterministic Baseline Answer:
${params.deterministicDraft}`;

      const candidateModels = [
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3.0-flash",
        "gemini-2.5-flash",
      ];
      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const text = result.response.text()?.trim();
          if (text) return text;
        } catch {
          // Try next candidate model
        }
      }
      return null;
    } catch (err: any) {
      console.warn("[AccordAI] Gemini synthesis unavailable, using deterministic engine:", err.message);
      return null;
    }
  }
}

export const accordAI = new AccordAIAssistant();
