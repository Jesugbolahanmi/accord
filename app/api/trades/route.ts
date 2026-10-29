import { NextResponse } from "next/server";
import { tradeService } from "@/lib/trades/store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("address") || undefined;

    // Seed initial showcase if empty
    await tradeService.seedInitialShowcaseTrades();

    const trades = tradeService.listTrades(userAddress);
    return NextResponse.json({ success: true, count: trades.length, trades });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.creator || !body.buyer || !body.seller || !body.amount || !body.asset || !body.agreedTerms) {
      return NextResponse.json(
        { success: false, error: "Missing required trade fields: creator, buyer, seller, amount, asset, agreedTerms" },
        { status: 400 }
      );
    }

    const trade = await tradeService.createTrade({
      creator: body.creator,
      creatorRole: body.creatorRole || "buyer",
      buyer: body.buyer,
      seller: body.seller,
      arbiter: body.arbiter,
      asset: body.asset,
      amount: body.amount,
      network: body.network || "base-mainnet",
      agreedTerms: body.agreedTerms,
      conditions: body.conditions || [],
      expirationHours: body.expirationHours || 72,
    });

    return NextResponse.json({ success: true, trade }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
