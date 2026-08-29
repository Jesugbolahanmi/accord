import { getWalletTransactions } from "./basescan";
import { KNOWN_ENTITIES, resolveCounterparty } from "./graph";

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

/**
 * Follows the largest ETH outflow forward through up to `maxHops` wallets,
 * resolving each destination's entity type (CEX, DeFi, Mixer, Fresh, Unknown).
 * Returns a trail of hops suitable for rendering as a multi-level node graph.
 */
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
    if (visited.has(currentAddress.toLowerCase())) break; // Cycle guard
    visited.add(currentAddress.toLowerCase());

    const transactions = await getWalletTransactions(currentAddress);

    // Find the largest native ETH outflow from this address
    // Alchemy returns asset="ETH" for native transfers — must allow it
    const ethOutgoing = transactions.filter(
      (tx: any) =>
        tx.from.toLowerCase() === currentAddress.toLowerCase() &&
        tx.decimal === 18 &&
        (tx.asset === "ETH" || tx.asset === "" || !tx.asset)
    );

    // Resolve what the current hop wallet itself is
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
      // Only do on-chain age lookup for destination hops (not the origin wallet)
      try {
        const resolved = await resolveCounterparty(currentAddress);
        currentLabel = resolved.name;
        currentEntityType = resolved.type;
        currentSafe = resolved.safe;
        currentFresh = resolved.isFresh ?? false;
      } catch {
        // Leave as Unknown
      }
    }

    if (ethOutgoing.length === 0) {
      // This hop has no outflow — it's a dead end
      trail.push({
        address: currentAddress,
        label: currentLabel,
        entityType: currentEntityType,
        safe: currentSafe,
        isFresh: currentFresh,
        incomingFrom,
        incomingAmount,
      });
      break;
    }

    const largest = ethOutgoing.reduce((max: any, tx: any) =>
      BigInt(tx.value) > BigInt(max.value) ? tx : max
    );

    const valueInEth = (Number(BigInt(largest.value)) / 1e18).toFixed(4);

    // Resolve the destination of this outflow
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

    trail.push({
      address: currentAddress,
      label: currentLabel,
      entityType: currentEntityType,
      safe: currentSafe,
      isFresh: currentFresh,
      incomingFrom,
      incomingAmount,
      outflowTo: destAddress,
      outflowAmount: valueInEth,
      outflowToLabel: destLabel,
      outflowToEntityType: destEntityType,
      outflowToSafe: destSafe,
    });

    // If the destination is a known safe protocol (CEX, DeFi, Bridge) — stop here,
    // funds have reached a known endpoint.
    if (destSafe) break;

    // Otherwise continue tracing forward
    incomingFrom = currentAddress;
    incomingAmount = valueInEth;
    currentAddress = destAddress;
  }

  return trail;
}