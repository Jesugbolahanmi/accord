import { NextResponse } from "next/server";
import { tatum, SUPPORTED_NETWORKS } from "@/lib/tatum/client";
import { TatumAIBuilder } from "@/lib/tatum/ai-builder";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get("network") || "base-mainnet";

    const [diagnostic, manifest, supportedChains] = await Promise.all([
      tatum.diagnose(network),
      TatumAIBuilder.getManifest(),
      TatumAIBuilder.getSupportedChains(),
    ]);

    return NextResponse.json({
      success: true,
      diagnostic,
      allNetworks: Object.values(SUPPORTED_NETWORKS),
      aiBuilder: {
        connected: !!manifest,
        manifestSummary: manifest
          ? {
              version: manifest.version,
              chainsCount: manifest.counts?.chains,
              networksCount: manifest.counts?.networks,
              workflowsCount: manifest.counts?.workflows,
            }
          : null,
        supportedChainsTotal: supportedChains.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const txHash = body.txHash || "";
    const network = body.network || "base-mainnet";

    const verification = await tatum.verifyTransaction(txHash, network, {
      from: body.expectedFrom,
      to: body.expectedTo,
    });

    return NextResponse.json({
      success: true,
      verification,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
