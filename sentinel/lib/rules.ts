import { supabase } from "./supabase";
import { ActiveApproval, DetectedPermit } from "./approvals";

export interface TokenDetail {
  asset: string;
  from: string;
  to?: string;
  timestamp: string; // ISO date string
  value?: string;
  hash?: string;
  blockNum?: string;
  metadata?: {
    blockTimestamp?: string;
    decimal?: string;
  };
}

export interface Flag {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details?: TokenDetail[];
}

export function checkWalletAge(transactions: any[], accurateFirstTxTimestamp?: number | null): Flag | null {
  // Prefer the accurate first-ever tx timestamp if provided
  let firstTxTime: number;
  if (accurateFirstTxTimestamp) {
    firstTxTime = accurateFirstTxTimestamp;
  } else {
    if (transactions.length === 0) return null;
    const oldest = transactions[transactions.length - 1];
    firstTxTime = parseInt(oldest.timeStamp) * 1000;
  }

  const ageInDays = (Date.now() - firstTxTime) / (1000 * 60 * 60 * 24);

  if (ageInDays < 7) {
    return {
      type: "NEW_WALLET",
      severity: "medium",
      message: `Wallet is only ${Math.floor(ageInDays)} days old`,
    };
  }
  return null;
}

export function checkTransactionBurst(transactions: any[], knownSafeAddresses: Set<string> = new Set()): Flag | null {
  if (transactions.length < 5) return null;

  const recentFive = transactions.slice(0, 5);
  const timestamps = recentFive.map((tx) => parseInt(tx.timeStamp));
  const spreadSeconds = timestamps[0] - timestamps[4];

  if (spreadSeconds < 300) {
    // Only flag if transactions are going to multiple DIFFERENT unknown addresses
    // (e.g. a DeFi multi-step is approve + swap + stake — all to known contracts, not suspicious)
    const unknownDestinations = new Set(
      recentFive
        .map((tx) => tx.to?.toLowerCase())
        .filter((addr) => addr && !knownSafeAddresses.has(addr))
    );

    if (unknownDestinations.size >= 3) {
      return {
        type: "TRANSACTION_BURST",
        severity: "medium",
        message: `5 transactions to ${unknownDestinations.size} different unknown addresses within ${Math.floor(spreadSeconds / 60)} minutes — unusual activity pattern`,
      };
    }
  }
  return null;
}

export function checkLargeOutflow(transactions: any[], address: string): {
  flag: Flag | null;
  destinationAddress: string | null;
} {
  const outgoing = transactions.filter(
    (tx) => tx.from.toLowerCase() === address.toLowerCase()
  );
  if (outgoing.length === 0) return { flag: null, destinationAddress: null };

  // Accept native ETH: Alchemy returns asset="ETH" for external transfers,
  // or empty string in some edge cases. Either way, decimal should be 18.
  const ethOutgoing = outgoing.filter(
    (tx) => tx.decimal === 18 && (tx.asset === "ETH" || tx.asset === "" || !tx.asset)
  );
  if (ethOutgoing.length === 0) return { flag: null, destinationAddress: null };

  const largest = ethOutgoing.reduce((max: any, tx: any) =>
    BigInt(tx.value) > BigInt(max.value) ? tx : max
  );
  const valueInEth = Number(BigInt(largest.value)) / 1e18;

  if (valueInEth > 1) {
    return {
      flag: {
        type: "LARGE_OUTFLOW",
        severity: "high",
        message: `Large outgoing transfer of ${valueInEth.toFixed(4)} ETH detected`,
      },
      destinationAddress: largest.to || null,
    };
  }
  return { flag: null, destinationAddress: null };
}

export function checkPhishingTokenNames(transfers: any[]): Flag | null {
  const suspicious = transfers.filter((t) => {
    const asset = (t.asset || "").toLowerCase();
    return (
      asset.includes("http") ||
      asset.includes(".com") ||
      asset.includes(".net") ||
      asset.includes(".org") ||
      asset.includes("claim") ||
      asset.includes("check your")
    );
  });

  if (suspicious.length === 0) return null;

  // dangerous lure patterns: active links (t.me, http/https, URLs) or urgency language
  // these are HIGH regardless of count, since the risk is "will someone click this," not volume
  const hasActiveLure = suspicious.some((t) => {
    const asset = (t.asset || "").toLowerCase();
    return (
      asset.includes("t.me") ||
      asset.includes("http") ||
      asset.includes("claim until") ||
      asset.includes("claim before") ||
      /\*.*claim/.test(asset)
    );
  });

  const severity = hasActiveLure
    ? "high"
    : suspicious.length >= 10
    ? "high"
    : suspicious.length >= 3
    ? "medium"
    : "low";

  return {
    type: "PHISHING_AIRDROP",
    severity,
    message: `Received ${suspicious.length} token(s) with phishing-style names (e.g. "${suspicious[0].asset}")${hasActiveLure ? " — includes active scam links/urgency lures" : ""}`,
    details: suspicious.map((t) => ({
      asset: t.asset,
      from: t.from,
      timestamp: new Date(parseInt(t.timeStamp) * 1000).toISOString(),
    })),
  };
}

