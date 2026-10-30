import { NextResponse } from "next/server";
import { tradeService } from "@/lib/trades/store";
import { tatum } from "@/lib/tatum/client";
import { walrusMemory } from "@/lib/walrus/memory";

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
    const txHash = (body.txHash || "").trim();
    const network = body.network || trade.network;
    const actor = body.actor || trade.buyer;

    if (!txHash) {
      return NextResponse.json({ success: false, error: "Missing txHash" }, { status: 400 });
    }

    // 1. Preserve payment reference submission in trade history & Memory Box
    await tradeService.submitPaymentReference(id, actor, txHash);

    // 2. Verify via Tatum Gateway RPC, allowing deposit either to a configured escrow contract or directly to the seller
    const allowedRecipients = [trade.escrowAddress, trade.seller].filter(
      (addr): addr is string => Boolean(addr)
    );
    const verification = await tatum.verifyTransaction(txHash, network, {
      from: trade.buyer,
      allowedRecipients,
      expectedValueEth: trade.amount,
      asset: trade.asset,
      minConfirmations: body.minConfirmations ? Number(body.minConfirmations) : 1,
    });

    if (!verification.verified || verification.status !== "confirmed") {
      const memories = await walrusMemory.getMemoriesForTrade(trade.reference);
      return NextResponse.json({
        success: false,
        verified: false,
        status: verification.status,
        message: verification.errorMessage || "Transaction not confirmed on blockchain",
        verification,
        trade: tradeService.getTrade(id),
        memories,
      });
    }

    // 3. Record verified deposit in trade store and Memory Box
    const updatedTrade = await tradeService.recordVerifiedDeposit(id, verification);
    const memories = await walrusMemory.getMemoriesForTrade(updatedTrade.reference);

    return NextResponse.json({
      success: true,
      verified: true,
      status: "confirmed",
      trade: updatedTrade,
      verification,
      memories,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
