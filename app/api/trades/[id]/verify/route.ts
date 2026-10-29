import { NextResponse } from "next/server";
import { tradeService } from "@/lib/trades/store";
import { tatum } from "@/lib/tatum/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await tradeService.seedInitialShowcaseTrades();
    const trade = tradeService.getTrade(id);

    if (!trade) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }

    const body = await request.json();
    const txHash = body.txHash;
    const network = body.network || trade.network;

    if (!txHash) {
      return NextResponse.json({ success: false, error: "Missing txHash" }, { status: 400 });
    }

    // Verify via Tatum Gateway RPC, allowing deposit either to a configured escrow contract or directly to the seller
    const allowedRecipients = [trade.escrowAddress, trade.seller].filter(
      (addr): addr is string => Boolean(addr)
    );
    const verification = await tatum.verifyTransaction(txHash, network, {
      from: trade.buyer,
      allowedRecipients,
      expectedValueEth: trade.amount,
    });

    if (!verification.verified || verification.status !== "confirmed") {
      return NextResponse.json({
        success: false,
        verified: false,
        status: verification.status,
        message: verification.errorMessage || "Transaction not confirmed on blockchain",
        verification,
      });
    }

    // Record verified deposit in trade store and Walrus Memory
    const updatedTrade = await tradeService.recordVerifiedDeposit(id, verification);

    return NextResponse.json({
      success: true,
      verified: true,
      status: "confirmed",
      trade: updatedTrade,
      verification,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
