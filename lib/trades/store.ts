/**
 * Accord - Trade State Machine & Persistent Store
 *
 * Implements full life cycle for P2P Crypto Trades:
 * Draft -> AwaitingAcceptance -> AwaitingDeposit -> Funded ->
 * AwaitingConditions -> ReadyForRelease -> Completed / Disputed / Refunded / Expired
 *
 * Security & Integrity Invariants:
 * 1. Never allow a frontend button alone to mark a trade as Funded without a verified
 *    Tatum RPC transaction receipt.
 * 2. Modifying agreed terms creates a visible new TermsVersion and resets counterparty
 *    acceptance (`AwaitingAcceptance`), preventing silent overwrites.
 * 3. On-chain conditions (`onchain_receipt`) require Tatum RPC proof; off-chain conditions
 *    (`external_delivery`, `inspection`, `mutual_signature`) are explicitly labeled as
 *    participant attestations anchored to Walrus Memory with SHA-256 evidence hashes.
 * 4. Arbiters must be neutral (neither buyer nor seller).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { walrusMemory } from "../walrus/memory";
import { VerificationResult } from "../tatum/client";
import { getEscrowAddress } from "../contracts/AccordEscrow";

export type TradeStatus =
  | "Draft"
  | "AwaitingAcceptance"
  | "AwaitingDeposit"
  | "Funded"
  | "AwaitingConditions"
  | "ReadyForRelease"
  | "Completed"
  | "Disputed"
  | "Refunded"
  | "Expired";

export interface SettlementCondition {
  id: string;
  title: string;
  description: string;
  type: "onchain_receipt" | "external_delivery" | "inspection" | "mutual_signature";
  verificationCategory: "onchain_verification" | "offchain_attestation";
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  txHash?: string;
  attestationNote?: string;
  evidenceHash?: string;
  walrusMemoryId?: string;
}

export interface TermsVersion {
  version: number;
  terms: string;
  termsHash: string;
  proposedBy: string;
  changeSummary?: string;
  timestamp: string;
  acceptedByBuyer?: boolean;
  acceptedBySeller?: boolean;
  acceptedAt?: string;
}

export interface TradeActivity {
  id: string;
  type:
    | "TRADE_CREATED"
    | "TERMS_UPDATED"
    | "TERMS_ACCEPTED"
    | "PAYMENT_SUBMITTED"
    | "DEPOSIT_VERIFIED"
    | "CONDITION_COMPLETED"
    | "SELLER_FULFILLED"
    | "FUNDS_RELEASED"
    | "DISPUTE_RAISED"
    | "DISPUTE_RESOLVED"
    | "FUNDS_REFUNDED"
    | "WALRUS_MEMORY_SAVED";
  title: string;
  description: string;
  actor?: string;
  timestamp: string;
  txHash?: string;
  walrusMemoryId?: string;
}

export interface DisputeEvidence {
  id: string;
  submittedBy: string;
  reason: string;
  evidenceHash: string;
  contentSnippet?: string;
  timestamp: string;
  walrusMemoryId?: string;
}

export interface MutualSettlementProposal {
  proposer: string;
  buyerSplitBps: number;
  note?: string;
  timestamp: string;
}

export interface Trade {
  id: string;
  reference: string;
  creator: string;
  creatorRole: "buyer" | "seller";
  buyer: string;
  seller: string;
  arbiter: string;
  asset: string;
  amount: string;
  network: string;
  status: TradeStatus;
  agreedTerms: string;
  termsHash: string;
  termsVersions: TermsVersion[];
  buyerAccepted: boolean;
  sellerAccepted: boolean;
  buyerAcceptedAt?: string;
  sellerAcceptedAt?: string;
  sellerFulfilled: boolean;
  conditions: SettlementCondition[];
  submittedTxHash?: string;
  txHash?: string;
  sampleVerifiableTxHash?: string;
  verification?: VerificationResult;
  releaseTxHash?: string;
  refundTxHash?: string;
  escrowAddress?: string;
  settlementMode: "escrow" | "direct";
  expirationTimestamp: number;
  settlementProposal?: MutualSettlementProposal;
  disputeResolution?: {
    resolvedBy: string;
    buyerSplitBps: number;
    resolutionNote: string;
    timestamp: string;
  };
  activity: TradeActivity[];
  disputeEvidence: DisputeEvidence[];
  createdAt: string;
  updatedAt: string;
}

const TRADE_STORE: Map<string, Trade> = new Map();
let tradesHydrated = false;

function getTradesFilePath(): string {
  if (process.env.ACCORD_TEST_MODE === "1") {
    return path.join(os.tmpdir(), `accord-test-trades-${process.pid}.json`);
  }
  const localDir = path.join(process.cwd(), ".accord-data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, "trades.json");
  } catch {
    return path.join(os.tmpdir(), "accord-trades.json");
  }
}

function hydrateTradesFromDisk(): void {
  if (tradesHydrated) return;
  tradesHydrated = true;
  try {
    const file = getTradesFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const t of parsed) {
          if (t && t.id && t.reference) {
            TRADE_STORE.set(t.id, t);
            TRADE_STORE.set(t.reference, t);
          }
        }
      }
    }
  } catch {
    // Continue with in-memory store
  }
}

function persistTradesToDisk(): void {
  try {
    const file = getTradesFilePath();
    const unique = Array.from(
      new Map(Array.from(TRADE_STORE.values()).map((t) => [t.id, t])).values()
    );
    fs.writeFileSync(file, JSON.stringify(unique, null, 2), "utf8");
  } catch {
    // Ignore write failure in read-only environments
  }
}

function computeTermsHash(terms: string): string {
  return `0x${crypto.createHash("sha256").update(terms).digest("hex")}`;
}

export class TradeService {
  constructor() {
    hydrateTradesFromDisk();
  }

  /**
   * Create a new Trade Agreement and automatically record initial Trade History & Agreement memories
   */
  async createTrade(params: {
    id?: string;
    reference?: string;
    creator: string;
    creatorRole: "buyer" | "seller";
    buyer: string;
    seller: string;
    arbiter?: string;
    asset: string;
    amount: string;
    network: string;
    agreedTerms: string;
    conditions: Array<{
      title: string;
      description: string;
      type?: SettlementCondition["type"];
    }>;
    expirationHours?: number;
    sampleVerifiableTxHash?: string;
  }): Promise<Trade> {
    const buyerClean = params.buyer.trim().toLowerCase();
    const sellerClean = params.seller.trim().toLowerCase();
    const creatorClean = params.creator.trim().toLowerCase();
    const arbiterClean = (params.arbiter || "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7")
      .trim()
      .toLowerCase();

    if (!buyerClean || !sellerClean) {
      throw new Error("Both buyer and seller wallet addresses are required.");
    }

    if (buyerClean === sellerClean) {
      throw new Error("Buyer and seller cannot be the same wallet address.");
    }

    if (
      arbiterClean !== "0x0000000000000000000000000000000000000000" &&
      (arbiterClean === buyerClean || arbiterClean === sellerClean)
    ) {
      throw new Error(
        "Neutral arbiter cannot be the buyer or the seller. Please specify an independent third-party address."
      );
    }

    if (Number(params.amount) <= 0 || Number.isNaN(Number(params.amount))) {
      throw new Error("Trade amount must be greater than zero.");
    }

    const id = params.id || `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reference = params.reference || `ACC-${new Date().getFullYear()}-${randomSuffix}`;
    const nowIso = new Date().toISOString();
    const expirationMs = (params.expirationHours || 72) * 3600 * 1000;
    const expirationTimestamp = Date.now() + expirationMs;

    const escrowAddress = getEscrowAddress(params.network);
    const settlementMode: "escrow" | "direct" = escrowAddress ? "escrow" : "direct";

    const conditions: SettlementCondition[] = params.conditions.map((c, i) => {
      const cType = c.type || "onchain_receipt";
      return {
        id: `cond-${i + 1}-${Date.now()}`,
        title: c.title,
        description: c.description,
        type: cType,
        verificationCategory:
          cType === "onchain_receipt" ? "onchain_verification" : "offchain_attestation",
        completed: false,
      };
    });

    const isBuyerCreator = params.creatorRole === "buyer";
    const buyerAccepted = isBuyerCreator;
    const sellerAccepted = !isBuyerCreator;
    const termsHash = computeTermsHash(params.agreedTerms);

    const initialActivity: TradeActivity = {
      id: `act-${Date.now()}-1`,
      type: "TRADE_CREATED",
      title: "Trade Room Initialized",
      description: `Trade ${reference} created for ${params.amount} ${params.asset.toUpperCase()} on ${params.network}. Version 1 terms proposed by ${creatorClean.slice(0, 6)}...${creatorClean.slice(-4)}.`,
      actor: creatorClean,
      timestamp: nowIso,
    };

    const trade: Trade = {
      id,
      reference,
      creator: creatorClean,
      creatorRole: params.creatorRole,
      buyer: buyerClean,
      seller: sellerClean,
      arbiter: arbiterClean,
      asset: params.asset.toUpperCase(),
      amount: params.amount,
      network: params.network,
      status: "AwaitingAcceptance",
      agreedTerms: params.agreedTerms,
      termsHash,
      termsVersions: [
        {
          version: 1,
          terms: params.agreedTerms,
          termsHash,
          proposedBy: creatorClean,
          changeSummary: "Initial trade terms proposed",
          timestamp: nowIso,
          acceptedByBuyer: buyerAccepted,
          acceptedBySeller: sellerAccepted,
          acceptedAt: nowIso,
        },
      ],
      buyerAccepted,
      sellerAccepted,
      buyerAcceptedAt: buyerAccepted ? nowIso : undefined,
      sellerAcceptedAt: sellerAccepted ? nowIso : undefined,
      sellerFulfilled: false,
      conditions,
      sampleVerifiableTxHash: params.sampleVerifiableTxHash,
      escrowAddress,
      settlementMode,
      expirationTimestamp,
      activity: [initialActivity],
      disputeEvidence: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    TRADE_STORE.set(id, trade);
    TRADE_STORE.set(reference, trade);

    try {
      const createdMem = await walrusMemory.remember({
        tradeId: id,
        tradeRef: reference,
        title: `Trade Initialized — ${reference}`,
        category: "Trade History",
        type: "TRADE_CREATED",
        actor: creatorClean,
        sourceRole: params.creatorRole,
        content: `Trade ${reference} initialized by ${params.creatorRole} (${creatorClean}) for ${params.amount} ${params.asset.toUpperCase()} on ${params.network}.`,
        structuredPayload: {
          tradeId: id,
          reference,
          amount: params.amount,
          asset: params.asset.toUpperCase(),
          network: params.network,
          buyer: buyerClean,
          seller: sellerClean,
          arbiter: arbiterClean,
        },
        metadata: {
          tradeId: id,
          amount: params.amount,
          asset: params.asset.toUpperCase(),
          network: params.network,
          participants: [buyerClean, sellerClean],
        },
      });

      initialActivity.walrusMemoryId = createdMem.id;

      const memory = await walrusMemory.remember({
        tradeId: id,
        tradeRef: reference,
        title: `Original Agreement Version 1 Drafted — ${reference}`,
        category: "Agreements",
        type: "TRADE_TERMS",
        actor: creatorClean,
        sourceRole: params.creatorRole,
        content: `Accord Trade Agreement Created (${reference}): ${params.amount} ${params.asset.toUpperCase()} on ${params.network}. Buyer: ${buyerClean}. Seller: ${sellerClean}. Terms (v1, hash ${termsHash.slice(0, 14)}...): ${params.agreedTerms}`,
        structuredPayload: {
          version: 1,
          amount: params.amount,
          asset: params.asset.toUpperCase(),
          network: params.network,
          buyer: buyerClean,
          seller: sellerClean,
          arbiter: arbiterClean,
          termsHash,
          conditionsCount: conditions.length,
        },
        metadata: {
          tradeId: id,
          amount: params.amount,
          asset: params.asset.toUpperCase(),
          network: params.network,
          termsHash,
          participants: [buyerClean, sellerClean],
        },
      });

      trade.activity.push({
        id: `act-${Date.now()}-walrus`,
        type: "WALRUS_MEMORY_SAVED",
        title: memory.verifiedOnWalrus
          ? "Terms Anchored to Walrus Memory Mainnet"
          : "Terms Preserved in Accord Memory Box",
        description: memory.verifiedOnWalrus
          ? `Trade parameters anchored on Walrus Mainnet (Blob: ${memory.blobId || memory.jobId || memory.id}).`
          : `Terms hash ${termsHash.slice(0, 14)}... preserved in Memory Box (Record ID: ${memory.id}).`,
        actor: creatorClean,
        timestamp: new Date().toISOString(),
        walrusMemoryId: memory.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Retrieve a trade by ID or Trade Reference (evaluating expiration dynamically)
   */
  getTrade(idOrRef: string): Trade | null {
    let trade = TRADE_STORE.get(idOrRef) || null;
    if (!trade) {
      const lower = (idOrRef || "").toLowerCase();
      for (const item of TRADE_STORE.values()) {
        if (item.id.toLowerCase() === lower || item.reference.toLowerCase() === lower) {
          trade = item;
          break;
        }
      }
    }
    if (trade) {
      if (
        Date.now() > trade.expirationTimestamp &&
        (trade.status === "Draft" ||
          trade.status === "AwaitingAcceptance" ||
          trade.status === "AwaitingDeposit")
      ) {
        trade.status = "Expired";
      }
    }
    return trade;
  }

  /**
   * List trades involving a user address, or all active trades
   */
  listTrades(userAddress?: string): Trade[] {
    const values = Array.from(TRADE_STORE.values());
    const unique = Array.from(new Map(values.map((t) => [t.id, t])).values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    if (!userAddress) return unique;

    const lower = userAddress.toLowerCase();
    return unique.filter(
      (t) =>
        t.buyer.toLowerCase() === lower ||
        t.seller.toLowerCase() === lower ||
        t.arbiter.toLowerCase() === lower ||
        t.creator.toLowerCase() === lower
    );
  }

  /**
   * Propose an amendment to the trade terms.
   * Never silently overwrites previously accepted terms:
   * - Appends a new version to `termsVersions`
   * - Resets the counterparty's acceptance flag
   * - Reverts status to `AwaitingAcceptance`
   */
  async updateTerms(
    tradeId: string,
    actor: string,
    newTerms: string,
    changeSummary?: string
  ): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    if (
      trade.status !== "Draft" &&
      trade.status !== "AwaitingAcceptance" &&
      trade.status !== "AwaitingDeposit"
    ) {
      throw new Error(
        `Terms cannot be modified once funds are locked or trade is in ${trade.status} state.`
      );
    }

    const actorLower = actor.trim().toLowerCase();
    const isBuyer = actorLower === trade.buyer.toLowerCase();
    const isSeller = actorLower === trade.seller.toLowerCase();

    if (!isBuyer && !isSeller) {
      throw new Error("Only the buyer or seller can propose an amendment to trade terms.");
    }

    if (!newTerms.trim()) {
      throw new Error("Updated trade terms cannot be empty.");
    }

    const previousVersion = trade.termsVersions.length;
    const nextVersion = previousVersion + 1;
    const nowIso = new Date().toISOString();
    const newHash = computeTermsHash(newTerms.trim());

    trade.agreedTerms = newTerms.trim();
    trade.termsHash = newHash;
    trade.termsVersions.push({
      version: nextVersion,
      terms: newTerms.trim(),
      termsHash: newHash,
      proposedBy: actorLower,
      changeSummary: changeSummary || `Amended terms in Version ${nextVersion}`,
      timestamp: nowIso,
      acceptedByBuyer: isBuyer,
      acceptedBySeller: isSeller,
      acceptedAt: nowIso,
    });

    // Reset counterparty acceptance so amendments are never silently accepted
    trade.buyerAccepted = isBuyer;
    trade.sellerAccepted = isSeller;
    trade.buyerAcceptedAt = isBuyer ? nowIso : undefined;
    trade.sellerAcceptedAt = isSeller ? nowIso : undefined;
    trade.status = "AwaitingAcceptance";
    trade.updatedAt = nowIso;

    trade.activity.push({
      id: `act-${Date.now()}-amend`,
      type: "TERMS_UPDATED",
      title: `Terms Amended (Version ${nextVersion})`,
      description: `${isBuyer ? "Buyer" : "Seller"} (${actorLower.slice(0, 6)}...${actorLower.slice(-4)}) proposed Version ${nextVersion} of the agreement. Counterparty acceptance has been reset and requires explicit review.`,
      actor: actorLower,
      timestamp: nowIso,
    });

    try {
      const memory = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Terms Amended to Version ${nextVersion} — ${trade.reference}`,
        category: "Agreements",
        type: "TERMS_AMENDMENT",
        actor: actorLower,
        sourceRole: isBuyer ? "buyer" : "seller",
        content: `Terms for ${trade.reference} amended to Version ${nextVersion} by ${actorLower}. New terms hash: ${newHash}. Counterparty acceptance reset. Updated terms: "${newTerms.trim()}"`,
        structuredPayload: {
          previousVersion,
          newVersion: nextVersion,
          proposedBy: actorLower,
          changeSummary: changeSummary || `Amended terms in Version ${nextVersion}`,
          termsHash: newHash,
          acceptanceReset: true,
        },
        metadata: {
          version: nextVersion,
          proposedBy: actorLower,
          termsHash: newHash,
          participants: [trade.buyer, trade.seller],
        },
      });
      trade.activity.push({
        id: `act-${Date.now()}-wal-amend`,
        type: "WALRUS_MEMORY_SAVED",
        title: "Amendment Preserved in Memory Box",
        description: `Version ${nextVersion} diff and SHA-256 hash recorded (${memory.id}).`,
        actor: actorLower,
        timestamp: new Date().toISOString(),
        walrusMemoryId: memory.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus amendment notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Counterparty accepts trade terms
   */
  async acceptTerms(tradeId: string, participantAddress: string): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    const pLower = participantAddress.trim().toLowerCase();
    const isBuyer = pLower === trade.buyer.toLowerCase();
    const isSeller = pLower === trade.seller.toLowerCase();

    if (!isBuyer && !isSeller) {
      throw new Error("Only designated trade participants (Buyer or Seller) can accept terms.");
    }

    const nowIso = new Date().toISOString();
    if (isBuyer) {
      trade.buyerAccepted = true;
      trade.buyerAcceptedAt = nowIso;
    }
    if (isSeller) {
      trade.sellerAccepted = true;
      trade.sellerAcceptedAt = nowIso;
    }

    const latestVersionObj = trade.termsVersions[trade.termsVersions.length - 1];
    if (latestVersionObj) {
      latestVersionObj.acceptedByBuyer = trade.buyerAccepted;
      latestVersionObj.acceptedBySeller = trade.sellerAccepted;
      latestVersionObj.acceptedAt = nowIso;
    }

    if (trade.buyerAccepted && trade.sellerAccepted && trade.status === "AwaitingAcceptance") {
      trade.status = "AwaitingDeposit";
    }

    trade.updatedAt = nowIso;
    const currentVersion = latestVersionObj?.version || 1;

    trade.activity.push({
      id: `act-${Date.now()}`,
      type: "TERMS_ACCEPTED",
      title: `Version ${currentVersion} Terms Accepted by ${isBuyer ? "Buyer" : "Seller"}`,
      description: `Participant ${pLower.slice(0, 6)}...${pLower.slice(-4)} accepted Version ${currentVersion} (Hash: ${trade.termsHash.slice(0, 10)}...). Status: ${trade.status}.`,
      actor: pLower,
      timestamp: trade.updatedAt,
    });

    try {
      const memory = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Version ${currentVersion} Accepted by ${isBuyer ? "Buyer" : "Seller"} — ${trade.reference}`,
        category: "Agreements",
        type: "TRADE_ACCEPTANCE",
        actor: pLower,
        sourceRole: isBuyer ? "buyer" : "seller",
        content: `${isBuyer ? "Buyer" : "Seller"} ${pLower} formally accepted Version ${currentVersion} agreed terms (${trade.termsHash}) for ${trade.reference}. Trade status is now ${trade.status}.`,
        structuredPayload: {
          acceptedVersion: currentVersion,
          acceptedBy: pLower,
          role: isBuyer ? "buyer" : "seller",
          termsHash: trade.termsHash,
          bilateralComplete: Boolean(trade.buyerAccepted && trade.sellerAccepted),
          tradeStatus: trade.status,
        },
        metadata: {
          participant: pLower,
          version: currentVersion,
          termsHash: trade.termsHash,
          status: trade.status,
          participants: [trade.buyer, trade.seller],
        },
      });
      trade.activity.push({
        id: `act-${Date.now()}-wal`,
        type: "WALRUS_MEMORY_SAVED",
        title: "Acceptance Recorded in Walrus Memory",
        description: `Cryptographic acceptance record saved (${memory.id}).`,
        actor: pLower,
        timestamp: new Date().toISOString(),
        walrusMemoryId: memory.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor error:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Record submission of a payment transaction reference before or during Tatum verification
   */
  async submitPaymentReference(
    tradeId: string,
    actor: string,
    txHash: string
  ): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    const cleanTx = txHash.trim();
    const actorLower = (actor || trade.buyer).trim().toLowerCase();
    const nowIso = new Date().toISOString();

    trade.submittedTxHash = cleanTx;
    trade.updatedAt = nowIso;

    const alreadyLogged = trade.activity.some(
      (a) => a.type === "PAYMENT_SUBMITTED" && a.txHash?.toLowerCase() === cleanTx.toLowerCase()
    );

    if (!alreadyLogged) {
      const mem = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Payment Transaction Reference Submitted — ${trade.reference}`,
        category: "Transactions",
        type: "PAYMENT_SUBMITTED",
        actor: actorLower,
        sourceRole: actorLower === trade.buyer.toLowerCase() ? "buyer" : "participant",
        content: `Payment transaction reference ${cleanTx} submitted for ${trade.reference} on ${trade.network} for Tatum RPC verification.`,
        structuredPayload: {
          submittedTxHash: cleanTx,
          network: trade.network,
          expectedAmount: trade.amount,
          asset: trade.asset,
          submittedBy: actorLower,
        },
        metadata: {
          txHash: cleanTx,
          network: trade.network,
          participants: [trade.buyer, trade.seller],
        },
      });

      trade.activity.push({
        id: `act-${Date.now()}-paysub`,
        type: "PAYMENT_SUBMITTED",
        title: "Payment Transaction Reference Submitted",
        description: `Transaction hash ${cleanTx.slice(0, 12)}... submitted for Tatum RPC verification on ${trade.network}.`,
        actor: actorLower,
        timestamp: nowIso,
        txHash: cleanTx,
        walrusMemoryId: mem.id,
      });
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Submit and verify deposit transaction via Tatum RPC.
   * NEVER marks a trade as Funded without legitimate Tatum RPC verification!
   */
  async recordVerifiedDeposit(tradeId: string, verification: VerificationResult): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    if (!trade.buyerAccepted || !trade.sellerAccepted) {
      throw new Error(
        "Both Buyer and Seller must accept the current agreement version before a deposit can lock settlement."
      );
    }

    if (!verification.verified || verification.status !== "confirmed") {
      throw new Error(
        `Deposit verification failed: ${verification.errorMessage || "Transaction is not confirmed on-chain."}`
      );
    }

    trade.submittedTxHash = verification.txHash;
    trade.txHash = verification.txHash;
    trade.verification = verification;
    trade.updatedAt = new Date().toISOString();

    // Automatically mark any on-chain deposit receipt condition as satisfied via Tatum RPC
    for (const cond of trade.conditions) {
      if (cond.type === "onchain_receipt") {
        cond.completed = true;
        cond.completedBy = "Tatum RPC Gateway";
        cond.completedAt = trade.updatedAt;
        cond.txHash = verification.txHash;
      }
    }

    const allConditionsDone = trade.conditions.every((c) => c.completed);
    trade.status = allConditionsDone ? "ReadyForRelease" : "Funded";

    trade.activity.push({
      id: `act-${Date.now()}-dep`,
      type: "DEPOSIT_VERIFIED",
      title: "Deposit Confirmed via Tatum RPC",
      description: `Transaction ${verification.txHash.slice(0, 10)}... confirmed on ${verification.network} at block ${verification.blockNumber} with ${verification.confirmations} confirmations (${verification.valueEth || trade.amount} ${trade.asset}).`,
      actor: verification.from,
      timestamp: trade.updatedAt,
      txHash: verification.txHash,
    });

    try {
      const memory = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Tatum RPC Verified Deposit (Block #${verification.blockNumber}) — ${trade.reference}`,
        category: "Transactions",
        type: "ONCHAIN_VERIFICATION",
        actor: "system:tatum-rpc",
        sourceRole: "tatum_rpc",
        content: `Tatum RPC verified deposit for ${trade.reference}: Tx ${verification.txHash} confirmed on ${verification.network} (Block: ${verification.blockNumber}, Confirmations: ${verification.confirmations}, Value: ${verification.valueEth || trade.amount} ${trade.asset}).`,
        structuredPayload: {
          txHash: verification.txHash,
          blockNumber: verification.blockNumber,
          confirmations: verification.confirmations,
          receiptStatus: "0x1",
          valueEth: verification.valueEth || trade.amount,
          asset: trade.asset,
          network: verification.network,
          from: verification.from,
          to: verification.to,
        },
        metadata: {
          txHash: verification.txHash,
          blockNumber: verification.blockNumber,
          confirmations: verification.confirmations,
          network: verification.network,
          from: verification.from,
          to: verification.to,
          participants: [trade.buyer, trade.seller],
        },
      });

      trade.activity.push({
        id: `act-${Date.now()}-wal-dep`,
        type: "WALRUS_MEMORY_SAVED",
        title: "Tatum RPC Proof Preserved in Memory Box",
        description: `Verified receipt proof saved (${memory.id}).`,
        actor: "system:tatum-rpc",
        timestamp: new Date().toISOString(),
        walrusMemoryId: memory.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Mark a settlement condition complete.
   * Enforces distinction between on-chain verified events and off-chain participant attestations.
   */
  async completeCondition(
    tradeId: string,
    conditionId: string,
    actor: string,
    attestationNote?: string
  ): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    const condition = trade.conditions.find((c) => c.id === conditionId);
    if (!condition) throw new Error("Condition not found");

    if (condition.type === "onchain_receipt" && !trade.verification?.verified) {
      throw new Error(
        "On-chain receipt conditions cannot be checked off manually. Submit a valid transaction hash for Tatum RPC verification."
      );
    }

    const actorLower = actor.trim().toLowerCase();
    const isBuyer = actorLower === trade.buyer.toLowerCase();
    const isSeller = actorLower === trade.seller.toLowerCase();
    if (!isBuyer && !isSeller) {
      throw new Error("Only the Buyer or Seller can attest fulfilment conditions.");
    }

    const nowIso = new Date().toISOString();
    const rawEvidence = `${trade.reference}:${condition.id}:${actorLower}:${attestationNote || "attested"}:${nowIso}`;
    const evidenceHash = `0x${crypto.createHash("sha256").update(rawEvidence).digest("hex")}`;

    condition.completed = true;
    condition.completedBy = actorLower;
    condition.completedAt = nowIso;
    condition.attestationNote =
      attestationNote || "Participant attested fulfillment in trade room";
    condition.evidenceHash = evidenceHash;

    const allDone = trade.conditions.every((c) => c.completed);
    if (allDone && (trade.status === "Funded" || trade.status === "AwaitingConditions")) {
      trade.status = "ReadyForRelease";
    } else if (!allDone && trade.status === "Funded") {
      trade.status = "AwaitingConditions";
    }

    trade.updatedAt = nowIso;

    try {
      const mem = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Fulfilment Condition Attested: ${condition.title} — ${trade.reference}`,
        category: "Fulfilment",
        type: "CONDITION_UPDATE",
        actor: actorLower,
        sourceRole: isBuyer ? "buyer" : "seller",
        content: `Participant attestation for ${trade.reference}: Condition "${condition.title}" marked fulfilled by ${actorLower}. Note: "${condition.attestationNote}". Evidence hash: ${evidenceHash}. All conditions satisfied: ${allDone}.`,
        structuredPayload: {
          conditionId,
          conditionTitle: condition.title,
          verificationCategory: condition.verificationCategory,
          attestedBy: actorLower,
          attestationNote: condition.attestationNote,
          evidenceHash,
          allConditionsFulfilled: allDone,
        },
        metadata: {
          conditionId,
          verificationCategory: condition.verificationCategory,
          evidenceHash,
          allConditionsFulfilled: allDone,
          actor: actorLower,
          participants: [trade.buyer, trade.seller],
        },
      });
      condition.walrusMemoryId = mem.id;

      trade.activity.push({
        id: `act-${Date.now()}-cond`,
        type: "CONDITION_COMPLETED",
        title: `Condition Attested: ${condition.title}`,
        description: `Off-chain condition "${condition.title}" attested by ${actorLower.slice(0, 6)}...${actorLower.slice(-4)} (SHA-256: ${evidenceHash.slice(0, 12)}...). Remaining conditions: ${trade.conditions.filter((c) => !c.completed).length}.`,
        actor: actorLower,
        timestamp: trade.updatedAt,
        walrusMemoryId: mem.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Seller confirms fulfillment of deliverables (`AccordEscrow.confirmFulfillment`)
   */
  async confirmFulfillment(tradeId: string, actor: string): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    const actorLower = actor.trim().toLowerCase();
    if (actorLower !== trade.seller.toLowerCase()) {
      throw new Error("Only the designated Seller can confirm deliverable fulfillment.");
    }

    if (
      trade.status !== "Funded" &&
      trade.status !== "AwaitingConditions" &&
      trade.status !== "ReadyForRelease"
    ) {
      throw new Error("Trade must be funded before seller can confirm fulfillment.");
    }

    trade.sellerFulfilled = true;
    const allDone = trade.conditions.every((c) => c.completed);
    trade.status = allDone ? "ReadyForRelease" : "AwaitingConditions";
    trade.updatedAt = new Date().toISOString();

    const mem = await walrusMemory.remember({
      tradeId: trade.id,
      tradeRef: trade.reference,
      title: `Seller Confirmed Deliverable Fulfilment — ${trade.reference}`,
      category: "Fulfilment",
      type: "CONDITION_UPDATE",
      actor: actorLower,
      sourceRole: "seller",
      content: `Seller ${actorLower} confirmed deliverable fulfilment for ${trade.reference}. Trade status: ${trade.status}.`,
      structuredPayload: {
        sellerFulfilled: true,
        seller: actorLower,
        status: trade.status,
      },
      metadata: {
        participants: [trade.buyer, trade.seller],
      },
    });

    trade.activity.push({
      id: `act-${Date.now()}-fulfill`,
      type: "SELLER_FULFILLED",
      title: "Seller Confirmed Fulfillment",
      description: `Seller ${actorLower.slice(0, 6)}...${actorLower.slice(-4)} attested that agreed deliverables have been provided. Ready for buyer inspection and release approval.`,
      actor: actorLower,
      timestamp: trade.updatedAt,
      walrusMemoryId: mem.id,
    });

    persistTradesToDisk();
    return trade;
  }

  /**
   * Buyer approves release of escrowed funds to seller (`AccordEscrow.approveRelease`)
   */
  async approveRelease(tradeId: string, actor: string, releaseTxHash?: string): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    if (!trade.verification?.verified) {
      throw new Error(
        "Cannot release funds: No verified on-chain deposit has been confirmed by Tatum RPC."
      );
    }

    if (trade.status === "Disputed") {
      throw new Error(
        "Cannot unilaterally release funds while trade is in Disputed state. Neutral Arbiter must issue a ruling."
      );
    }

    const actorLower = actor.trim().toLowerCase();
    const isBuyer = actorLower === trade.buyer.toLowerCase();

    if (!isBuyer) {
      throw new Error(
        "Only the Buyer can unilaterally approve release of escrowed funds. If the trade is disputed, the neutral Arbiter must use resolveDispute."
      );
    }

    const incompleteConditions = trade.conditions.filter((c) => !c.completed);
    if (incompleteConditions.length > 0) {
      throw new Error(
        `Cannot release funds yet: ${incompleteConditions.length} settlement condition(s) remain unfulfilled.`
      );
    }

    trade.status = "Completed";
    trade.releaseTxHash = releaseTxHash || trade.txHash;
    trade.updatedAt = new Date().toISOString();

    try {
      const memory = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Settlement Released & Completed — ${trade.reference}`,
        category: "Settlement",
        type: "SETTLEMENT_COMPLETED",
        actor: actorLower,
        sourceRole: "buyer",
        content: `Trade ${trade.reference} completed and settled on ${trade.network}. ${trade.amount} ${trade.asset} released to Seller ${trade.seller} with Buyer ${trade.buyer} approval. Deposit tx: ${trade.txHash}.`,
        structuredPayload: {
          outcome: "COMPLETED",
          amount: trade.amount,
          asset: trade.asset,
          network: trade.network,
          buyer: trade.buyer,
          seller: trade.seller,
          depositTxHash: trade.txHash,
          releaseTxHash: trade.releaseTxHash,
        },
        metadata: {
          outcome: "COMPLETED",
          amount: trade.amount,
          asset: trade.asset,
          seller: trade.seller,
          buyer: trade.buyer,
          network: trade.network,
          txHash: trade.releaseTxHash,
          participants: [trade.buyer, trade.seller],
        },
      });

      trade.activity.push({
        id: `act-${Date.now()}-rel`,
        type: "FUNDS_RELEASED",
        title: "Escrow Released to Seller — Trade Completed",
        description: `Buyer ${actorLower.slice(0, 6)}...${actorLower.slice(-4)} authorized settlement release of ${trade.amount} ${trade.asset} to Seller ${trade.seller.slice(0, 6)}...${trade.seller.slice(-4)}.`,
        actor: actorLower,
        timestamp: trade.updatedAt,
        txHash: trade.releaseTxHash,
        walrusMemoryId: memory.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Raise a trade dispute and submit cryptographic evidence
   */
  async raiseDispute(
    tradeId: string,
    actor: string,
    reason: string,
    evidenceContent?: string
  ): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    const actorLower = actor.trim().toLowerCase();
    const isBuyer = actorLower === trade.buyer.toLowerCase();
    const isSeller = actorLower === trade.seller.toLowerCase();
    if (!isBuyer && !isSeller) {
      throw new Error("Only the Buyer or Seller can raise a dispute.");
    }

    trade.status = "Disputed";
    trade.updatedAt = new Date().toISOString();

    const evidenceRaw = `${trade.reference}:${actorLower}:${reason}:${evidenceContent || ""}:${trade.updatedAt}`;
    const evidenceHash = `0x${crypto.createHash("sha256").update(evidenceRaw).digest("hex")}`;

    const disputeItem: DisputeEvidence = {
      id: `disp-${Date.now()}`,
      submittedBy: actorLower,
      reason,
      evidenceHash,
      contentSnippet: evidenceContent ? evidenceContent.slice(0, 280) : undefined,
      timestamp: trade.updatedAt,
    };

    trade.disputeEvidence.push(disputeItem);

    try {
      const memory = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Dispute & Evidence Submitted — ${trade.reference}`,
        category: "Disputes",
        type: "DISPUTE_EVIDENCE",
        actor: actorLower,
        sourceRole: isBuyer ? "buyer" : "seller",
        content: `Dispute filed for ${trade.reference} by ${actorLower}. Claim: "${reason}". Evidence snippet: "${evidenceContent || "N/A"}". SHA-256 hash: ${evidenceHash}.`,
        structuredPayload: {
          disputedBy: actorLower,
          role: isBuyer ? "buyer" : "seller",
          reason,
          evidenceSnippet: evidenceContent || "N/A",
          evidenceHash,
          arbiter: trade.arbiter,
        },
        metadata: {
          disputedBy: actorLower,
          evidenceHash,
          reason,
          arbiter: trade.arbiter,
          participants: [trade.buyer, trade.seller],
        },
      });
      disputeItem.walrusMemoryId = memory.id;

      trade.activity.push({
        id: `act-${Date.now()}-disp`,
        type: "DISPUTE_RAISED",
        title: "Dispute Lodged — Escrow Frozen",
        description: `Dispute raised by ${actorLower.slice(0, 6)}...${actorLower.slice(-4)}: "${reason}". Evidence SHA-256 hash ${evidenceHash.slice(0, 14)}... preserved in Memory Box.`,
        actor: actorLower,
        timestamp: trade.updatedAt,
        walrusMemoryId: memory.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Resolve a dispute via Neutral Arbiter (`AccordEscrow.resolveDispute`)
   */
  async resolveDispute(
    tradeId: string,
    actor: string,
    buyerSplitBps: number,
    resolutionNote: string
  ): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    if (trade.status !== "Disputed") {
      throw new Error("Trade is not currently in Disputed state.");
    }

    const actorLower = actor.trim().toLowerCase();
    if (actorLower !== trade.arbiter.toLowerCase()) {
      throw new Error("Only the appointed Neutral Arbiter can issue a binding dispute resolution.");
    }

    if (actorLower === trade.buyer.toLowerCase() || actorLower === trade.seller.toLowerCase()) {
      throw new Error("Conflict of interest: Arbiter cannot be the buyer or seller.");
    }

    if (buyerSplitBps < 0 || buyerSplitBps > 10000) {
      throw new Error("buyerSplitBps must be between 0 (100% Seller) and 10000 (100% Buyer).");
    }

    const nowIso = new Date().toISOString();
    trade.disputeResolution = {
      resolvedBy: actorLower,
      buyerSplitBps,
      resolutionNote,
      timestamp: nowIso,
    };

    trade.status = buyerSplitBps === 10000 ? "Refunded" : "Completed";
    trade.updatedAt = nowIso;

    const buyerPct = (buyerSplitBps / 100).toFixed(0);
    const sellerPct = ((10000 - buyerSplitBps) / 100).toFixed(0);

    try {
      const mem = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Arbitral Ruling (${buyerPct}% Buyer / ${sellerPct}% Seller) — ${trade.reference}`,
        category: "Disputes",
        type: "DISPUTE_RESOLUTION",
        actor: actorLower,
        sourceRole: "arbiter",
        content: `Neutral Arbiter ${actorLower} resolved dispute for ${trade.reference}: ${buyerPct}% to Buyer (${trade.buyer}), ${sellerPct}% to Seller (${trade.seller}). Ruling: "${resolutionNote}".`,
        structuredPayload: {
          arbiter: actorLower,
          buyerSplitBps,
          sellerSplitBps: 10000 - buyerSplitBps,
          resolutionNote,
          finalTradeStatus: trade.status,
        },
        metadata: {
          arbiter: actorLower,
          buyerSplitBps,
          resolutionNote,
          participants: [trade.buyer, trade.seller],
        },
      });

      trade.activity.push({
        id: `act-${Date.now()}-res`,
        type: "DISPUTE_RESOLVED",
        title: `Dispute Resolved by Neutral Arbiter (${buyerPct}% Buyer / ${sellerPct}% Seller)`,
        description: `Arbiter ${actorLower.slice(0, 6)}...${actorLower.slice(-4)} resolved the dispute: "${resolutionNote}".`,
        actor: actorLower,
        timestamp: nowIso,
        walrusMemoryId: mem.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Voluntary seller refund or post-expiration buyer refund
   */
  async refundTrade(tradeId: string, actor: string, refundTxHash?: string): Promise<Trade> {
    const trade = this.getTrade(tradeId);
    if (!trade) throw new Error("Trade not found");

    const actorLower = actor.trim().toLowerCase();
    const isSeller = actorLower === trade.seller.toLowerCase();
    const isBuyer = actorLower === trade.buyer.toLowerCase();
    const isArbiter = actorLower === trade.arbiter.toLowerCase();
    const isExpired = Date.now() >= trade.expirationTimestamp;

    if (!isSeller && !isArbiter && !(isBuyer && isExpired)) {
      throw new Error(
        "Unilateral refund requires Seller authorization, Arbiter ruling, or Buyer claim after trade expiration."
      );
    }

    trade.status = "Refunded";
    trade.refundTxHash = refundTxHash || trade.txHash;
    trade.updatedAt = new Date().toISOString();

    try {
      const mem = await walrusMemory.remember({
        tradeId: trade.id,
        tradeRef: trade.reference,
        title: `Principal Refunded to Buyer — ${trade.reference}`,
        category: "Settlement",
        type: "SETTLEMENT_REFUNDED",
        actor: actorLower,
        sourceRole: isSeller ? "seller" : isArbiter ? "arbiter" : "buyer",
        content: `Trade ${trade.reference} refunded: ${trade.amount} ${trade.asset} returned to Buyer ${trade.buyer} (triggered by ${actorLower}).`,
        structuredPayload: {
          outcome: "REFUNDED",
          amount: trade.amount,
          asset: trade.asset,
          buyer: trade.buyer,
          seller: trade.seller,
          authorizedBy: actorLower,
          refundTxHash: trade.refundTxHash,
        },
        metadata: {
          outcome: "REFUNDED",
          buyer: trade.buyer,
          seller: trade.seller,
          amount: trade.amount,
          participants: [trade.buyer, trade.seller],
        },
      });

      trade.activity.push({
        id: `act-${Date.now()}-ref`,
        type: "FUNDS_REFUNDED",
        title: "Escrow Refunded to Buyer",
        description: `${trade.amount} ${trade.asset} refunded to Buyer ${trade.buyer.slice(0, 6)}...${trade.buyer.slice(-4)} (authorized by ${actorLower.slice(0, 6)}...${actorLower.slice(-4)}).`,
        actor: actorLower,
        timestamp: trade.updatedAt,
        txHash: trade.refundTxHash,
        walrusMemoryId: mem.id,
      });
    } catch (err: any) {
      console.warn("[TradeStore] Walrus anchor notice:", err.message);
    }

    persistTradesToDisk();
    return trade;
  }

  /**
   * Seed initial showcase trades:
   * 1. ACC-2026-8812: A real Base Mainnet trade ready for live Tatum RPC verification using real Base Mainnet tx 0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c.
   * 2. ACC-2026-9041: A trade in AwaitingAcceptance state to demonstrate invitation links, versioned term amendments, and acceptance.
   */
  async seedInitialShowcaseTrades(): Promise<void> {
    await walrusMemory.seedDemonstrationMemories();
    if (TRADE_STORE.size > 0) return;

    // Showcase Trade 1: Backed by a real Base Mainnet transaction that can be verified live via Tatum RPC
    const trade1 = await this.createTrade({
      id: "trade-base-mainnet-8812",
      reference: "ACC-2026-8812",
      creator: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
      creatorRole: "buyer",
      buyer: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
      seller: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
      arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
      asset: "ETH",
      amount: "0.000371",
      network: "base-mainnet",
      sampleVerifiableTxHash:
        "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c",
      agreedTerms:
        "Buyer transfers 0.000371 ETH on Base Mainnet (verifiable via Tatum RPC). Seller delivers cryptographically signed API access bundle and SHA-256 checksum within 2 hours of block confirmation.",
      conditions: [
        {
          title: "Base Mainnet Deposit Receipt (Tatum RPC)",
          description:
            "On-chain verification of 0.000371 ETH transfer from Buyer 0xf5bd...0b75 on Base Mainnet with status 0x1.",
          type: "onchain_receipt",
        },
        {
          title: "Signed API Bundle Delivery (Off-Chain Attestation)",
          description:
            "Seller provides signed API license payload and anchors SHA-256 delivery receipt to Walrus Memory.",
          type: "external_delivery",
        },
        {
          title: "Buyer Key Validation & Inspection",
          description:
            "Buyer verifies API key signature before authorizing final settlement.",
          type: "inspection",
        },
      ],
      expirationHours: 72,
    });

    // Advance Showcase Trade 1 to AwaitingDeposit so user can immediately test live Tatum RPC verification
    await this.acceptTerms(trade1.id, "0x0729e2a4716d9f7dd17858d5d504426d228697f7");

    // Showcase Trade 2: Awaiting Counterparty Acceptance (to test invite review, term amendments, and acceptance)
    await this.createTrade({
      id: "trade-eth-domain-9041",
      reference: "ACC-2026-9041",
      creator: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
      creatorRole: "buyer",
      buyer: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
      seller: "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
      arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
      asset: "ETH",
      amount: "1.20",
      network: "ethereum-mainnet",
      agreedTerms:
        "Buyer locks 1.20 ETH in AccordEscrow on Ethereum Mainnet. Seller transfers ENS domain ownership to Buyer address within 4 hours. Neutral arbiter resolves any transfer dispute.",
      conditions: [
        {
          title: "Ethereum Mainnet Escrow Deposit (Tatum RPC)",
          description: "Verify 1.20 ETH deposit transaction receipt with >= 12 block confirmations.",
          type: "onchain_receipt",
        },
        {
          title: "ENS Registrant Transfer Attestation",
          description: "Seller attests domain transfer and provides transaction/registrant proof.",
          type: "external_delivery",
        },
      ],
      expirationHours: 48,
    });
  }
}

export const tradeService = new TradeService();
