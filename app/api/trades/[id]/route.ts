import { NextResponse } from "next/server";
import { tradeService } from "@/lib/trades/store";
import { walrusMemory } from "@/lib/walrus/memory";
import {
  getEscrowAddress,
  isEscrowNetworkEnabled,
} from "@/lib/contracts/escrow-config.server";
import { isEvmEscrowNetwork } from "@/lib/contracts/escrow-networks";
import { isAddress, type Hash } from "viem";
import {
  createEscrowPublicClient,
  getEscrowContractVersion,
  verifyEscrowActionEvent,
  type EscrowActionEvent,
} from "@/lib/contracts/verify-escrow-event";
import {
  getAuthorizedPayload,
  getTradeActionChainId,
  isTradeActionAuthorization,
  verifyTradeActionSignature,
} from "@/lib/trades/action-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const storedTrade = await tradeService.getTrade(id);

    if (!storedTrade) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }

    const configuredEscrow = getEscrowAddress(storedTrade.network);
    const trade = configuredEscrow
      ? { ...storedTrade, escrowAddress: configuredEscrow, settlementMode: "escrow" as const }
      : storedTrade;
    const memories = await walrusMemory.getMemoriesForTrade(trade.reference);

    return NextResponse.json({ success: true, trade, memories });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;
    const trade = await tradeService.getTrade(id);
    if (!trade) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }

    const origin = request.headers.get("origin");
    if (!origin) {
      return NextResponse.json(
        { success: false, error: "Wallet authorization is required." },
        { status: 401 }
      );
    }
    const requestOrigin = new URL(origin).origin;
    const expectedOrigin = new URL(process.env.ACCORD_APP_ORIGIN || request.url).origin;
    const chainId = getTradeActionChainId(trade.network);
    if (
      requestOrigin !== expectedOrigin ||
      !chainId ||
      !isEvmEscrowNetwork(trade.network)
    ) {
      return NextResponse.json(
        { success: false, error: "This trade cannot accept wallet-authorized actions on this network or origin." },
        { status: 400 }
      );
    }
    if (!isEscrowNetworkEnabled(trade.network)) {
      return NextResponse.json(
        { success: false, error: "Mainnet escrow actions are disabled or not configured on this server." },
        { status: 503 }
      );
    }

    if (!isAddress(body.actor) || !isTradeActionAuthorization(body.authorization)) {
      return NextResponse.json(
        { success: false, error: "A valid participant wallet signature is required." },
        { status: 401 }
      );
    }

    const expectedUpdatedAt = BigInt(Date.parse(trade.updatedAt));
    const isAuthorized = await verifyTradeActionSignature({
      address: body.actor,
      signature: body.authorization.signature,
      authorization: body.authorization,
      origin: requestOrigin,
      tradeReference: trade.reference,
      payload: getAuthorizedPayload(body),
      chainId,
      expectedUpdatedAt,
    });
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "The wallet signature is invalid, expired, or for an outdated trade version." },
        { status: 401 }
      );
    }

    const escrowEvents: Record<string, EscrowActionEvent> = {
      confirm_fulfillment: "FulfillmentConfirmed",
      approve_release: "TradeReleased",
      refund: "TradeRefunded",
    };
    const expectedEvent = escrowEvents[action];
    if (expectedEvent) {
      const escrowAddress = getEscrowAddress(trade.network);
      if (
        !escrowAddress ||
        typeof body.txHash !== "string" ||
        !/^0x[0-9a-fA-F]{64}$/.test(body.txHash)
      ) {
        return NextResponse.json(
          { success: false, error: `A valid ${trade.network} escrow transaction is required.` },
          { status: 400 }
        );
      }

      const escrowClient = createEscrowPublicClient(trade.network);
      const contractVersion = await getEscrowContractVersion(escrowClient, escrowAddress);
      if (contractVersion !== BigInt(2)) {
        return NextResponse.json(
          { success: false, error: "The configured escrow contract is outdated. Deploy and configure version 2 before recording escrow actions." },
          { status: 503 }
        );
      }

      await verifyEscrowActionEvent({
        client: escrowClient,
        contractAddress: escrowAddress,
        trade,
        txHash: body.txHash as Hash,
        actor: body.actor,
        expectedEvent,
      });
    }

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
        if (!body.actor || !body.txHash) throw new Error("Missing actor wallet address or escrow transaction hash");
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
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : undefined },
      { status: 400 }
    );
  }
}
