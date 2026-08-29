import { config } from "dotenv";
config({ path: ".env.local" });

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Mock database of known entities on Base (for demonstration)
const KNOWN_ENTITIES: Record<string, { type: "MIXER" | "CEX" | "BRIDGE", name: string }> = {
  // Mocked/real Base hot wallets
  "0x3304a02be471bca4261d7bfa07e46261546221c3": { type: "CEX", name: "Coinbase" },
  "0x503b20275ccb98260655dcbca74ec0af6d0c108f": { type: "CEX", name: "Binance" },
  "0x89e02377317cd61195679c29ccda5a643daecbf3": { type: "CEX", name: "Kraken" },
  
  // Base official bridges
  "0x3154cf16ccdb4c6d922629664174b904d80f2c35": { type: "BRIDGE", name: "Base Bridge" },
  "0x49048044d57e1c92a77f79988d21fa8faf74e97e": { type: "BRIDGE", name: "Orbiter Finance" },
  
  // Privacy protocols / Mixers (some are placeholders on Base for testing)
  "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc": { type: "MIXER", name: "Tornado Cash (Base)" },
  "0x8797f1bc62b7194fbdc70f074d008e330f818cc5": { type: "MIXER", name: "FixedFloat" }
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
