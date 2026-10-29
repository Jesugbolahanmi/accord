/**
 * Accord — Automated Integration & Security Test Suite
 *
 * Covers:
 * 1. Trade creation, invitation, and counterparty acceptance
 * 2. Agreement term amendments, version history tracking, and acceptance reset
 * 3. Escrow & settlement authorization rules (preventing self-arbitration, unauthorized release, unverified funding)
 * 4. Tatum RPC transaction verification (valid receipt, invalid hash, sender/recipient mismatch)
 * 5. Walrus Memory writes, semantic recall, and epistemic honesty (`verifiedOnWalrus`)
 * 6. Accord Context Assistant grounded responses separating verified facts from participant claims
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TradeService } from "../lib/trades/store";
import { TatumRpcClient } from "../lib/tatum/client";
import { WalrusMemoryService } from "../lib/walrus/memory";
import { AccordAIAssistant } from "../lib/assistant/accord-ai";

const BUYER = "0xf5bdce6674389d937df8ad3363c10fc3fa060b75";
const SELLER = "0x0729e2a4716d9f7dd17858d5d504426d228697f7";
const ARBITER = "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7";
const OUTSIDER = "0x9999999999999999999999999999999999999999";

describe("Accord Core Trading & Security Suite", () => {
  it("1. Creates a trade, validates neutral arbiter, and transitions to AwaitingDeposit on counterparty acceptance", async () => {
    const store = new TradeService();

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

    // Outsider cannot accept terms
    await assert.rejects(
      async () => {
        await store.acceptTerms(trade.id, OUTSIDER);
      },
      /Only designated trade participants/
    );

    // Seller accepts terms -> status advances to AwaitingDeposit
    const accepted = await store.acceptTerms(trade.id, SELLER);
    assert.equal(accepted.sellerAccepted, true);
    assert.equal(accepted.status, "AwaitingDeposit");
  });

  it("2. Tracks term amendments in version history and resets counterparty acceptance instead of silently overwriting", async () => {
    const store = new TradeService();
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

    // Buyer re-accepts Version 2 -> status advances back to AwaitingDeposit
    const reAccepted = await store.acceptTerms(trade.id, BUYER);
    assert.equal(reAccepted.buyerAccepted, true);
    assert.equal(reAccepted.status, "AwaitingDeposit");
  });

  it("3. Enforces real transaction security: prevents unverified funding, manual on-chain checkoffs, and unauthorized release", async () => {
    const store = new TradeService();
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

    await store.acceptTerms(trade.id, SELLER);

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

    // Record a verified deposit -> automatically completes the onchain_receipt condition
    const funded = await store.recordVerifiedDeposit(trade.id, {
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

    assert.equal(funded.status, "Funded");
    assert.equal(funded.conditions[0].completed, true);

    // Seller cannot unilaterally release funds to themselves
    await assert.rejects(
      async () => {
        await store.approveRelease(trade.id, SELLER);
      },
      /Only the Buyer can unilaterally approve release/
    );

    // Complete off-chain condition and Buyer releases funds
    const offchainCondId = trade.conditions[1].id;
    const ready = await store.completeCondition(
      trade.id,
      offchainCondId,
      SELLER,
      "Delivered signed API package"
    );
    assert.equal(ready.status, "ReadyForRelease");
    assert.ok(ready.conditions[1].evidenceHash?.startsWith("0x"));

    const completed = await store.approveRelease(trade.id, BUYER);
    assert.equal(completed.status, "Completed");
  });

  it("4. Enforces dispute locking and neutral arbiter resolution", async () => {
    const store = new TradeService();
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

    const disputed = await store.raiseDispute(
      trade.id,
      BUYER,
      "Deliverable checksum mismatch",
      "Expected sha256:abc, got sha256:def"
    );
    assert.equal(disputed.status, "Disputed");
    assert.equal(disputed.disputeEvidence.length, 1);

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
  });

  it("5. Validates Tatum RPC transaction format and live/gateway verification rules", async () => {
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
    });
    if (res.verified) {
      assert.equal(res.status, "confirmed");
      assert.equal(res.blockNumber, 53221342);
      assert.ok(res.confirmations > 0);
      assert.equal(res.valueEth, "0.000371");

      // Also verify sender mismatch detection against the live receipt
      const mismatchRes = await client.verifyTransaction(realHash, "base-mainnet", {
        from: OUTSIDER,
      });
      assert.equal(mismatchRes.verified, false);
      assert.equal(mismatchRes.status, "mismatch");
    }
  });

  it("6. Writes & recalls Walrus memories honestly and grounds Context Assistant answers", async () => {
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
      }
    }

    const recallRes = await memService.recall({
      query: "Base Mainnet",
      participant: BUYER,
      limit: 5,
    });
    assert.ok(recallRes.count > 0, "Should recall relevant memories for participant");

    const ai = new AccordAIAssistant();
    const response = await ai.ask({
      question: "What happened during our previous trade?",
      currentUser: BUYER,
      counterparty: SELLER,
    });

    assert.ok(response.answer.length > 20);
    assert.ok(Array.isArray(response.verifiedFacts));
    assert.ok(Array.isArray(response.userClaims));
  });
});

