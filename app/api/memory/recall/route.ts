import { NextResponse } from "next/server";
import { walrusMemory } from "@/lib/walrus/memory";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "*";
    const tradeRef = searchParams.get("tradeRef") || undefined;
    const participant = searchParams.get("participant") || undefined;
    const type = (searchParams.get("type") as any) || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 10;

    const result = await walrusMemory.recall({
      query,
      tradeRef,
      participant,
      type,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await walrusMemory.recall({
      query: body.query || "*",
      tradeRef: body.tradeRef,
      participant: body.participant,
      type: body.type,
      limit: body.limit || 10,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
