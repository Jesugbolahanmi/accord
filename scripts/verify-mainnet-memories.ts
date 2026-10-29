/**
 * Accord — Live Integration & Mainnet Memory Verification Script
 *
 * Run via: pnpm run verify-memories
 */

import fs from "node:fs";
import path from "node:path";
import { walrusMemory } from "../lib/walrus/memory";
import { tatum } from "../lib/tatum/client";

// Load .env.local if present
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const raw = fs.readFileSync(envLocalPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  console.log("==================================================================");
  console.log("  ACCORD — TATUM RPC & WALRUS MEMORY MAINNET VERIFICATION SUITE");
  console.log("==================================================================\n");

  // 1. Verify Tatum RPC Gateway on Base Mainnet
  console.log("[1/3] Probing Tatum Gateway JSON-RPC (https://base-mainnet.gateway.tatum.io)...");
  const diag = await tatum.diagnose("base-mainnet");
  console.log(`  • Status       : ${diag.status.toUpperCase()} (${diag.latencyMs} ms)`);
  console.log(`  • Block Height : #${diag.blockNumber}`);
  console.log(
    `  • API Key Mode : ${
      diag.apiKeyConfigured ? "Authenticated (x-api-key)" : "Public Gateway Tier"
    }`
  );

  const realBaseTx =
    "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c";
  const txVerify = await tatum.verifyTransaction(realBaseTx, "base-mainnet", {
    from: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
    to: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
  });
  console.log(
    `  • Live Tx Proof: ${txVerify.verified ? "VERIFIED (0x1)" : "UNVERIFIED"} | Block #${
      txVerify.blockNumber
    } | Confirmations: ${txVerify.confirmations} | Value: ${txVerify.valueEth} ETH\n`
  );

  // 2. Check Walrus Memory Mainnet Relayer & Credentials
  console.log("[2/3] Checking Walrus Memory Mainnet Relayer (https://relayer.memory.walrus.xyz)...");
  const health = await walrusMemory.checkRelayerHealth();
  console.log(`  • Relayer URL  : ${health.url}`);
  console.log(`  • Relayer State: ${health.status} (mode: ${health.mode}, writesReady: ${health.writesReady})`);
  if (health.packageId) {
    console.log(`  • Sui Package  : ${health.packageId}`);
    console.log(`  • Sui Registry : ${health.registryId}`);
  }
  console.log(
    `  • Credentials  : ${
      health.configStatus.configured
        ? `CONFIGURED (Account ${health.configStatus.accountIdPreview})`
        : `MISSING (${health.configStatus.missingEnvVars.join(", ")} in .env.local)`
    }\n`
  );

  // 3. Seed & Recall 12 Distinct Trade Memories
  console.log("[3/3] Executing 12 Trade Memory Writes & Semantic Recall...");
  const memories = await walrusMemory.seedDemonstrationMemories(true);
  const mainnetCount = memories.filter((m) => m.verifiedOnWalrus).length;

  console.log(`  • Total Memories Indexed     : ${memories.length}`);
  console.log(`  • Mainnet Relayer Confirmed  : ${mainnetCount}/${memories.length}`);

  const recallRes = await walrusMemory.recall({
    query: "Base Mainnet deposit verification",
    limit: 5,
  });
  console.log(`  • Recall Query Matches       : ${recallRes.count} (source: ${recallRes.source})\n`);

  for (const [idx, m] of memories.entries()) {
    console.log(
      `  [${String(idx + 1).padStart(2, "0")}] ${m.tradeRef.padEnd(16)} | ${m.type.padEnd(
        20
      )} | Mainnet: ${String(m.verifiedOnWalrus).padEnd(5)} | Job/ID: ${m.jobId || m.id}`
    );
  }

  if (!health.configStatus.configured) {
    console.log("\n------------------------------------------------------------------");
    console.log("ACTION REQUIRED FOR LIVE SUI SEAL MAINNET BLOB ANCHORING:");
    console.log("  1. Open https://memory.walrus.xyz and register a MemWal Account.");
    console.log("  2. Add MEMWAL_ACCOUNT_ID and MEMWAL_PRIVATE_KEY to .env.local.");
    console.log("  3. Re-run `pnpm run verify-memories` to anchor all 12 memories on Mainnet.");
    console.log("------------------------------------------------------------------");
  }
}

main().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});

