import { NextResponse } from "next/server";
import { tradeService } from "@/lib/trades/store";
import { walrusMemory } from "@/lib/walrus/memory";

export async function GET(
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

    const memories = await walrusMemory.getMemoriesForTrade(trade.reference);

    return NextResponse.json({ success: true, trade, memories });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await tradeService.seedInitialShowcaseTrades();
    const body = await request.json();
    const action = body.action;

    let updatedTrade;

    switch (action) {
      case "accept_terms":
        if (!body.actor) throw new Error("Missing actor wallet address");
        updatedTrade = await tradeService.acceptTerms(id, body.actor);
        break;

      case "update_terms":
        if (!body.actor || !body.newTerms) {
          throw new Error("Missing actor wallet address or newTerms");
        }
        updatedTrade = await tradeService.updateTerms(
          id,
          body.actor,
          body.newTerms,
          body.changeSummary
        );
        break;

      case "complete_condition":
        if (!body.conditionId || !body.actor) {
          throw new Error("Missing conditionId or actor");
        }
        updatedTrade = await tradeService.completeCondition(
          id,
          body.conditionId,
          body.actor,
          body.attestationNote
        );
        break;

      case "confirm_fulfillment":
        if (!body.actor) throw new Error("Missing actor wallet address");
        updatedTrade = await tradeService.confirmFulfillment(id, body.actor);
        break;

      case "approve_release":
        if (!body.actor) throw new Error("Missing actor wallet address");
        updatedTrade = await tradeService.approveRelease(id, body.actor, body.txHash);
        break;

      case "raise_dispute":
        if (!body.actor || !body.reason) {
          throw new Error("Missing actor or dispute reason");
        }
        updatedTrade = await tradeService.raiseDispute(
          id,
          body.actor,
          body.reason,
          body.evidenceContent
        );
        break;

      case "resolve_dispute":
        if (!body.actor || body.buyerSplitBps === undefined || !body.resolutionNote) {
          throw new Error("Missing arbiter actor, buyerSplitBps, or resolutionNote");
        }
        updatedTrade = await tradeService.resolveDispute(
          id,
          body.actor,
          Number(body.buyerSplitBps),
          body.resolutionNote
        );
        break;

      case "refund":
        if (!body.actor) throw new Error("Missing actor wallet address");
        updatedTrade = await tradeService.refundTrade(id, body.actor, body.txHash);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const memories = await walrusMemory.getMemoriesForTrade(updatedTrade.reference);

    return NextResponse.json({ success: true, trade: updatedTrade, memories });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