// Mock known safe contracts on Base for contextual scoring
const KNOWN_SAFE_CONTRACTS = [
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", // Uniswap Universal Router
  "0x2626664c2603336e57b271c5c0b26f421741e481", // Uniswap V3 Router
  "0x000000000022d473030f116ddee9f6b43ac78ba3", // Permit2
];

export async function checkApprovalRisks(
  approvals: ActiveApproval[] = [],
  permits: DetectedPermit[] = []
): Promise<Flag[]> {
  const flags: Flag[] = [];

  // Fetch blocklist for contextual scoring
  const { data: blocklist } = await supabase.from("blocklist").select("address, reason");
  const blockedSet = new Set((blocklist || []).map((b: any) => b.address.toLowerCase()));

  // Check for EOA approvals (approving a non-contract account)
  const eoaApprovals = approvals.filter((a) => !a.spenderIsContract);
  if (eoaApprovals.length > 0) {
    flags.push({
      type: "EOA_APPROVAL",
      severity: "high",
      message: `Granted token spending approval to ${eoaApprovals.length} Externally Owned Account(s) (non-contract) — legitimate protocols rarely use EOAs as spenders.`,
      details: eoaApprovals.map((a) => ({
        asset: `${a.tokenSymbol} (${a.allowanceFormatted})`,
        from: a.spender,
        timestamp: new Date().toISOString(),
      })),
    });
  }

  // Check for unlimited approvals with contextual scoring
  const unlimitedApprovals = approvals.filter((a) => a.isUnlimited);
  for (const a of unlimitedApprovals) {
    const spenderNormalized = a.spender.toLowerCase();
    
    if (blockedSet.has(spenderNormalized)) {
      flags.push({
        type: "UNLIMITED_APPROVAL_MALICIOUS",
        severity: "critical",
        message: `CRITICAL: Unlimited approval granted to known malicious contract. Immediate revocation required.`,
        details: [{ asset: `${a.tokenSymbol} (UNLIMITED)`, from: a.spender, timestamp: new Date().toISOString() }],
      });
    } else if (KNOWN_SAFE_CONTRACTS.includes(spenderNormalized)) {
      flags.push({
        type: "UNLIMITED_APPROVAL_SAFE",
        severity: "low",
        message: `Unlimited approval granted to verified safe contract (e.g. Uniswap/Permit2). Low risk.`,
        details: [{ asset: `${a.tokenSymbol} (UNLIMITED)`, from: a.spender, timestamp: new Date().toISOString() }],
      });
    } else {
      flags.push({
        type: "UNLIMITED_APPROVAL_UNKNOWN",
        severity: "high",
        message: `Unlimited approval granted to unknown contract. High risk if contract is exploited.`,
        details: [{ asset: `${a.tokenSymbol} (UNLIMITED)`, from: a.spender, timestamp: new Date().toISOString() }],
      });
    }
  }

  if (unlimitedApprovals.length === 0 && approvals.length >= 3) {
    flags.push({
      type: "EXPOSED_APPROVALS",
      severity: "medium",
      message: `Wallet maintains ${approvals.length} active unrevoked token allowances across contracts.`,
      details: approvals.map((a) => ({
        asset: `${a.tokenSymbol} (${a.allowanceFormatted})`,
        from: a.spender,
        timestamp: new Date().toISOString(),
      })),
    });
  }

  // Check for permit executions
  if (permits.length > 0) {
    flags.push({
      type: "PERMIT_DETECTED",
      severity: "medium",
      message: `Detected ${permits.length} direct offchain/onchain permit signature execution(s) (EIP-2612 / DAI-Permit) granting token allowances.`,
      details: permits.map((p) => ({
        asset: p.type,
        from: p.to,
        hash: p.txHash,
        timestamp: p.timestamp || new Date().toISOString(),
      })),
    });
  }

  return flags;
}

