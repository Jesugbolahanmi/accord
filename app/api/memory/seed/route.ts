import { NextResponse } from "next/server";
import { walrusMemory } from "@/lib/walrus/memory";

export async function GET() {
  try {
    const health = await walrusMemory.checkRelayerHealth();
    const seeded = await walrusMemory.seedDemonstrationMemories(false);
    const mainnetVerifiedCount = seeded.filter((m) => m.verifiedOnWalrus).length;

    return NextResponse.json({
      success: true,
      relayerHealth: health,
      configStatus: health.configStatus,
      count: seeded.length,
      mainnetVerifiedCount,
      memories: seeded,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let forceSync = false;
    try {
      const body = await request.json();
      forceSync = Boolean(body?.forceSync);
    } catch {
      // empty body
    }

    const health = await walrusMemory.checkRelayerHealth();
    const seeded = await walrusMemory.seedDemonstrationMemories(forceSync);
    const mainnetVerifiedCount = seeded.filter((m) => m.verifiedOnWalrus).length;

    const statusMessage =
      mainnetVerifiedCount > 0
        ? `Verified ${mainnetVerifiedCount}/${seeded.length} trade memories directly on Walrus Memory Mainnet (${health.url}).`
        : `Indexed ${seeded.length} structured trade memories locally via MemWalMock. Set MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID in .env.local to anchor them on Walrus Memory Mainnet (${health.url}).`;

    return NextResponse.json({
      success: true,
      message: statusMessage,
      relayerHealth: health,
      configStatus: health.configStatus,
      count: seeded.length,
      mainnetVerifiedCount,
      memories: seeded,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
