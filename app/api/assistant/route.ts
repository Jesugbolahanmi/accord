import { NextResponse } from "next/server";
import { accordAI } from "@/lib/assistant/accord-ai";
import { tradeService } from "@/lib/trades/store";
import type { Trade } from "@/lib/trades/store";

type AssistantTradeContext = Pick<
  Trade,
  | "id"
  | "reference"
  | "buyer"
  | "seller"
  | "arbiter"
  | "buyerAccepted"
  | "sellerAccepted"
  | "asset"
  | "amount"
  | "network"
  | "agreedTerms"
  | "termsHash"
  | "expirationTimestamp"
  | "settlementMode"
> & {
  termsVersions: unknown[];
  conditions: unknown[];
  disputeEvidence: unknown[];
  activity: unknown[];
  status: string;
  escrowAddress: Trade["escrowAddress"] | null;
  verification: Trade["verification"] | null;
  txHash?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question, currentUser, txHash, clientTradeSnapshot } = body;
    const tradeKey: string | undefined = body.tradeId || body.tradeRef;

    if (!question || !String(question).trim()) {
      return NextResponse.json({ success: false, error: "Missing question" }, { status: 400 });
    }

    // The server-side trade record is the primary source of truth.
    // Never trust client-supplied `verification` objects; any txHash is verified server-side via Tatum RPC.

    let currentTrade: Trade | AssistantTradeContext | null = null;
    if (tradeKey) {
      currentTrade = await tradeService.getTrade(tradeKey);
    }

    // If running across stateless serverless instances where a user-created trade is not in memory,
    // use only non-verified agreement metadata and force `verification: null` so Tatum RPC verifies `txHash` live.
    if (!currentTrade && clientTradeSnapshot && typeof clientTradeSnapshot === "object") {
      currentTrade = {
        id: String(clientTradeSnapshot.id || tradeKey || "custom-trade"),
        reference: String(clientTradeSnapshot.reference || tradeKey || "ACC-CUSTOM"),
        buyer: String(clientTradeSnapshot.buyer || ""),
        seller: String(clientTradeSnapshot.seller || ""),
        arbiter: String(clientTradeSnapshot.arbiter || ""),
        buyerAccepted: Boolean(clientTradeSnapshot.buyerAccepted),
        sellerAccepted: Boolean(clientTradeSnapshot.sellerAccepted),
        asset: String(clientTradeSnapshot.asset || "ETH"),
        amount: String(clientTradeSnapshot.amount || "0"),
        network: String(clientTradeSnapshot.network || "base-sepolia"),
        agreedTerms: String(clientTradeSnapshot.agreedTerms || ""),
        termsHash: String(clientTradeSnapshot.termsHash || ""),
        termsVersions: Array.isArray(clientTradeSnapshot.termsVersions)
          ? clientTradeSnapshot.termsVersions
          : [],
        conditions: Array.isArray(clientTradeSnapshot.conditions)
          ? clientTradeSnapshot.conditions
          : [],
        expirationTimestamp: Number(clientTradeSnapshot.expirationTimestamp || Date.now() + 86400000),
        settlementMode: clientTradeSnapshot.settlementMode === "escrow" ? "escrow" : "direct",
        escrowAddress: clientTradeSnapshot.escrowAddress || null,
        disputeEvidence: Array.isArray(clientTradeSnapshot.disputeEvidence)
          ? clientTradeSnapshot.disputeEvidence
          : [],
        activity: Array.isArray(clientTradeSnapshot.activity) ? clientTradeSnapshot.activity : [],
        status:
          clientTradeSnapshot.status === "Funded" || clientTradeSnapshot.status === "Completed"
            ? "AwaitingDeposit"
            : String(clientTradeSnapshot.status || "AwaitingDeposit"),
        verification: null,
      };
    }

    const effectiveTxHash =
      txHash || currentTrade?.txHash || clientTradeSnapshot?.txHash || undefined;

    const response = await accordAI.ask({
      question: String(question).trim(),
      tradeRef: currentTrade?.reference || tradeKey,
      currentUser,
      counterparty:
        currentUser && currentTrade
          ? currentUser.toLowerCase() === currentTrade.buyer.toLowerCase()
            ? currentTrade.seller
            : currentTrade.buyer
          : undefined,
      network: currentTrade?.network,
      txHash: effectiveTxHash,
      currentTrade,
    });

    return NextResponse.json({ success: true, ...response });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          (err instanceof Error ? err.message : undefined) ||
          "Assistant failed to process request",
      },
      { status: 500 }
    );
  }
}
