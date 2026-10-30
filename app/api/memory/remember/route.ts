import { NextResponse } from "next/server";
import { walrusMemory } from "@/lib/walrus/memory";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.content || !body.tradeRef) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: content, tradeRef" },
        { status: 400 }
      );
    }

    const memory = await walrusMemory.remember({
      title: body.title,
      category: body.category,
      tradeId: body.tradeId,
      tradeRef: body.tradeRef,
      type: body.type || "TRADE_TERMS",
      actor: body.actor,
      sourceRole: body.sourceRole,
      content: body.content,
      structuredPayload: body.structuredPayload,
      metadata: body.metadata || {},
    });

    const overview = walrusMemory.getOverviewStats();

    return NextResponse.json({ success: true, memory, overview }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
