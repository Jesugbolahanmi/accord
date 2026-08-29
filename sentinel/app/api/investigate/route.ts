import { NextRequest, NextResponse } from "next/server";
import { getWalletTransactions, classifyAddress } from "@/lib/basescan";
import { runAllChecks } from "@/lib/rules";
import { generateThreatReport } from "@/lib/report";
import { traceFunds } from "@/lib/trace";
import { getActiveApprovals, detectPermitTransactions } from "@/lib/approvals";
import { getWalletFirstTransaction, resolveCounterparty, KNOWN_ENTITIES } from "@/lib/graph";

// Build a Set of known-safe addresses for smarter burst detection
const KNOWN_SAFE_ADDRESSES = new Set(
  Object.entries(KNOWN_ENTITIES)
    .filter(([, entity]) => entity.safe)
    .map(([addr]) => addr.toLowerCase())
);

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "A wallet address is required" },
        { status: 400 }
      );
    }

    const classification = await classifyAddress(address);

    if (!classification.valid) {
      return NextResponse.json(
        { error: classification.reason },
        { status: 400 }
      );
    }

    if (!classification.hasActivity) {
      return NextResponse.json(
        { error: classification.reason },
        { status: 400 }
      );
    }

    // Run all data fetches in parallel — including the true first-tx for accurate wallet age
    const [transactions, approvalsData, firstTx] = await Promise.all([
      getWalletTransactions(address),
      getActiveApprovals(address),
      getWalletFirstTransaction(address),
    ]);

    // Accurate wallet age from the very first ever transaction
    const firstTxTimestamp = firstTx
      ? new Date(firstTx.metadata.blockTimestamp).getTime()
      : null;

    // Permit detection requires real calldata — runs after transactions are fetched
    const permits = await detectPermitTransactions(address, transactions);

    const { flags, outflowDestination } = await runAllChecks(
      transactions,
      address,
      approvalsData.activeApprovals,
      permits,
      firstTxTimestamp,
      KNOWN_SAFE_ADDRESSES
    );

    // Counterparty context: resolve where the largest outflow went
    let outflowContext = null;
    if (outflowDestination) {
      const context = await resolveCounterparty(outflowDestination);
      outflowContext = { address: outflowDestination, ...context };

      // If the destination is a known safe entity, downgrade the LARGE_OUTFLOW flag
      if (context.safe) {
        const outflowFlag = flags.find((f) => f.type === "LARGE_OUTFLOW");
        if (outflowFlag) {
          outflowFlag.severity = "low";
          outflowFlag.message = `Outflow of ETH went to ${context.name} — a known safe address (${context.type}). This is routine activity.`;
        }
      } else if (context.isFresh) {
        // Escalate if the destination is a brand-new wallet
        const outflowFlag = flags.find((f) => f.type === "LARGE_OUTFLOW");
        if (outflowFlag) {
          outflowFlag.severity = "critical";
          outflowFlag.message = `${outflowFlag.message} — sent to a fresh wallet only ${context.firstSeenDaysAgo} day(s) old. This pattern is consistent with laundering or insider fund extraction.`;
        }
      }
    }

    const report = await generateThreatReport(address, flags);

    // Build fund trace only if outflow flag still present and not cleared as safe
    const hasRiskyOutflow = flags.some(
      (f) => f.type === "LARGE_OUTFLOW" && f.severity !== "low"
    );
    const trail = hasRiskyOutflow ? await traceFunds(address, 3) : [];

    return NextResponse.json({
      address,
      isContract: classification.isContract,
      flags,
      report,
      trail,
      outflowContext,
      activeApprovals: approvalsData.activeApprovals,
      permits,
      approvalScanMeta: {
        totalScannedBlocks: approvalsData.totalScannedBlocks,
        startBlock: approvalsData.startBlock,
        endBlock: approvalsData.endBlock,
      },
      walletMeta: {
        firstTxTimestamp,
        firstTxHash: firstTx?.hash || null,
      },
    });
  } catch (error) {
    console.error("Investigation error:", error);
    return NextResponse.json(
      { error: "Investigation failed. Please try again." },
      { status: 500 }
    );
  }
}