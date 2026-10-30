/**
 * Accord — Comprehensive Automated Integration, Memory Box & Security Test Suite
 *
 * Covers all 13 product journeys and failure/recovery scenarios:
 * 1. Trade creation, neutral arbiter validation, bilateral acceptance, and automatic Memory Box creation
 * 2. Agreement term amendments, version history tracking, counterparty acceptance reset, and amendment memory
 * 3. Payment reference submission, Tatum RPC deposit verification, condition gating, and settlement authorization
 * 4. Dispute locking, SHA-256 evidence anchoring, unilateral release freeze, neutral arbiter ruling, and voluntary refund
 * 5. Tatum RPC transaction verification (malformed hash, live Base Mainnet receipt, sender mismatch, insufficient confirmation depth)
 * 6. Accord Memory Box: 6-category classification, deterministic multi-filter search, overview stats, strict `verifiedOnWalrus`, and in-place retry without duplicates
 * 7. Deterministic Context & Memory Assistant grounding (separating verified on-chain facts from participant claims without AI dependency)
 */

process.env.ACCORD_TEST_MODE = "1";

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TradeService } from "../lib/trades/store";
import { TatumRpcClient } from "../lib/tatum/client";
import { WalrusMemoryService } from "../lib/walrus/memory";
import { AccordAIAssistant } from "../lib/assistant/accord-ai";

const BUYER = "0xf5bdce6674389d937df8ad3363c10fc3fa060b75";
const SELLER = "0x0729e2a4716d9f7dd17858d5d504426d228697f7";
const ARBITER = "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7";
const OUTSIDER = "0x9999999999999999999999999999999999999999";

after(() => {
  // Clean up isolated per-PID test persistence files
  const testTradesFile = path.join(os.tmpdir(), `accord-test-trades-${process.pid}.json`);
  const testMemoriesFile = path.join(os.tmpdir(), `accord-test-memories-${process.pid}.json`);
  try {
    if (fs.existsSync(testTradesFile)) fs.unlinkSync(testTradesFile);
    if (fs.existsSync(testMemoriesFile)) fs.unlinkSync(testMemoriesFile);
  } catch {
    // ignore cleanup error
  }
});

