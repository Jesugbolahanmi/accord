import { NextResponse } from "next/server";
import { walrusMemory } from "@/lib/walrus/memory";
import { tradeService } from "@/lib/trades/store";

export async function GET() {
  try {
    const memories = walrusMemory.listAllMemories();
    const health = await walrusMemory.checkRelayerHealth();
    const overview = walrusMemory.getOverviewStats();
    const trades = await tradeService.listTrades();
    const mainnetVerifiedCount = memories.filter((memory) => memory.verifiedOnWalrus).length;

    return NextResponse.json({
      success: true,
      relayerHealth: health,
      configStatus: health.configStatus,
      overview,
      count: memories.length,
      mainnetVerifiedCount,
      memories,
      trades,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let forceSync = false;
    let retryMemoryId: string | undefined;

    try {
      const body = await request.json();
      forceSync = Boolean(body?.forceSync);
      retryMemoryId = body?.memoryId ? String(body.memoryId) : undefined;
    } catch {
      // empty body
    }

    let retryRecord = null;
    if (retryMemoryId) {
      retryRecord = await walrusMemory.retryPersistMemory(retryMemoryId);
    }

    let memories = walrusMemory.listAllMemories();
    if (retryMemoryId) {
      memories = walrusMemory.listAllMemories();
    } else if (forceSync) {
      memories = (await walrusMemory.retryAllPendingMemories()).memories;
    }
    const health = await walrusMemory.checkRelayerHealth();
    const overview = walrusMemory.getOverviewStats();
    const trades = await tradeService.listTrades();
    const mainnetVerifiedCount = memories.filter((memory) => memory.verifiedOnWalrus).length;

    const statusMessage = retryRecord
      ? retryRecord.verifiedOnWalrus
        ? `Confirmed Mainnet persistence for ${retryRecord.id} (Blob ID: ${retryRecord.blobId}).`
        : `Retried ${retryRecord.id} (Retry #${retryRecord.retryCount}). Status: ${retryRecord.persistenceStatus}${!health.credentialsConfigured ? " — Configure MEMWAL_PRIVATE_KEY & MEMWAL_ACCOUNT_ID in .env.local to enable Mainnet writes." : ""}`
      : memories.length === 0
      ? "No saved records to sync."
      : `Confirmed ${mainnetVerifiedCount} of ${memories.length} saved records on Walrus Memory Mainnet.`;

    return NextResponse.json({
      success: true,
      message: statusMessage,
      retriedMemory: retryRecord,
      relayerHealth: health,
      configStatus: health.configStatus,
      overview,
      count: memories.length,
      mainnetVerifiedCount,
      memories,
      trades,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}
