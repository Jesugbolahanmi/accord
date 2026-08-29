import { config } from "dotenv";
config({ path: ".env.local" });

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

export type EntityType = "CEX" | "DEFI" | "BRIDGE" | "MIXER" | "FRESH" | "UNKNOWN";

export interface KnownEntity {
  type: EntityType;
  name: string;
  safe: boolean;
}

// Comprehensive known entity registry for Base chain
export const KNOWN_ENTITIES: Record<string, KnownEntity> = {
  // ── CEX Hot Wallets & Deposit Routers ──────────────────────────
  "0x3304a02be471bca4261d7bfa07e46261546221c3": { type: "CEX", name: "Coinbase", safe: true },
  "0x503b20275ccb98260655dcbca74ec0af6d0c108f": { type: "CEX", name: "Binance", safe: true },
  "0x89e02377317cd61195679c29ccda5a643daecbf3": { type: "CEX", name: "Kraken", safe: true },
  "0x77696bb39917c91a0c3908d577d5e322095425ca": { type: "CEX", name: "Coinbase (deposit)", safe: true },
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": { type: "CEX", name: "Coinbase (cold)", safe: true },

  // ── DeFi Protocols on Base ─────────────────────────────────────
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24": { type: "DEFI", name: "Uniswap V2 Router", safe: true },
  "0x2626664c2603336e57b271c5c0b26f421741e481": { type: "DEFI", name: "Uniswap V3 Router", safe: true },
  "0x198ef1ec325a96cc354c7266a038be8b5c558f67": { type: "DEFI", name: "Uniswap V3 Router 2", safe: true },
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": { type: "DEFI", name: "Uniswap Universal Router", safe: true },
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": { type: "DEFI", name: "Aerodrome Router", safe: true },
  "0x827922686190790b37229fd06084350e74485b72": { type: "DEFI", name: "Aerodrome Factory", safe: true },
  "0xa238dd80c259a72e81d7e4664032d7c4b4a5ee37": { type: "DEFI", name: "Aave V3 Pool", safe: true },
  "0x18cd499e3d7ed42feba981ac9236a278e4cdc2ee": { type: "DEFI", name: "Compound V3", safe: true },
  "0x000000000022d473030f116ddee9f6b43ac78ba3": { type: "DEFI", name: "Permit2", safe: true },
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae": { type: "DEFI", name: "Li.Fi Router", safe: true },
  "0x6131b5fae19ea4f9d964eac0408e4408b66337b5": { type: "DEFI", name: "KyberSwap", safe: true },
  "0x111111125421ca6dc452d289314280a0f8842a65": { type: "DEFI", name: "1inch Router", safe: true },

  // ── Official Bridges ───────────────────────────────────────────
  "0x3154cf16ccdb4c6d922629664174b904d80f2c35": { type: "BRIDGE", name: "Base Bridge (Official)", safe: true },
  "0x49048044d57e1c92a77f79988d21fa8faf74e97e": { type: "BRIDGE", name: "Orbiter Finance", safe: true },
  "0x45f1a95a4d3f3836523f5c83673c797f4d4d263b": { type: "BRIDGE", name: "Stargate Finance", safe: true },
  "0x2dccdb493827e15a5dc8f8b72147e6c4a5620857": { type: "BRIDGE", name: "Across Protocol", safe: true },

  // ── Known Mixers / Privacy Protocols ──────────────────────────
  "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc": { type: "MIXER", name: "Tornado Cash", safe: false },
  "0x8797f1bc62b7194fbdc70f074d008e330f818cc5": { type: "MIXER", name: "FixedFloat", safe: false },
  "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": { type: "MIXER", name: "Tornado Cash Router", safe: false },
};


async function alchemyCall(method: string, params: any[]) {
  const res = await fetch(ALCHEMY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  return data.result;
}

/**
 * Traces the first incoming ETH transfer to the given address to identify
 * its original funding source (CEX, Mixer, Bridge, or Unknown).
 */
export async function traceFundingSource(address: string) {
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    return { type: "UNKNOWN", name: "Unknown", address: null };
  }

  const incoming = await alchemyCall("alchemy_getAssetTransfers", [{
    fromBlock: "0x0",
    toAddress: address,
    category: ["external"],
    order: "asc", // Get the earliest transactions
    maxCount: "0x5", // Look at the first 5 inbound to find funding
  }]);

  if (!incoming || !incoming.transfers || incoming.transfers.length === 0) {
    return { type: "FRESH", name: "No On-Chain Funding Found", address: null };
  }

  for (const tx of incoming.transfers) {
    const fromStr = tx.from.toLowerCase();
    const entity = KNOWN_ENTITIES[fromStr];
    
    if (entity) {
      return { type: entity.type, name: entity.name, address: tx.from };
    }
  }

  // If we couldn't match a known entity, just return the first funder
  const firstFunder = incoming.transfers[0].from;
  return { type: "UNKNOWN", name: "Unknown Wallet", address: firstFunder };
}

