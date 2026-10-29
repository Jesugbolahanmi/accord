/**
 * Accord - Context Assistant & Memory Intelligence Engine
 *
 * Answers practical trade and settlement questions strictly grounded in:
 * 1. Verified Tatum RPC on-chain transaction data (`[Verified On-Chain via Tatum RPC]`)
 * 2. Persistent memories retrieved from Walrus Memory (`[Walrus Memory Mainnet]` / `[Walrus Memory Record]`)
 * 3. Participant-submitted attestations and claims (`[Participant Claim / Attestation]`)
 *
 * Works out-of-the-box with zero external LLM API keys via a comprehensive deterministic
 * trade-intelligence engine, and optionally enhances prose synthesis via Gemini
 * (`GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`) when configured.
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

    // 4. Synthesize the answer (Deterministic Grounded Engine first, plus optional Gemini synthesis if key is configured)
    let answer = this.buildDeterministicAnswer({
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

    let engineMode: AccordContextResponse["engineMode"] = "grounded_deterministic";
    const geminiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ""
    ).trim();

    if (geminiKey) {
      const llmAnswer = await this.tryGeminiSynthesis({
        apiKey: geminiKey,
        question: rawQuestion,
        deterministicDraft: answer,
        verifiedFacts,
        userClaims,
        outstandingActions,
        currentTrade: query.currentTrade,
      });
      if (llmAnswer) {
        answer = llmAnswer;
        engineMode = "gemini_grounded";
      }
    }

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
   * Comprehensive, zero-API-key deterministic query resolver that answers natural-language
   * questions about the trade, participants, safety, verification, conditions, Walrus memory,
   * expiration, refunds, disputes, and next steps.
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
      userClaims,
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
      : "Observer";

    // 1. Greeting / Help / Capabilities ("hi", "hello", "what can you do", "help", "who are you")
    if (
      /^(hi|hello|hey|help|yo|greetings|what can you do|who are you|how does this work)\b/i.test(
        rawQuestion
      )
    ) {
      if (trade) {
        return `I am the Accord Context & Memory Assistant for Trade ${trade.reference} (${trade.amount} ${trade.asset} on ${netName}, currently "${trade.status}"). I operate without needing an external LLM API key by directly querying the server-side agreement ledger, live Tatum RPC blockchain receipts, and Walrus Memory records. You can ask me: (1) what the agreed terms or version hashes are, (2) whether the deposit is verified on-chain, (3) whether it is safe for the Seller to deliver, (4) who the Buyer/Seller/Arbiter are, (5) when the trade expires, or (6) what needs to happen next.`;
      }
      return `I am the Accord Context & Memory Assistant. I answer questions using live Tatum RPC blockchain verification and persistent Walrus Memory records, strictly separating on-chain facts from off-chain participant claims.`;
    }

    // 2. Safety to deliver / trust check ("safe", "deliver", "should i send", "trust", "scam", "risk")
    if (
      questionLower.includes("safe") ||
      questionLower.includes("should i deliver") ||
      questionLower.includes("should i send") ||
      questionLower.includes("can i deliver") ||
      questionLower.includes("trust") ||
      questionLower.includes("risk")
    ) {
      if (onchainVerification?.verified && onchainVerification.status === "confirmed") {
        return `Yes — Verified On-Chain via Tatum RPC: The Buyer's deposit of ${onchainVerification.valueEth || trade?.amount} ${trade?.asset || "ETH"} is confirmed on ${netName} in Block #${onchainVerification.blockNumber} (${onchainVerification.confirmations} confirmations, receipt status 0x1). The Seller can now proceed with the agreed delivery and record the SHA-256 attestation in Section III.`;
      }
      return `Do NOT deliver off-chain assets yet — Tatum RPC has not confirmed an on-chain deposit receipt for ${trade?.reference || "this trade"} (current status: "${trade?.status || "Unfunded"}"). Wait until Section II shows a verified Tatum RPC receipt with status 0x1 and block confirmations before delivering any keys, domains, or goods.`;
    }

    // 3. Participants / Addresses / Roles ("who is", "buyer", "seller", "arbiter", "participants", "my role", "address")
    if (
      questionLower.includes("who is") ||
      questionLower.includes("who are") ||
      questionLower.includes("participants") ||
      questionLower.includes("buyer") ||
      questionLower.includes("seller") ||
      questionLower.includes("arbiter") ||
      questionLower.includes("my role") ||
      questionLower.includes("addresses")
    ) {
      if (trade) {
        return `Participants for Trade ${trade.reference}:
• Buyer: ${trade.buyer} (${trade.buyerAccepted ? "Signed Terms" : "Signature Pending"})
• Seller: ${trade.seller} (${trade.sellerAccepted ? "Signed Terms" : "Signature Pending"})
• Neutral Arbiter: ${trade.arbiter} (Independent third party for dispute rulings)
• Your current perspective: ${activeRoleLabel}${activeUser ? ` (${activeUser.slice(0, 10)}...)` : ""}.`;
      }
    }

    // 4. Agreed Terms / Version History / Amendments ("agreed", "terms", "version", "amend", "changed", "contract")
    if (
      questionLower.includes("agreed") ||
      questionLower.includes("terms") ||
      questionLower.includes("version") ||
      questionLower.includes("amend") ||
      questionLower.includes("agreement")
    ) {
      if (trade) {
        const verCount = trade.termsVersions?.length || 1;
        return `Both parties are bound to Version ${verCount} of Trade ${trade.reference} (${trade.amount} ${trade.asset} on ${netName}). Agreed terms: "${trade.agreedTerms}". Buyer accepted: ${trade.buyerAccepted ? "Yes" : "Pending"}; Seller accepted: ${trade.sellerAccepted ? "Yes" : "Pending"}. Terms SHA-256 hash: ${trade.termsHash?.slice(0, 18)}... (any edit creates Version ${verCount + 1} and resets counterparty acceptance so terms can never be silently overwritten).`;
      }
      return "Retrieved persistent agreement records from Walrus Memory show that trade terms are versioned and cryptographically hashed before deposit.";
    }

    // 5. Deposit / Confirmation / Tx Hash / Block ("deposit", "confirmed", "funded", "paid", "tx", "transaction", "hash", "block")
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
        return `Yes — Verified On-Chain via Tatum RPC: Deposit transaction ${onchainVerification.txHash} is confirmed on ${netName} in Block #${onchainVerification.blockNumber} with ${onchainVerification.confirmations} block confirmations and status 0x1 (${onchainVerification.valueEth || trade?.amount} ${trade?.asset || "ETH"} from ${onchainVerification.from?.slice(0, 10)}... to ${onchainVerification.to?.slice(0, 10)}...).`;
      } else if (onchainVerification?.status === "pending") {
        return `Not yet — Tatum RPC reports transaction ${onchainVerification.txHash} is currently pending in the ${netName} mempool with 0 confirmations. Wait for block inclusion before fulfilling off-chain deliverables.`;
      } else {
        const sampleHint = trade?.sampleVerifiableTxHash
          ? ` For this showcase trade, you can click "Load Real Base Mainnet Tx" in Section II (${trade.sampleVerifiableTxHash.slice(0, 14)}...) and click "Verify via Tatum RPC" to verify the live Base Mainnet receipt.`
          : "";
        return `No — Tatum RPC has not verified a confirmed deposit transaction for ${trade?.reference || "this trade"} yet (current status: "${trade?.status || "AwaitingDeposit"}"). Accord never allows a frontend button alone to mark a trade as funded without a verified blockchain receipt.${sampleHint}`;
      }
    }

    // 6. Expiration / Deadline / Refund ("expire", "expiration", "deadline", "time left", "when does", "refund")
    if (
      questionLower.includes("expire") ||
      questionLower.includes("expiration") ||
      questionLower.includes("deadline") ||
      questionLower.includes("time") ||
      questionLower.includes("refund")
    ) {
      if (trade) {
        const msLeft = (trade.expirationTimestamp || 0) - Date.now();
        const hoursLeft = Math.max(0, Math.round(msLeft / (1000 * 60 * 60)));
        const expDate = trade.expirationTimestamp
          ? new Date(trade.expirationTimestamp).toUTCString()
          : "Unspecified";
        return `Trade ${trade.reference} expires on ${expDate} (${hoursLeft > 0 ? `~${hoursLeft} hours remaining` : "Expiration window elapsed"}). Refund rules: (1) The Seller (${trade.seller.slice(0, 8)}...) can authorize a full refund to the Buyer at any time while Funded; (2) The Neutral Arbiter (${trade.arbiter.slice(0, 8)}...) can order a full or partial refund during a Dispute; (3) Once the expiration timestamp passes without completion or active dispute, the Buyer can claim an expired refund.`;
      }
    }

    // 7. Amount / Asset / Network / Escrow ("how much", "amount", "asset", "token", "network", "chain", "escrow", "fee")
    if (
      questionLower.includes("how much") ||
      questionLower.includes("amount") ||
      questionLower.includes("asset") ||
      questionLower.includes("token") ||
      questionLower.includes("network") ||
      questionLower.includes("chain") ||
      questionLower.includes("escrow") ||
      questionLower.includes("mode")
    ) {
      if (trade) {
        const modeDesc =
          trade.settlementMode === "escrow" && trade.escrowAddress
            ? `On-Chain Smart Contract Escrow (${trade.escrowAddress})`
            : `Direct Peer-to-Peer Settlement verified via Tatum RPC (Buyer transfers directly to Seller ${trade.seller.slice(0, 10)}...)`;
        return `Trade ${trade.reference} specifies a principal of ${trade.amount} ${trade.asset} on ${netName} (Chain ID ${SUPPORTED_NETWORKS[targetNetwork]?.chainId || 8453}). Settlement mode: ${modeDesc}.`;
      }
    }

    // 8. Conditions / Next Steps / Release ("condition", "outstanding", "remaining", "next", "what should i do", "release", "settle", "complete")
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
          return `Current status is "${trade.status}" (${doneConds}/${totalConds} conditions satisfied). Viewing as ${activeRoleLabel}, the remaining steps before final settlement are: ${outstandingActions.join(" ")}`;
        }
        return `All ${totalConds}/${totalConds} settlement conditions are satisfied and the deposit is verified. The Buyer (${trade.buyer.slice(0, 8)}...) can now click "Approve & Release Funds to Seller" in Section III to complete settlement.`;
      }
    }

    // 9. Counterparty History / Walrus Memory ("previous", "past", "history", "counterparty", "preference", "walrus", "memory", "recall")
    if (
      questionLower.includes("previous") ||
      questionLower.includes("past") ||
      questionLower.includes("history") ||
      questionLower.includes("counterparty") ||
      questionLower.includes("preference") ||
      questionLower.includes("walrus") ||
      questionLower.includes("memory") ||
      questionLower.includes("recall")
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
        return `By retrieving persistent trade context from Walrus Memory (without retraining or modifying model weights), Accord recalled ${relevantMems.length} relevant record(s): ${relevantMems
          .slice(0, 3)
          .map((m) => `[${m.type}] ${m.content}`)
          .join(" | ")}`;
      }
      return "Accord queried persistent Walrus Memory and found no prior disputes or adverse records for this counterparty address.";
    }

    // 10. Disputes / Evidence ("dispute", "evidence", "problem", "wrong", "cheat", "ruling", "split")
    if (
      questionLower.includes("dispute") ||
      questionLower.includes("evidence") ||
      questionLower.includes("ruling") ||
      questionLower.includes("split") ||
      questionLower.includes("problem")
    ) {
      const activeDisputes = trade?.disputeEvidence?.length || 0;
      return `Because blockchains cannot independently prove off-chain promises or physical delivery, Accord separates Tatum RPC on-chain receipts from off-chain participant claims. ${
        activeDisputes > 0
          ? `There ${activeDisputes === 1 ? "is 1 active dispute claim" : `are ${activeDisputes} active dispute claims`} logged on this trade. `
          : ""
      }To resolve a dispute in Section III: (1) Either party submits delivery logs or checksums to the Evidence Vault (anchored via SHA-256 to Walrus Memory); (2) Both parties can execute a 50/50 Mutual Settlement, OR the appointed Neutral Arbiter (${trade?.arbiter?.slice(0, 10) || "Arbiter"}...) can issue a binding basis-point split ruling. AI never decides disputes or moves funds.`;
    }

    // 11. General / Open-Ended Question Synthesis: match any terms in the question against the trade & activity log
    if (trade) {
      const doneConds = (trade.conditions || []).filter((c: any) => c.completed).length;
      const totalConds = (trade.conditions || []).length;
      const latestActivity =
        trade.activity && trade.activity.length > 0
          ? trade.activity[trade.activity.length - 1]
          : null;

      return `For your question ("${rawQuestion}") on Trade ${trade.reference} (${trade.amount} ${trade.asset} on ${netName}):
• Current Status: ${trade.status} (${doneConds}/${totalConds} conditions satisfied; Deposit verified on-chain: ${onchainVerification?.verified ? `Yes, Block #${onchainVerification.blockNumber}` : "Not yet"}).
• Agreed Terms (v${trade.termsVersions?.length || 1}): "${trade.agreedTerms}"
• Latest Recorded Event: ${latestActivity ? `${latestActivity.title} — ${latestActivity.description}` : "Trade initialized."}
• Next Required Action: ${outstandingActions[0] || "All conditions met; Buyer may authorize release."}`;
    }

    return `Accord Context Summary: ${verifiedFacts[0] || "Select a trade room to inspect live Tatum RPC receipts and Walrus Memory records."} ${outstandingActions[0] || ""}`;
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
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `You are the Accord Context & Memory Assistant inside a peer-to-peer crypto settlement room.
Answer the user's question concisely (2-4 sentences) using ONLY the grounded data below.
Rules:
1. Explicitly distinguish Verified On-Chain Facts (via Tatum RPC) from Off-Chain Participant Claims/Attestations.
2. Never claim to retrain weights or modify parameters; context comes from Walrus Memory recall and Tatum RPC.
3. Never claim you can release funds or decide disputes yourself.

User Question: ${params.question}

Verified Facts:
${params.verifiedFacts.join("\n")}

Participant Claims:
${params.userClaims.join("\n") || "None"}

Outstanding Actions:
${params.outstandingActions.join("\n") || "None"}

Deterministic Baseline Answer:
${params.deterministicDraft}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text()?.trim();
      return text || null;
    } catch (err: any) {
      console.warn("[AccordAI] Gemini synthesis unavailable, using deterministic engine:", err.message);
      return null;
    }
  }
}

export const accordAI = new AccordAIAssistant();
