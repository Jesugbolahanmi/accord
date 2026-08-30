import { getWalletTransactions } from "./basescan";
import { KNOWN_ENTITIES, resolveCounterparty } from "./graph";

// ── Types ──────────────────────────────────────────────────────────────────
export interface TraceHop {
  address: string;
  label: string;
  entityType: string;
  safe: boolean;
  isFresh?: boolean;
  incomingFrom?: string;
  incomingAmount?: string;
  outflowTo?: string;
  outflowAmount?: string;
  outflowToLabel?: string;
  outflowToEntityType?: string;
  outflowToSafe?: boolean;
}

export interface TreeNode {
  id: string;           // lowercase address
  address: string;
  label: string;
  entityType: string;
  safe: boolean;
  isFresh?: boolean;
  amount?: string;      // incoming ETH amount
  isCenter?: boolean;
}

export interface TreeEdge {
  from: string;
  to: string;
  label: string;
  isRisky: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getTopOutflows(transactions: any[], address: string, topN = 3) {
  const ethOutgoing = transactions.filter(
    (tx: any) =>
      tx.from.toLowerCase() === address.toLowerCase() &&
      tx.decimal === 18 &&
      (tx.asset === "ETH" || tx.asset === "" || !tx.asset) &&
      tx.to && tx.to.toLowerCase() !== address.toLowerCase()
  );

  // Deduplicate by destination — keep largest transfer per destination
  const byDest = new Map<string, any>();
  for (const tx of ethOutgoing) {
    const dest = tx.to.toLowerCase();
    if (!byDest.has(dest) || BigInt(tx.value) > BigInt(byDest.get(dest).value)) {
      byDest.set(dest, tx);
    }
  }

  // Sort by value descending, take top N
  return [...byDest.values()]
    .sort((a, b) => (BigInt(b.value) > BigInt(a.value) ? 1 : -1))
    .slice(0, topN);
}

async function resolveNode(address: string): Promise<Omit<TreeNode, "id" | "amount" | "isCenter">> {
  const known = KNOWN_ENTITIES[address.toLowerCase()];
  if (known) {
    return { address, label: known.name, entityType: known.type, safe: known.safe };
  }
  try {
    const resolved = await resolveCounterparty(address);
    return {
      address,
      label: resolved.name || "Unknown Wallet",
      entityType: resolved.type || "UNKNOWN",
      safe: resolved.safe ?? false,
      isFresh: resolved.isFresh ?? false,
    };
  } catch {
    return { address, label: "Unknown Wallet", entityType: "UNKNOWN", safe: false };
  }
}

// ── BFS Multi-Hop Tree Tracer ──────────────────────────────────────────────
/**
 * Traces fund flows as a branching tree using BFS.
 * - breadth: top N outflows per wallet (default 3)
 * - depth: max hops from origin (default 2)
 * - Terminates branches early at known-safe entities (CEX, DeFi, Bridge)
 */
export async function traceFundsTree(
  startAddress: string,
  maxDepth = 2,
  breadth = 3
): Promise<{ nodes: TreeNode[]; edges: TreeEdge[] }> {
  const nodes = new Map<string, TreeNode>();
  const edges: TreeEdge[] = [];
  const visited = new Set<string>();

  // Queue entries: [address, depth]
  const queue: [string, number][] = [[startAddress.toLowerCase(), 0]];

  // Add the center node
  nodes.set(startAddress.toLowerCase(), {
    id: startAddress.toLowerCase(),
    address: startAddress,
    label: "TARGET_WALLET",
    entityType: "CENTER",
    safe: false,
    isCenter: true,
  });

  while (queue.length > 0) {
    const [currentAddr, depth] = queue.shift()!;

    if (visited.has(currentAddr)) continue;
    visited.add(currentAddr);

    if (depth >= maxDepth) continue;

    // Resolve entity type for current node if not already done
    if (!nodes.has(currentAddr)) {
      const resolved = await resolveNode(currentAddr);
      nodes.set(currentAddr, { id: currentAddr, ...resolved });
    }

    const currentNode = nodes.get(currentAddr)!;

    // Don't trace forward from safe known entities — they're terminal
    if (currentNode.safe && !currentNode.isCenter) continue;

    let transactions: any[] = [];
    try {
      transactions = await getWalletTransactions(currentAddr);
    } catch {
      continue; // Skip on Alchemy error
    }

    const topOutflows = getTopOutflows(transactions, currentAddr, breadth);
    if (topOutflows.length === 0) continue;

    // Process each outflow destination
    await Promise.all(
      topOutflows.map(async (tx) => {
        const destAddr = tx.to.toLowerCase();
        const ethAmount = (Number(BigInt(tx.value)) / 1e18).toFixed(4);

        // Resolve destination
        if (!nodes.has(destAddr)) {
          const resolved = await resolveNode(tx.to);
          nodes.set(destAddr, { id: destAddr, amount: ethAmount, ...resolved });
        }

        const destNode = nodes.get(destAddr)!;

        // Add edge
        const edgeExists = edges.some(e => e.from === currentAddr && e.to === destAddr);
        if (!edgeExists) {
          edges.push({
            from: currentAddr,
            to: destAddr,
            label: `${ethAmount} ETH`,
            isRisky: !destNode.safe,
          });
        }

        // Queue destination for further tracing if not safe and not visited
        if (!destNode.safe && !visited.has(destAddr) && depth + 1 < maxDepth) {
          queue.push([destAddr, depth + 1]);
        }
      })
    );
  }

  return {
    nodes: [...nodes.values()],
    edges,
  };
}

// ── Legacy linear tracer (kept for backward compatibility) ─────────────────
export async function traceFunds(
  startAddress: string,
  maxHops: number = 4
): Promise<TraceHop[]> {
  const trail: TraceHop[] = [];
  const visited = new Set<string>();
  let currentAddress = startAddress;
  let incomingFrom: string | undefined = undefined;
  let incomingAmount: string | undefined = undefined;

  for (let hop = 0; hop < maxHops; hop++) {
    if (visited.has(currentAddress.toLowerCase())) break;
    visited.add(currentAddress.toLowerCase());

    const transactions = await getWalletTransactions(currentAddress);

    const ethOutgoing = transactions.filter(
      (tx: any) =>
        tx.from.toLowerCase() === currentAddress.toLowerCase() &&
        tx.decimal === 18 &&
        (tx.asset === "ETH" || tx.asset === "" || !tx.asset)
    );

    const currentEntityRaw = KNOWN_ENTITIES[currentAddress.toLowerCase()];
    let currentLabel = "Unknown Wallet";
    let currentEntityType = "UNKNOWN";
    let currentSafe = false;
    let currentFresh = false;

    if (currentEntityRaw) {
      currentLabel = currentEntityRaw.name;
      currentEntityType = currentEntityRaw.type;
      currentSafe = currentEntityRaw.safe;
    } else if (hop > 0) {
      try {
        const resolved = await resolveCounterparty(currentAddress);
        currentLabel = resolved.name;
        currentEntityType = resolved.type;
        currentSafe = resolved.safe;
        currentFresh = resolved.isFresh ?? false;
      } catch { /* Leave as Unknown */ }
    }

    if (ethOutgoing.length === 0) {
      trail.push({ address: currentAddress, label: currentLabel, entityType: currentEntityType, safe: currentSafe, isFresh: currentFresh, incomingFrom, incomingAmount });
      break;
    }

    const largest = ethOutgoing.reduce((max: any, tx: any) =>
      BigInt(tx.value) > BigInt(max.value) ? tx : max
    );
    const valueInEth = (Number(BigInt(largest.value)) / 1e18).toFixed(4);
    const destAddress: string = largest.to;
    const destEntityRaw = KNOWN_ENTITIES[destAddress.toLowerCase()];
    let destLabel = "Unknown Wallet";
    let destEntityType = "UNKNOWN";
    let destSafe = false;

    if (destEntityRaw) {
      destLabel = destEntityRaw.name;
      destEntityType = destEntityRaw.type;
      destSafe = destEntityRaw.safe;
    }

    trail.push({ address: currentAddress, label: currentLabel, entityType: currentEntityType, safe: currentSafe, isFresh: currentFresh, incomingFrom, incomingAmount, outflowTo: destAddress, outflowAmount: valueInEth, outflowToLabel: destLabel, outflowToEntityType: destEntityType, outflowToSafe: destSafe });

    if (destSafe) break;
    incomingFrom = currentAddress;
    incomingAmount = valueInEth;
    currentAddress = destAddress;
  }

  return trail;
}