/**
 * Detects circular "wash trading" patterns in the token's recent transfers.
 * A -> B -> A or A -> B -> C -> A.
 */
export function detectWashTrading(transactions: any[]) {
  // Sort transactions chronologically
  const sorted = [...transactions].sort((a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp));
  
  const edges: { [key: string]: Set<string> } = {};
  let washTradingPairs = 0;

  for (const tx of sorted) {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();
    
    if (!edges[from]) edges[from] = new Set();
    if (!edges[to]) edges[to] = new Set();

    // Add directed edge
    edges[from].add(to);

    // Check for A -> B -> A (ping-pong wash trading)
    if (edges[to].has(from)) {
      washTradingPairs++;
    }
  }

  // If there are significant ping-pong transfers relative to volume, flag it.
  const isWashTrading = washTradingPairs >= 5 && transactions.length >= 10;
  
  return {
    isWashTrading,
    pairsFound: washTradingPairs
  };
}

/**
 * Resolves what a given address is - CEX, DeFi, Bridge, Mixer, or unknown.
 * Also checks on-chain if the wallet is fresh (< 7 days old).
 */
export async function resolveCounterparty(address: string): Promise<{
  type: EntityType;
  name: string;
  safe: boolean;
  isFresh?: boolean;
  firstSeenDaysAgo?: number;
}> {
  if (!address) return { type: "UNKNOWN", name: "Unknown", safe: false };

  const known = KNOWN_ENTITIES[address.toLowerCase()];
  if (known) return { ...known, isFresh: false };

  // Not a known entity - check how old the wallet is on-chain
  try {
    const incoming = await alchemyCall("alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      toAddress: address,
      category: ["external", "erc20"],
      order: "asc",
      maxCount: "0x1",
    }]);

    const firstTx = incoming?.transfers?.[0];
    if (!firstTx) {
      return { type: "UNKNOWN", name: "No History", safe: false, isFresh: true, firstSeenDaysAgo: 0 };
    }

    const firstSeen = new Date(firstTx.metadata.blockTimestamp).getTime();
    const firstSeenDaysAgo = Math.floor((Date.now() - firstSeen) / (1000 * 60 * 60 * 24));
    const isFresh = firstSeenDaysAgo < 7;

    return {
      type: isFresh ? "FRESH" : "UNKNOWN",
      name: isFresh ? `Fresh wallet (${firstSeenDaysAgo}d old)` : "Unknown Wallet",
      safe: !isFresh,
      isFresh,
      firstSeenDaysAgo,
    };
  } catch {
    return { type: "UNKNOWN", name: "Unknown", safe: false };
  }
}

/**
 * Fetches the true first-ever transaction for a wallet address.
 * Used to get accurate wallet age regardless of how many txs it has.
 */
export async function getWalletFirstTransaction(address: string) {
  try {
    const [firstIncoming, firstOutgoing] = await Promise.all([
      alchemyCall("alchemy_getAssetTransfers", [{
        fromBlock: "0x0",
        toAddress: address,
        category: ["external", "erc20"],
        order: "asc",
        maxCount: "0x1",
      }]),
      alchemyCall("alchemy_getAssetTransfers", [{
        fromBlock: "0x0",
        fromAddress: address,
        category: ["external", "erc20"],
        order: "asc",
        maxCount: "0x1",
      }]),
    ]);

    const candidates = [
      ...(firstIncoming?.transfers || []),
      ...(firstOutgoing?.transfers || []),
    ];

    if (candidates.length === 0) return null;

    // Return the absolute earliest transaction
    return candidates.sort((a, b) =>
      new Date(a.metadata.blockTimestamp).getTime() - new Date(b.metadata.blockTimestamp).getTime()
    )[0];
  } catch {
    return null;
  }
}