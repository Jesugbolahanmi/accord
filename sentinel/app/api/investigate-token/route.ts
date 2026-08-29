import { NextRequest, NextResponse } from "next/server";
import { classifyAddress, getTokenMetadata, getWalletTransactions, getTokenMarketData, getGoPlusSecurity } from "@/lib/basescan";
import { traceFundingSource, detectWashTrading } from "@/lib/graph";
import { runTokenChecks, runGoPlusChecks } from "@/lib/token-rules";
import { generateThreatReport } from "@/lib/report";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "A token contract address is required" }, { status: 400 });
    }

    const classification = await classifyAddress(address);

    if (!classification.valid) {
      return NextResponse.json({ error: classification.reason }, { status: 400 });
    }

    if (!classification.isContract) {
      return NextResponse.json(
        { error: "This address is a wallet, not a token contract. Try the Wallet tab instead." },
        { status: 400 }
      );
    }

    const [metadata, marketData, transactions, security] = await Promise.all([
      getTokenMetadata(address),
      getTokenMarketData(address),
      getWalletTransactions(address),
      getGoPlusSecurity(address),
    ]);

    const oldestTx = transactions[transactions.length - 1];
    const firstTxTimestamp = oldestTx ? parseInt(oldestTx.timeStamp) * 1000 : null;

    // Execute Graph Intelligence
    let fundingSource = null;
    let washData = null;
    if (security?.creatorAddress) {
      fundingSource = await traceFundingSource(security.creatorAddress);
    }
    if (transactions.length > 0) {
      washData = detectWashTrading(transactions);
    }

    const baseFlags = runTokenChecks(metadata, firstTxTimestamp, fundingSource, washData);
    const goPlusFlags = runGoPlusChecks(security);
    const flags = [...goPlusFlags, ...baseFlags];

    const report = await generateThreatReport(address, flags, "token");

    return NextResponse.json({
      address,
      metadata,
      marketData,
      security,
      graphData: { fundingSource, washData },
      flags,
      report,
    });
  } catch (error) {
    console.error("Token investigation error:", error);
    return NextResponse.json({ error: "Token investigation failed. Please try again." }, { status: 500 });
  }
}