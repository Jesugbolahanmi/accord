/**
 * Accord - Context Assistant & Memory Intelligence Engine
 *
 * Answers practical trade and settlement questions strictly grounded in:
 * 1. Verified Tatum RPC on-chain transaction data (`[Verified On-Chain via Tatum RPC]`)
 * 2. Persistent memories retrieved from Walrus Memory (`[Walrus Memory Mainnet]` / `[Walrus Memory Record]`)
 * 3. Participant-submitted attestations and claims (`[Participant Claim / Attestation]`)
 *
 * Security & Epistemic Rules:
 * - Explicitly separates verified on-chain facts from participant-submitted claims.
 * - Never claims the AI has retrained itself or modified model weights; Accord provides
 *   context-aware assistance by retrieving persistent memories and verified RPC state.
 * - Never authorizes fund releases, signs transactions, or decides disputes.
 */

import { walrusMemory, WalrusTradeMemory } from "../walrus/memory";
import { tatum, VerificationResult } from "../tatum/client";

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
  answer: string;
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
    const questionLower = query.question.toLowerCase();

    // 1. Retrieve persistent memories from Walrus Memory
    const memoryRecall = await walrusMemory.recall({
      query: query.question,
      tradeRef: query.tradeRef || query.currentTrade?.reference,
      participant: query.counterparty || query.currentUser,
      limit: 6,
    });

    const citedMemories = memoryRecall.memories;

    // 2. Perform Tatum RPC verification if a txHash is provided or already verified on the trade
    let onchainVerification: VerificationResult | null = query.currentTrade?.verification || null;
    const targetTx = query.txHash || query.currentTrade?.txHash;
    const targetNetwork = query.network || query.currentTrade?.network || "base-mainnet";

    if (!onchainVerification && targetTx && targetTx.startsWith("0x") && targetTx.length === 66) {
      try {
        onchainVerification = await tatum.verifyTransaction(targetTx, targetNetwork, {
          from: query.currentTrade?.buyer,
          allowedRecipients: [
            query.currentTrade?.escrowAddress,
            query.currentTrade?.seller,
          ].filter(Boolean),
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
          `[Verified On-Chain via Tatum RPC] Transaction ${onchainVerification.txHash.slice(0, 10)}... confirmed in block ${onchainVerification.blockNumber} (${onchainVerification.confirmations} confirmations) on ${targetNetwork} with status 0x1 (${onchainVerification.valueEth || query.currentTrade?.amount || ""} ${query.currentTrade?.asset || "ETH"}).`
        );
      } else if (onchainVerification.status === "pending") {
        verifiedFacts.push(
          `[Verified On-Chain via Tatum RPC] Transaction ${onchainVerification.txHash.slice(0, 10)}... is pending in the mempool on ${targetNetwork} (0 confirmations).`
        );
        outstandingActions.push("Wait for the deposit transaction to be mined and confirmed by Tatum RPC.");
      } else if (onchainVerification.status === "reverted") {
        verifiedFacts.push(
          `[Verified On-Chain via Tatum RPC] Transaction ${onchainVerification.txHash.slice(0, 10)}... reverted on-chain (status 0x0). No funds were locked.`
        );
        outstandingActions.push("Buyer must submit a valid deposit transaction that succeeds on-chain.");
      }
    } else if (
      query.currentTrade?.status === "AwaitingDeposit" ||
      query.currentTrade?.status === "AwaitingAcceptance"
    ) {
      verifiedFacts.push(
        `[Verified Application State] No deposit transaction receipt has been verified on-chain via Tatum RPC for ${query.currentTrade?.reference || "this trade"} yet.`
      );
      if (query.currentTrade?.status === "AwaitingAcceptance") {
        outstandingActions.push("Counterparty must review and accept the current version of the agreed terms.");
      } else {
        outstandingActions.push(
          "Buyer must submit the deposit transaction on-chain and verify its receipt via Tatum RPC."
        );
      }
    }

    // Evaluate trade agreement & conditions
    if (query.currentTrade) {
      const { agreedTerms, termsVersions, conditions, status, amount, asset, buyerAccepted, sellerAccepted } =
        query.currentTrade;
      const latestVersion = Array.isArray(termsVersions) ? termsVersions.length : 1;

      verifiedFacts.push(
        `[Trade Agreement Record] Trade ${query.currentTrade.reference}: ${amount} ${asset} on ${targetNetwork} (Terms v${latestVersion}, Buyer accepted: ${buyerAccepted ? "Yes" : "No"}, Seller accepted: ${sellerAccepted ? "Yes" : "No"}).`
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
              `Complete outstanding condition: "${c.title}" (${c.type === "onchain_receipt" ? "Requires Tatum RPC receipt" : "Requires participant attestation"}).`
            );
          }
        }

        const pendingCount = conditions.filter((c: any) => !c.completed).length;
        if (pendingCount === 0 && (status === "Funded" || status === "ReadyForRelease")) {
          outstandingActions.push(
            "All settlement conditions are satisfied. Buyer can now authorize release of funds to the Seller."
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

    // 4. Construct grounded, concise response to the user's question
    let answer = "";

    if (questionLower.includes("agreed") || questionLower.includes("terms")) {
      if (query.currentTrade) {
        const verCount = query.currentTrade.termsVersions?.length || 1;
        answer = `Both parties are reviewing Version ${verCount} of Trade ${query.currentTrade.reference} for ${query.currentTrade.amount} ${query.currentTrade.asset} on ${targetNetwork}. The agreed terms state: "${query.currentTrade.agreedTerms}". Buyer accepted: ${query.currentTrade.buyerAccepted ? "Yes" : "Pending"}; Seller accepted: ${query.currentTrade.sellerAccepted ? "Yes" : "Pending"}. Every term version is hashed (${query.currentTrade.termsHash?.slice(0, 12)}...) so edits are always visible and never silently overwrite prior acceptance.`;
      } else {
        answer =
          "Retrieved persistent agreement records from Walrus Memory show that trade terms are versioned and cryptographically hashed before deposit.";
      }
    } else if (
      questionLower.includes("deposit") ||
      questionLower.includes("confirmed") ||
      questionLower.includes("funded")
    ) {
      if (onchainVerification?.verified) {
        answer = `Yes — Verified On-Chain via Tatum RPC: Deposit transaction ${onchainVerification.txHash.slice(0, 12)}... is confirmed on ${targetNetwork} in block ${onchainVerification.blockNumber} with ${onchainVerification.confirmations} block confirmations and status 0x1 (${onchainVerification.valueEth} ETH).`;
      } else if (onchainVerification?.status === "pending") {
        answer = `Not yet — Tatum RPC reports transaction ${onchainVerification.txHash.slice(0, 12)}... is still pending in the ${targetNetwork} mempool with 0 confirmations. Do not release off-chain deliverables until block confirmation.`;
      } else {
        answer = `No — Tatum RPC has not verified a confirmed deposit transaction for this trade yet (current status: "${query.currentTrade?.status || "AwaitingDeposit"}"). Accord never allows a frontend button alone to mark a trade as funded without a verified blockchain receipt.`;
      }
    } else if (
      questionLower.includes("condition") ||
      questionLower.includes("outstanding") ||
      questionLower.includes("remaining") ||
      questionLower.includes("next")
    ) {
      if (outstandingActions.length > 0) {
        answer = `Remaining steps before settlement: ${outstandingActions.join(" ")}`;
      } else {
        answer =
          "All listed settlement conditions have been satisfied. If the trade is in ReadyForRelease status, the Buyer can now authorize final settlement release.";
      }
    } else if (
      questionLower.includes("previous") ||
      questionLower.includes("past") ||
      questionLower.includes("history") ||
      questionLower.includes("counterparty") ||
      questionLower.includes("preference")
    ) {
      const relevantMems = citedMemories.filter(
        (m) =>
          m.type === "SETTLEMENT_LESSON" ||
          m.type === "USER_PREFERENCE" ||
          m.type === "DISPUTE_RESOLUTION" ||
          m.type === "TRADE_TERMS"
      );
      if (relevantMems.length > 0) {
        answer = `By retrieving persistent trade context from Walrus Memory (without retraining or modifying model weights), Accord found ${relevantMems.length} historical record(s): ${relevantMems
          .slice(0, 2)
          .map((m) => m.content)
          .join(" | ")}`;
      } else {
        answer =
          "Accord queried persistent Walrus Memory and found no prior disputes or historical records for this counterparty address.";
      }
    } else if (questionLower.includes("dispute") || questionLower.includes("evidence")) {
      answer =
        "Because blockchains cannot independently verify off-chain promises or physical delivery, Accord distinguishes on-chain receipts (verified by Tatum RPC) from off-chain claims. To resolve a dispute, participants submit delivery receipts, logs, or communications in the Evidence Vault; Accord computes a SHA-256 hash and anchors the reference to Walrus Memory so the appointed Neutral Arbiter (or both parties via mutual settlement) can inspect and execute resolution on-chain. AI models never authorize releases or decide disputes.";
    } else {
      answer = `Grounded summary for ${query.currentTrade?.reference || query.tradeRef || "Accord"}: Status is "${query.currentTrade?.status || "Active"}". ${verifiedFacts[0] || ""} ${outstandingActions[0] || ""}`;
    }

    return {
      answer,
      verifiedFacts,
      userClaims,
      outstandingActions,
      citedMemories,
      onchainVerification,
      timestamp: new Date().toISOString(),
    };
  }
}

export const accordAI = new AccordAIAssistant();