export async function runAllChecks(
  transactions: any[],
  address: string,
  approvals: ActiveApproval[] = [],
  permits: DetectedPermit[] = [],
  firstTxTimestamp?: number | null,
  knownSafeAddresses: Set<string> = new Set()
): Promise<{ flags: Flag[]; outflowDestination: string | null }> {
  const flags: Flag[] = [];
  let outflowDestination: string | null = null;

  // Use provided accurate first-tx timestamp if available, else fall back to sample
  const walletAgeFlag = checkWalletAge(transactions, firstTxTimestamp);
  if (walletAgeFlag) flags.push(walletAgeFlag);

  const burstFlag = checkTransactionBurst(transactions, knownSafeAddresses);
  if (burstFlag) flags.push(burstFlag);

  const { flag: outflowFlag, destinationAddress } = checkLargeOutflow(transactions, address);
  if (outflowFlag) {
    flags.push(outflowFlag);
    outflowDestination = destinationAddress;
  }

  const phishingFlag = checkPhishingTokenNames(transactions);
  if (phishingFlag) flags.push(phishingFlag);

  const dustingFlag = checkDustingPattern(transactions, address);
  if (dustingFlag) flags.push(dustingFlag);

  const blocklistFlag = await checkBlocklist(transactions);
  if (blocklistFlag) flags.push(blocklistFlag);

  const approvalFlags = await checkApprovalRisks(approvals, permits);
  flags.push(...approvalFlags);

  return { flags, outflowDestination };
}

export function checkDustingPattern(transactions: any[], address: string): Flag | null {
  const outgoing = transactions.filter(
    (tx) => tx.from.toLowerCase() === address.toLowerCase()
  );

  if (outgoing.length < 5) return null;

  // group by approximate value (rounded to handle tiny variations) and by asset
  const valueGroups: Record<string, any[]> = {};

  for (const tx of outgoing) {
    // Use BigInt string comparison for exact grouping — Number() silently loses
    // precision on large wei-scale values (e.g. 18-decimal tokens).
    // We still allow a small tolerance bucket (±1 wei) by dividing before stringifying.
    const rawValue = BigInt(tx.value || "0");
    const bucketKey = `${tx.asset || "ETH"}_${rawValue}`;
    if (!valueGroups[bucketKey]) valueGroups[bucketKey] = [];
    valueGroups[bucketKey].push(tx);
  }

  for (const key in valueGroups) {
    const group = valueGroups[key];
    const uniqueRecipients = new Set(group.map((tx) => tx.to.toLowerCase()));

    // same near-identical amount sent to 5+ distinct addresses = dusting pattern
    if (group.length >= 5 && uniqueRecipients.size >= 5) {
      return {
        type: "DUSTING_PATTERN",
        severity: "high",
        message: `Sent the same amount (${group[0].asset || "ETH"}) to ${uniqueRecipients.size} different addresses — a pattern typical of dusting/scam-tagging campaigns`,
        details: group.slice(0, 15).map((t) => ({
          asset: t.asset || "ETH",
          from: t.to, // showing recipient here since this flag is about outgoing spray
          timestamp: new Date(parseInt(t.timeStamp) * 1000).toISOString(),
        })),
      };
    }
  }

  return null;
}

export async function checkBlocklist(transactions: any[]): Promise<Flag | null> {
  const { data: blocklist, error } = await supabase.from("blocklist").select("address, reason");

  if (error || !blocklist || blocklist.length === 0) return null;

  const blockedSet = new Set(blocklist.map((b: any) => b.address.toLowerCase()));

  const matches = transactions.filter(
    (tx) =>
      blockedSet.has(tx.from?.toLowerCase()) || blockedSet.has(tx.to?.toLowerCase())
  );

  if (matches.length > 0) {
    const matchedAddress = blockedSet.has(matches[0].from?.toLowerCase())
      ? matches[0].from
      : matches[0].to;

    const reason = blocklist.find(
      (b: any) => b.address.toLowerCase() === matchedAddress.toLowerCase()
    )?.reason;

    return {
      type: "BLOCKLIST_MATCH",
      severity: "high",
      message: `Interacted with a known malicious address (${matchedAddress.slice(0, 6)}...${matchedAddress.slice(-4)}) — ${reason || "flagged by Sentinel"}`,
      details: matches.slice(0, 10).map((t) => ({
        asset: t.asset || "ETH",
        from: t.from,
        timestamp: new Date(parseInt(t.timeStamp) * 1000).toISOString(),
      })),
    };
  }

  return null;
}