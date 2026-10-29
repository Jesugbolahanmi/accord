import { NextResponse } from "next/server";
import { accordAI } from "@/lib/assistant/accord-ai";
import { tradeService } from "@/lib/trades/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question, currentUser } = body;
    const tradeKey: string | undefined = body.tradeId || body.tradeRef;

    if (!question) {
      return NextResponse.json({ success: false, error: "Missing question" }, { status: 400 });
    }

    // The server-side trade record is the only source of truth; client-supplied trade objects are ignored.
    await tradeService.seedInitialShowcaseTrades();
    let currentTrade = null;
    if (tradeKey) {
      currentTrade = tradeService.getTrade(tradeKey);
    }

    const response = await accordAI.ask({
      question,
      tradeRef: currentTrade?.reference,
      currentUser,
      counterparty:
        currentUser && currentTrade
          ? currentUser.toLowerCase() === currentTrade.buyer.toLowerCase()
            ? currentTrade.seller
            : currentTrade.buyer
          : undefined,
      network: currentTrade?.network,
      txHash: currentTrade?.txHash,
      currentTrade,
    });

    return NextResponse.json({ success: true, ...response });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