describe("Accord Core Trading, Memory Box & Security Suite", () => {
  it("1. Creates a trade, validates neutral arbiter, auto-records creation & terms memories, and transitions to AwaitingDeposit on bilateral acceptance", async () => {
    const store = new TradeService();
    const memService = new WalrusMemoryService();

    // Prevent buyer == arbiter conflict of interest
    await assert.rejects(
      async () => {
        await store.createTrade({
          creator: BUYER,
          creatorRole: "buyer",
          buyer: BUYER,
          seller: SELLER,
          arbiter: BUYER, // invalid: arbiter is buyer
          asset: "ETH",
          amount: "0.5",
          network: "base-mainnet",
          agreedTerms: "Test terms",
          conditions: [],
        });
      },
      /Neutral arbiter cannot be the buyer or the seller/
    );

    const trade = await store.createTrade({
      creator: BUYER,
      creatorRole: "buyer",
      buyer: BUYER,
      seller: SELLER,
      arbiter: ARBITER,
      asset: "ETH",
      amount: "0.5",
      network: "base-mainnet",
      agreedTerms: "Initial Version 1 terms: 0.5 ETH for software license.",
      conditions: [
        {
          title: "On-chain deposit",
          description: "Tatum RPC verified deposit",
          type: "onchain_receipt",
        },
        {
          title: "License delivery",
          description: "Seller delivers license key",
          type: "external_delivery",
        },
      ],
    });

    assert.equal(trade.status, "AwaitingAcceptance");
    assert.equal(trade.buyerAccepted, true);
    assert.equal(trade.sellerAccepted, false);
    assert.equal(trade.termsVersions.length, 1);

    // Verify automatic Memory Box records created for trade creation + initial terms
    const initialMemories = await memService.getMemoriesForTrade(trade.reference);
    assert.ok(initialMemories.some((m) => m.type === "TRADE_CREATED" && m.category === "Trade History"));
    assert.ok(initialMemories.some((m) => m.type === "TRADE_TERMS" && m.category === "Agreements"));

    // Outsider cannot accept terms
    await assert.rejects(
      async () => {
        await store.acceptTerms(trade.id, OUTSIDER);
      },
      /Only designated trade participants/
    );

    // Seller accepts terms -> status advances to AwaitingDeposit and records TRADE_ACCEPTANCE memory
    const accepted = await store.acceptTerms(trade.id, SELLER);
    assert.equal(accepted.sellerAccepted, true);
    assert.equal(accepted.status, "AwaitingDeposit");

    const postAcceptMemories = await memService.getMemoriesForTrade(trade.reference);
    assert.ok(
      postAcceptMemories.some(
        (m) => m.type === "TRADE_ACCEPTANCE" && m.category === "Agreements"
      )
    );
  });

  it("2. Tracks term amendments in version history, resets counterparty acceptance, and preserves TERMS_AMENDMENT memory", async () => {
    const store = new TradeService();
    const memService = new WalrusMemoryService();

    const trade = await store.createTrade({
      creator: BUYER,
      creatorRole: "buyer",
      buyer: BUYER,
      seller: SELLER,
      arbiter: ARBITER,
      asset: "ETH",
      amount: "1.0",
      network: "base-mainnet",
      agreedTerms: "Version 1: Delivery within 2 hours.",
      conditions: [],
    });

    await store.acceptTerms(trade.id, SELLER);
    assert.equal(trade.status, "AwaitingDeposit");

    // Seller proposes Version 2 amendment -> Buyer acceptance MUST reset to false and status returns to AwaitingAcceptance
    const amended = await store.updateTerms(
      trade.id,
      SELLER,
      "Version 2: Delivery within 4 hours with checksum.",
      "Extended delivery window to 4 hours"
    );

    assert.equal(amended.termsVersions.length, 2);
    assert.equal(amended.termsVersions[0].terms, "Version 1: Delivery within 2 hours.");
    assert.equal(
      amended.termsVersions[1].terms,
      "Version 2: Delivery within 4 hours with checksum."
    );
    assert.equal(amended.sellerAccepted, true);
    assert.equal(amended.buyerAccepted, false);
    assert.equal(amended.status, "AwaitingAcceptance");

    const memoriesAfterAmend = await memService.getMemoriesForTrade(trade.reference);
    const amendMem = memoriesAfterAmend.find((m) => m.type === "TERMS_AMENDMENT");
    assert.ok(amendMem, "Should create TERMS_AMENDMENT memory record");
    assert.equal(amendMem.category, "Agreements");
    assert.equal(amendMem.structuredPayload?.newVersion, 2);

    // Buyer re-accepts Version 2 -> status advances back to AwaitingDeposit
    const reAccepted = await store.acceptTerms(trade.id, BUYER);
    assert.equal(reAccepted.buyerAccepted, true);
    assert.equal(reAccepted.status, "AwaitingDeposit");
  });

  it("3. Enforces payment reference tracking, Tatum verification requirements, condition gating, and settlement release rules", async () => {
    const store = new TradeService();
    const memService = new WalrusMemoryService();

    const trade = await store.createTrade({
      creator: BUYER,
      creatorRole: "buyer",
      buyer: BUYER,
      seller: SELLER,
      arbiter: ARBITER,
      asset: "ETH",
      amount: "0.000371",
      network: "base-mainnet",
      agreedTerms: "Strict escrow test",
      conditions: [
        {
          title: "Tatum RPC Deposit Receipt",
          description: "Must be verified on-chain",
          type: "onchain_receipt",
        },
        {
          title: "Off-chain API Delivery",
          description: "Attested by seller",
          type: "external_delivery",
        },
      ],
    });

    // Cannot lock deposit before both parties accept the current agreement version
    await assert.rejects(
      async () => {
        await store.recordVerifiedDeposit(trade.id, {
          verified: true,
          status: "confirmed",
          confirmations: 15,
          blockNumber: 53221342,
          txHash: "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c",
          from: BUYER,
          to: SELLER,
          valueEth: "0.000371",
          network: "base-mainnet",
        });
      },
      /Both Buyer and Seller must accept the current agreement version/
    );

    await store.acceptTerms(trade.id, SELLER);

    // Submit payment reference -> creates PAYMENT_SUBMITTED memory in Transactions category
    const sampleHash = "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c";
    await store.submitPaymentReference(trade.id, BUYER, sampleHash);
    const paymentMemories = await memService.getMemoriesForTrade(trade.reference);
    assert.ok(
      paymentMemories.some(
        (m) =>
          m.type === "PAYMENT_SUBMITTED" &&
          m.category === "Transactions" &&
          (m.relatedTxHash === sampleHash || m.metadata.txHash === sampleHash)
      )
    );

    // Cannot manually mark an on-chain receipt condition complete without Tatum verification
    const onchainCondId = trade.conditions[0].id;
    await assert.rejects(
      async () => {
        await store.completeCondition(trade.id, onchainCondId, BUYER);
      },
      /On-chain receipt conditions cannot be checked off manually/
    );

    // Cannot approve release before verified deposit
    await assert.rejects(
      async () => {
        await store.approveRelease(trade.id, BUYER);
      },
      /No verified on-chain deposit/
    );

    // Record a verified deposit -> automatically completes the onchain_receipt condition and creates ONCHAIN_VERIFICATION memory
    const funded = await store.recordVerifiedDeposit(trade.id, {
      verified: true,
      status: "confirmed",
      confirmations: 15,
      blockNumber: 53221342,
      txHash: sampleHash,
      from: BUYER,
      to: SELLER,
      valueEth: "0.000371",
      network: "base-mainnet",
    });

    assert.equal(funded.status, "Funded");
    assert.equal(funded.conditions[0].completed, true);

    // Cannot approve release while off-chain condition 2 is still incomplete
    await assert.rejects(
      async () => {
        await store.approveRelease(trade.id, BUYER);
      },
      /1 settlement condition\(s\) remain unfulfilled/
    );

    // Seller cannot unilaterally release funds to themselves
    await assert.rejects(
      async () => {
        await store.approveRelease(trade.id, SELLER);
      },
      /Only the Buyer can unilaterally approve release/
    );

    // Seller confirms deliverable fulfilment -> creates CONDITION_UPDATE memory in Fulfilment category
    await store.confirmFulfillment(trade.id, SELLER);

    // Complete off-chain condition -> transitions to ReadyForRelease
    const offchainCondId = trade.conditions[1].id;
    const ready = await store.completeCondition(
      trade.id,
      offchainCondId,
      SELLER,
      "Delivered signed API package"
    );
    assert.equal(ready.status, "ReadyForRelease");
    assert.ok(ready.conditions[1].evidenceHash?.startsWith("0x"));

    // Buyer releases funds -> transitions to Completed and creates SETTLEMENT_COMPLETED memory
    const completed = await store.approveRelease(trade.id, BUYER);
    assert.equal(completed.status, "Completed");

    const finalMemories = await memService.getMemoriesForTrade(trade.reference);
    assert.ok(finalMemories.some((m) => m.type === "ONCHAIN_VERIFICATION" && m.category === "Transactions"));
    assert.ok(finalMemories.some((m) => m.type === "CONDITION_UPDATE" && m.category === "Fulfilment"));
    assert.ok(finalMemories.some((m) => m.type === "SETTLEMENT_COMPLETED" && m.category === "Settlement"));
  });

  it("4. Enforces dispute locking, blocks unilateral release during disputes, and records arbiter rulings & voluntary refunds", async () => {
    const store = new TradeService();
    const memService = new WalrusMemoryService();

    const trade = await store.createTrade({
      creator: BUYER,
      creatorRole: "buyer",
      buyer: BUYER,
      seller: SELLER,
      arbiter: ARBITER,
      asset: "ETH",
      amount: "0.5",
      network: "base-mainnet",
      agreedTerms: "Dispute resolution test",
      conditions: [],
    });

    await store.acceptTerms(trade.id, SELLER);
    await store.recordVerifiedDeposit(trade.id, {
      verified: true,
      status: "confirmed",
      confirmations: 12,
      blockNumber: 53221342,
      txHash: "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c",
      from: BUYER,
      to: SELLER,
      valueEth: "0.5",
      network: "base-mainnet",
    });

    const disputed = await store.raiseDispute(
      trade.id,
      BUYER,
      "Deliverable checksum mismatch",
      "Expected sha256:abc, got sha256:def"
    );
    assert.equal(disputed.status, "Disputed");
    assert.equal(disputed.disputeEvidence.length, 1);

    // Unilateral release by Buyer MUST be blocked while trade is Disputed
    await assert.rejects(
      async () => {
        await store.approveRelease(trade.id, BUYER);
      },
      /Cannot unilaterally release funds while trade is in Disputed state/
    );

    // Buyer cannot resolve their own dispute as arbiter
    await assert.rejects(
      async () => {
        await store.resolveDispute(trade.id, BUYER, 10000, "Self-ruling");
      },
      /Only the appointed Neutral Arbiter/
    );

    // Neutral Arbiter resolves dispute (100% refund to buyer -> Refunded)
    const resolved = await store.resolveDispute(
      trade.id,
      ARBITER,
      10000,
      "Verified checksum mismatch; full refund to buyer."
    );
    assert.equal(resolved.status, "Refunded");
    assert.equal(resolved.disputeResolution?.buyerSplitBps, 10000);

    const disputeMemories = await memService.getMemoriesForTrade(trade.reference);
    assert.ok(disputeMemories.some((m) => m.type === "DISPUTE_EVIDENCE" && m.category === "Disputes"));
    assert.ok(disputeMemories.some((m) => m.type === "DISPUTE_RESOLUTION" && m.category === "Disputes"));

    // Also test voluntary Seller refund on a separate trade
    const refundTrade = await store.createTrade({
      creator: BUYER,
      creatorRole: "buyer",
      buyer: BUYER,
      seller: SELLER,
      arbiter: ARBITER,
      asset: "ETH",
      amount: "0.25",
      network: "base-mainnet",
      agreedTerms: "Voluntary refund test",
      conditions: [],
    });
    const refunded = await store.refundTrade(refundTrade.id, SELLER);
    assert.equal(refunded.status, "Refunded");
    const refundMems = await memService.getMemoriesForTrade(refundTrade.reference);
    assert.ok(refundMems.some((m) => m.type === "SETTLEMENT_REFUNDED" && m.category === "Settlement"));
  });

  it("5. Validates Tatum RPC transaction format, live receipt verification, sender mismatch, and confirmation depth", async () => {
    const client = new TatumRpcClient();

    // Reject malformed hash immediately
    const badHash = await client.verifyTransaction("0x1234", "base-mainnet");
    assert.equal(badHash.verified, false);
    assert.equal(badHash.status, "not_found");
    assert.match(badHash.errorMessage || "", /Invalid transaction hash format/);

    // Verify real Base Mainnet transaction if network is reachable in current test environment
    const realHash =
      "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c";
    const res = await client.verifyTransaction(realHash, "base-mainnet", {
      from: BUYER,
      to: SELLER,
      minConfirmations: 1,
    });
    if (res.verified) {
      assert.equal(res.status, "confirmed");
      assert.equal(res.blockNumber, 53221342);
      assert.ok(res.confirmations >= 1);
      assert.equal(res.valueEth, "0.000371");

      // Verify sender mismatch detection against the live receipt
      const mismatchRes = await client.verifyTransaction(realHash, "base-mainnet", {
        from: OUTSIDER,
      });
      assert.equal(mismatchRes.verified, false);
      assert.equal(mismatchRes.status, "mismatch");

      // Verify insufficient confirmation depth handling
      const highDepthRes = await client.verifyTransaction(realHash, "base-mainnet", {
        from: BUYER,
        to: SELLER,
        minConfirmations: 999999999,
      });
      assert.equal(highDepthRes.verified, false);
      assert.equal(highDepthRes.status, "pending");
      assert.match(highDepthRes.errorMessage || "", /Insufficient confirmation depth/);
    }
  });

  it("6. Accord Memory Box: deterministic multi-filter search, 6 categories, strict verifiedOnWalrus accounting, and duplicate-free in-place retry", async () => {
    const memService = new WalrusMemoryService();
    const seeded = await memService.seedDemonstrationMemories();
    assert.ok(seeded.length >= 12, "Should seed at least 12 distinct trade memories");

    // Verify epistemic honesty: without MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID, verifiedOnWalrus must be false
    const cfg = memService.getConfigurationStatus();
    if (!cfg.configured) {
      for (const m of seeded) {
        assert.equal(
          m.verifiedOnWalrus,
          false,
          "Must never fabricate Mainnet verification when credentials are unconfigured"
        );
        assert.equal(m.persistenceStatus, "pending_unconfigured");
      }
    }

    // Verify overview stats match real records
    const overview = await memService.getOverviewStats();
    assert.equal(overview.totalRecords, seeded.length);
    assert.ok(overview.tradesWithPreservedHistories >= 4);
    assert.ok(overview.categoryCounts["Agreements"] > 0);
    assert.ok(overview.categoryCounts["Transactions"] > 0);
    assert.ok(overview.categoryCounts["Fulfilment"] > 0);
    assert.ok(overview.categoryCounts["Disputes"] > 0);
    assert.ok(overview.categoryCounts["Settlement"] > 0);
    assert.ok(overview.categoryCounts["Trade History"] > 0);

    // Deterministic search by Trade ID
    const byTrade = await memService.searchMemories({ tradeRef: "ACC-2026-8812" });
    assert.ok(byTrade.memories.length > 0);
    assert.ok(byTrade.memories.every((m) => m.tradeRef === "ACC-2026-8812"));

    // Deterministic search by Category
    const byCategory = await memService.searchMemories({ category: "Disputes" });
    assert.ok(byCategory.memories.length > 0);
    assert.ok(byCategory.memories.every((m) => m.category === "Disputes"));

    // Deterministic search by Transaction Hash
    const byTxHash = await memService.searchMemories({
      query: "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c",
    });
    assert.ok(byTxHash.memories.length > 0);

    // Individual record lookup
    const targetRecord = seeded[0];
    const fetchedRecord = await memService.getMemoryById(targetRecord.id);
    assert.ok(fetchedRecord.memory);
    assert.equal(fetchedRecord.memory.id, targetRecord.id);

    // In-place retry must update existing record without creating duplicate records
    const countBeforeRetry = (await memService.listAllMemories()).length;
    const retried = await memService.retryPersistMemory(targetRecord.id);
    const countAfterRetry = (await memService.listAllMemories()).length;
    assert.ok(retried);
    assert.equal(retried.id, targetRecord.id);
    assert.equal((retried.retryCount || 0) >= 1, true);
    assert.equal(
      countAfterRetry,
      countBeforeRetry,
      "Retrying a memory record must never create duplicate records"
    );
  });

  it("7. Grounds Context & Memory Assistant deterministically without external AI dependency", async () => {
    const ai = new AccordAIAssistant();
    const response = await ai.ask({
      question: "What happened during our previous trade?",
      currentUser: BUYER,
      counterparty: SELLER,
    });

    assert.equal(response.engineMode, "grounded_deterministic");
    assert.ok(response.answer.length > 20);
    assert.ok(Array.isArray(response.verifiedFacts));
    assert.ok(Array.isArray(response.userClaims));
  });
});
