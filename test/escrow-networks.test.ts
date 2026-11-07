import assert from "node:assert/strict";
import test from "node:test";
import { getEscrowAddress, isEscrowNetworkEnabled } from "../lib/contracts/escrow-config.server";
import {
  getEvmEscrowNetwork,
  isEvmEscrowNetwork,
} from "../lib/contracts/escrow-networks";
import { createEscrowPublicClient } from "../lib/contracts/verify-escrow-event";

test("EVM escrow registry maps each supported network to its chain", () => {
  assert.equal(getEvmEscrowNetwork("base-sepolia")?.chainId, 84532);
  assert.equal(getEvmEscrowNetwork("base-mainnet")?.chainId, 8453);
  assert.equal(getEvmEscrowNetwork("arbitrum-one")?.chainId, 42161);
  assert.equal(getEvmEscrowNetwork("ethereum-mainnet")?.chainId, 1);
  assert.equal(isEvmEscrowNetwork("solana-mainnet"), false);
  assert.equal(isEvmEscrowNetwork("sui-mainnet"), false);
  assert.equal(createEscrowPublicClient("arbitrum-one").chain?.id, 42161);
});

test("mainnet EVM escrow stays disabled until explicitly enabled with a valid address", (t) => {
  const keys = [
    "ACCORD_ENABLE_MAINNET_ESCROW",
    "NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED",
    "ACCORD_ESCROW_BASE_MAINNET",
    "ACCORD_ESCROW_ARBITRUM_ONE",
    "ACCORD_ESCROW_ETHEREUM_MAINNET",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  delete process.env.ACCORD_ENABLE_MAINNET_ESCROW;
  process.env.ACCORD_ESCROW_BASE_MAINNET = "0x1111111111111111111111111111111111111111";
  assert.equal(isEscrowNetworkEnabled("base-mainnet"), false);
  assert.equal(getEscrowAddress("base-mainnet"), undefined);

  process.env.ACCORD_ENABLE_MAINNET_ESCROW = "true";
  assert.equal(isEscrowNetworkEnabled("base-mainnet"), false);
  process.env.NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED = "true";
  assert.equal(isEscrowNetworkEnabled("base-mainnet"), true);
  assert.equal(
    getEscrowAddress("base-mainnet"),
    "0x1111111111111111111111111111111111111111"
  );
  assert.equal(isEscrowNetworkEnabled("arbitrum-one"), false);
});
