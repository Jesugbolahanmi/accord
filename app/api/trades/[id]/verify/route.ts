import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { tradeService } from "@/lib/trades/store";
import { tatum } from "@/lib/tatum/client";
import { walrusMemory } from "@/lib/walrus/memory";
import {
  getEscrowAddress,
  isEscrowNetworkEnabled,
} from "@/lib/contracts/escrow-config.server";
import { isEvmEscrowNetwork } from "@/lib/contracts/escrow-networks";
import {
  createEscrowPublicClient,
  getEscrowContractVersion,
  verifyEscrowActionEvent,
} from "@/lib/contracts/verify-escrow-event";
import {
  getAuthorizedPayload,
  getTradeActionChainId,
  isTradeActionAuthorization,
  verifyTradeActionSignature,
} from "@/lib/trades/action-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trade = await tradeService.getTrade(id);

    if (!trade) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }

    const body = await request.json();
    if (
      !isEvmEscrowNetwork(trade.network) ||
      trade.asset !== "ETH" ||
      body.network !== trade.network ||
      typeof body.txHash !== "string" ||
      !isAddress(body.actor) ||
      body.actor.toLowerCase() !== trade.buyer.toLowerCase() ||
      !isTradeActionAuthorization(body.authorization)
    ) {
      return NextResponse.json(
        { success: false, error: "A buyer signature is required for this network's native ETH escrow deposit." },
        { status: 401 }
      );
    }
    if (!isEscrowNetworkEnabled(trade.network)) {
      return NextResponse.json(
        { success: false, error: "Mainnet escrow verification is disabled or not configured on this server." },
        { status: 503 }
      );
    }

    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(process.env.ACCORD_APP_ORIGIN || request.url).origin;
    if (!origin || new URL(origin).origin !== expectedOrigin) {
      return NextResponse.json(
        { success: false, error: "Wallet authorization origin does not match this app." },
        { status: 401 }
      );
    }

    const chainId = getTradeActionChainId(trade.network);
    if (!chainId) {
      return NextResponse.json(
        { success: false, error: "Unsupported network for deposit verification." },
        { status: 400 }
      );
    }

    const expectedUpdatedAt = BigInt(Date.parse(trade.updatedAt));
    const isAuthorized = await verifyTradeActionSignature({
      address: body.actor,
      signature: body.authorization.signature,
      authorization: body.authorization,
      origin: new URL(origin).origin,
      tradeReference: trade.reference,
      payload: getAuthorizedPayload(body),
      chainId,
      expectedUpdatedAt,
    });
    if (!isAuthorized || body.action !== "verify_deposit") {
      return NextResponse.json(
        { success: false, error: "The buyer signature is invalid, expired, or for an outdated trade." },
        { status: 401 }
      );
    }

    const txHash = body.txHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ success: false, error: "Missing txHash" }, { status: 400 });
    }

    const escrowAddress = getEscrowAddress(trade.network);
    if (!escrowAddress) {
      return NextResponse.json(
        { success: false, error: `${trade.network} escrow is disabled or not configured on the server.` },
        { status: 503 }
      );
    }

    const escrowClient = createEscrowPublicClient(trade.network);
    const contractVersion = await getEscrowContractVersion(escrowClient, escrowAddress);
    if (contractVersion !== BigInt(2)) {
      return NextResponse.json(
        { success: false, error: "The configured escrow contract is outdated. Deploy and configure version 2 before verifying deposits." },
        { status: 503 }
      );
    }

    const verification = await tatum.verifyTransaction(txHash, trade.network, {
      from: trade.buyer,
      allowedRecipients: [escrowAddress],
      expectedValueEth: trade.amount,
      asset: "ETH",
      minConfirmations: 2,
    });

    if (!verification.verified || verification.status !== "confirmed") {
      const memories = await walrusMemory.getMemoriesForTrade(trade.reference);
      return NextResponse.json({
        success: false,
        verified: false,
        status: verification.status,
        message: verification.errorMessage || "Transaction not confirmed on blockchain",
        verification,
        trade: await tradeService.getTrade(id),
        memories,
      });
    }

    await verifyEscrowActionEvent({
      client: escrowClient,
      contractAddress: escrowAddress,
      trade,
      txHash: txHash as `0x${string}`,
      actor: body.actor,
      expectedEvent: "TradeDeposited",
    });

    const updatedTrade = await tradeService.recordVerifiedDeposit(id, verification);
    const memories = await walrusMemory.getMemoriesForTrade(updatedTrade.reference);

    return NextResponse.json({
      success: true,
      verified: true,
      status: "confirmed",
      trade: updatedTrade,
      verification,
      memories,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}
