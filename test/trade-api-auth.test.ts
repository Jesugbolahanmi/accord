import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { createTradeActionTypedData } from "../lib/trades/action-auth";
import { tradeService } from "../lib/trades/store";

process.env.ACCORD_TEST_MODE = "1";

const signer = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);
const buyer = signer.address;
const seller = "0x0729e2a4716d9f7dd17858d5d504426d228697f7";
const origin = "http://localhost:3001";

after(() => {
  const testTradesFile = path.join(os.tmpdir(), `accord-test-trades-${process.pid}.json`);
  const testMemoriesFile = path.join(os.tmpdir(), `accord-test-memories-${process.pid}.json`);
  fs.rmSync(testTradesFile, { force: true });
  fs.rmSync(testMemoriesFile, { force: true });
});

test("trade creation API rejects forged creators and replays", async (t) => {
  const { POST } = await import("../app/api/trades/route");
  const previousMainnetFlag = process.env.ACCORD_ENABLE_MAINNET_ESCROW;
  const previousPublicMainnetFlag = process.env.NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED;
  const previousBaseAddress = process.env.ACCORD_ESCROW_BASE_MAINNET;
  delete process.env.ACCORD_ENABLE_MAINNET_ESCROW;
  delete process.env.NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED;
  delete process.env.ACCORD_ESCROW_BASE_MAINNET;
  t.after(() => {
    if (previousMainnetFlag === undefined) delete process.env.ACCORD_ENABLE_MAINNET_ESCROW;
    else process.env.ACCORD_ENABLE_MAINNET_ESCROW = previousMainnetFlag;
    if (previousPublicMainnetFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED = previousPublicMainnetFlag;
    }
    if (previousBaseAddress === undefined) delete process.env.ACCORD_ESCROW_BASE_MAINNET;
    else process.env.ACCORD_ESCROW_BASE_MAINNET = previousBaseAddress;
  });

  async function signedBody(overrides: Record<string, unknown> = {}) {
    const authorizationNonce = randomUUID();
    const issuedAt = BigInt(Math.floor(Date.now() / 1000));
    const payload = {
      action: "create_trade",
      authorizationNonce,
      creator: buyer,
      creatorRole: "buyer",
      buyer,
      seller,
      arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
      asset: "ETH",
      amount: "0.01",
      network: "base-sepolia",
      agreedTerms: "Test-only authorized trade.",
      conditions: [],
      expirationHours: 72,
      ...overrides,
    };
    const signature = await signer.signTypedData(
      createTradeActionTypedData({
        origin,
        tradeReference: `create:${authorizationNonce}`,
        payload,
        expectedUpdatedAt: BigInt(0),
        issuedAt,
        expiresAt: issuedAt + BigInt(300),
        chainId: 84532,
      })
    );

    return {
      ...payload,
      authorization: {
        signature,
        issuedAt: issuedAt.toString(),
        expiresAt: (issuedAt + BigInt(300)).toString(),
        expectedUpdatedAt: "0",
      },
    };
  }

  async function send(body: Record<string, unknown>) {
    return POST(
      new Request(`${origin}/api/trades`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  const disabledMainnetResponse = await send({ network: "base-mainnet" });
  assert.equal(disabledMainnetResponse.status, 503);

  const forged = await signedBody();
  forged.creator = "0x9999999999999999999999999999999999999999";
  assert.equal((await send(forged)).status, 401);

  const inconsistentRole = await signedBody({ creatorRole: "seller" });
  assert.equal((await send(inconsistentRole)).status, 400);

  const valid = await signedBody();
  const createResponse = await send(valid);
  assert.equal(createResponse.status, 201);
  assert.equal((await send(valid)).status, 409);

  const created = (await createResponse.json()) as {
    trade: { id: string; updatedAt: string; submittedTxHash?: string };
  };
  const { POST: verifyDeposit } = await import("../app/api/trades/[id]/verify/route");
  const verificationResponse = await verifyDeposit(
    new Request(`${origin}/api/trades/${created.trade.id}/verify`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        action: "verify_deposit",
        network: "base-sepolia",
        txHash: `0x${"12".repeat(32)}`,
        actor: buyer,
        authorization: valid.authorization,
      }),
    }),
    { params: Promise.resolve({ id: created.trade.id }) }
  );
  assert.equal(verificationResponse.status, 401);
  assert.equal((await tradeService.getTrade(created.trade.id))?.submittedTxHash, undefined);
});
