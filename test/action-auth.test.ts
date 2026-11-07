import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  createTradeActionTypedData,
  getTradeActionChainId,
  getAuthorizedPayload,
  hashTradeActionPayload,
  verifyTradeActionSignature,
} from "../lib/trades/action-auth";

const signer = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);
const origin = "http://localhost:3001";
const tradeReference = "ACC-TEST-1001";
const chainId = 84532;
const expectedUpdatedAt = BigInt(Date.now());
const issuedAt = BigInt(Math.floor(Date.now() / 1000));
const expiresAt = issuedAt + BigInt(300);
const payload = {
  action: "complete_condition",
  conditionId: "condition-1",
  attestationNote: "Test delivery",
  actor: signer.address,
};

test("wallet action signatures authorize only the exact current trade action", async () => {
  const signedPayload = getAuthorizedPayload(payload);
  const typedData = createTradeActionTypedData({
    origin,
    tradeReference,
    payload: signedPayload,
    expectedUpdatedAt,
    issuedAt,
    expiresAt,
    chainId,
  });
  const signature = await signer.signTypedData(typedData);
  const authorization = {
    signature,
    issuedAt: issuedAt.toString(),
    expiresAt: expiresAt.toString(),
    expectedUpdatedAt: expectedUpdatedAt.toString(),
  };

  assert.equal(
    await verifyTradeActionSignature({
      address: signer.address,
      signature,
      authorization,
      origin,
      tradeReference,
      payload: signedPayload,
      chainId,
      expectedUpdatedAt,
    }),
    true
  );
  assert.equal(
    await verifyTradeActionSignature({
      address: signer.address,
      signature,
      authorization,
      origin,
      tradeReference,
      payload: { ...signedPayload, conditionId: "condition-2" },
      chainId,
      expectedUpdatedAt,
    }),
    false
  );
  assert.equal(
    await verifyTradeActionSignature({
      address: signer.address,
      signature,
      authorization,
      origin: "https://attacker.example",
      tradeReference,
      payload: signedPayload,
      chainId,
      expectedUpdatedAt,
    }),
    false
  );
  assert.equal(
    await verifyTradeActionSignature({
      address: signer.address,
      signature,
      authorization,
      origin,
      tradeReference,
      payload: signedPayload,
      chainId,
      expectedUpdatedAt: expectedUpdatedAt + BigInt(1),
    }),
    false
  );
});

test("action hashes are independent of JSON object key order", () => {
  assert.equal(
    hashTradeActionPayload({ action: "raise_dispute", details: { b: 2, a: 1 } }),
    hashTradeActionPayload({ details: { a: 1, b: 2 }, action: "raise_dispute" })
  );
});

test("EVM mainnet trade authorizations use the selected chain IDs", () => {
  assert.equal(getTradeActionChainId("base-mainnet"), 8453);
  assert.equal(getTradeActionChainId("arbitrum-one"), 42161);
  assert.equal(getTradeActionChainId("ethereum-mainnet"), 1);
});
