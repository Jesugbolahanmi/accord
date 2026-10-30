import { NextResponse } from "next/server";
import { walrusMemory } from "@/lib/walrus/memory";
import { tradeService } from "@/lib/trades/store";

export async function GET() {
  try {
    await tradeService.seedInitialShowcaseTrades();
    const seeded = await walrusMemory.seedDemonstrationMemories(false);
    const health = await walrusMemory.checkRelayerHealth();
    const overview = walrusMemory.getOverviewStats();
    const trades = tradeService.listTrades();
    const mainnetVerifiedCount = seeded.filter((m) => m.verifiedOnWalrus).length;

    return NextResponse.json({
      success: true,
      relayerHealth: health,
      configStatus: health.configStatus,
      overview,
      count: seeded.length,
      mainnetVerifiedCount,
      memories: seeded,
      trades,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await tradeService.seedInitialShowcaseTrades();
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

    const seeded = await walrusMemory.seedDemonstrationMemories(forceSync);
    const health = await walrusMemory.checkRelayerHealth();
    const overview = walrusMemory.getOverviewStats();
    const trades = tradeService.listTrades();
    const mainnetVerifiedCount = seeded.filter((m) => m.verifiedOnWalrus).length;

    const statusMessage = retryRecord
      ? retryRecord.verifiedOnWalrus
        ? `Confirmed Mainnet persistence for ${retryRecord.id} (Blob ID: ${retryRecord.blobId}).`
        : `Retried ${retryRecord.id} (Retry #${retryRecord.retryCount}). Status: ${retryRecord.persistenceStatus}${!health.credentialsConfigured ? " — Configure MEMWAL_PRIVATE_KEY & MEMWAL_ACCOUNT_ID in .env.local to enable Mainnet writes." : ""}`
      : mainnetVerifiedCount > 0
      ? `Confirmed ${mainnetVerifiedCount}/${seeded.length} trade memories on Walrus Memory Mainnet (${health.url}).`
      : `Preserved ${seeded.length} structured trade memories in Accord Memory Box (Pending Mainnet Persistence). Set MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID in .env.local to anchor blobs to ${health.url}.`;

    return NextResponse.json({
      success: true,
      message: statusMessage,
      retriedMemory: retryRecord,
      relayerHealth: health,
      configStatus: health.configStatus,
      overview,
      count: seeded.length,
      mainnetVerifiedCount,
      memories: seeded,
      trades,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
