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
      tradeRef: body.tradeRef,
      type: body.type || "TRADE_TERMS",
      content: body.content,
      metadata: body.metadata || {},
    });

    return NextResponse.json({ success: true, memory }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
