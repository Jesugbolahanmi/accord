import { NextResponse } from "next/server";
import { walrusMemory, MemoryCategory, MemoryRecordType } from "@/lib/walrus/memory";
import { tradeService } from "@/lib/trades/store";

export async function GET(request: Request) {
  try {
    await tradeService.seedInitialShowcaseTrades();
    await walrusMemory.seedDemonstrationMemories();

    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get("id");

    if (memoryId) {
      const detail = walrusMemory.getMemoryById(memoryId);
      const trade = detail.memory
        ? tradeService.getTrade(detail.memory.tradeRef)
        : null;
      return NextResponse.json({
        success: true,
        memory: detail.memory,
        relatedMemories: detail.relatedMemories,
        trade,
      });
    }

    const query = searchParams.get("q") || "*";
    const tradeRef = searchParams.get("tradeRef") || undefined;
    const participant = searchParams.get("participant") || undefined;
    const category = (searchParams.get("category") as MemoryCategory) || undefined;
    const type = (searchParams.get("type") as MemoryRecordType) || undefined;
    const persistenceStatus =
      (searchParams.get("persistenceStatus") as
        | "all"
        | "confirmed_mainnet"
        | "pending"
        | "failed") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    const result = await walrusMemory.searchMemories({
      query,
      tradeRef,
      participant,
      category,
      type,
      persistenceStatus,
      dateFrom,
      dateTo,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await tradeService.seedInitialShowcaseTrades();
    await walrusMemory.seedDemonstrationMemories();
    const body = await request.json();

    const result = await walrusMemory.searchMemories({
      query: body.query || "*",
      tradeRef: body.tradeRef,
      participant: body.participant,
      category: body.category,
      type: body.type,
      persistenceStatus: body.persistenceStatus,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      limit: body.limit || 50,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
