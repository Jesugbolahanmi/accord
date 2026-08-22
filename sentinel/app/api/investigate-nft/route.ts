import { NextRequest, NextResponse } from "next/server";
import { classifyAddress, getNFTMetadata } from "@/lib/basescan";
import { runNFTChecks } from "@/lib/nft-rules";
import { generateThreatReport } from "@/lib/report";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "An NFT contract address is required" }, { status: 400 });
    }

    const classification = await classifyAddress(address);

    if (!classification.valid) {
      return NextResponse.json({ error: classification.reason }, { status: 400 });
    }

    if (!classification.isContract) {
      return NextResponse.json(
        { error: "This address is a wallet, not an NFT contract. Try the Wallet tab instead." },
        { status: 400 }
      );
    }

    const metadata = await getNFTMetadata(address);
    const flags = runNFTChecks(metadata);
    const report = await generateThreatReport(address, flags);

    return NextResponse.json({
      address,
      metadata,
      flags,
      report,
    });
  } catch (error) {
    console.error("NFT investigation error:", error);
    return NextResponse.json({ error: "NFT investigation failed. Please try again." }, { status: 500 });
  }
}

