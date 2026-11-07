import { NextResponse } from "next/server";
import { isAddress, keccak256, toHex } from "viem";
import { tradeService } from "@/lib/trades/store";
import {
  getEscrowAddress,
  isEscrowNetworkEnabled,
} from "@/lib/contracts/escrow-config.server";
import { isEvmEscrowNetwork, isMainnetEscrowNetwork } from "@/lib/contracts/escrow-networks";
import {
  getAuthorizedPayload,
  getTradeActionChainId,
  isTradeActionAuthorization,
  verifyTradeActionSignature,
} from "@/lib/trades/action-auth";

function getRequestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("Wallet authorization is required.");
  const parsedOrigin = new URL(origin);
  const expectedOrigin = new URL(process.env.ACCORD_APP_ORIGIN || request.url).origin;
  if (parsedOrigin.origin !== expectedOrigin) {
    throw new Error("Wallet authorization origin does not match this app.");
  }
  return parsedOrigin.origin;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("address") || undefined;

    const trades = await tradeService.listTrades(userAddress);
    return NextResponse.json({ success: true, count: trades.length, trades });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const origin = getRequestOrigin(request);
    const chainId = getTradeActionChainId(body.network);
    if (!chainId || !isEvmEscrowNetwork(body.network)) {
      return NextResponse.json(
        { success: false, error: "This network is not supported for EVM escrow trades." },
        { status: 400 }
      );
    }
    if (
      isMainnetEscrowNetwork(body.network) &&
      (!isEscrowNetworkEnabled(body.network) || !getEscrowAddress(body.network))
    ) {
      return NextResponse.json(
        { success: false, error: "Mainnet escrow is disabled or not configured on this server." },
        { status: 503 }
      );
    }

    if (
      !isAddress(body.creator) ||
      !isAddress(body.buyer) ||
      !isAddress(body.seller) ||
      typeof body.authorizationNonce !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Valid participant wallets and an authorization nonce are required." },
        { status: 400 }
      );
    }
    if (!isTradeActionAuthorization(body.authorization)) {
      return NextResponse.json(
        { success: false, error: "A valid wallet signature is required to create a trade." },
        { status: 401 }
      );
    }

    const isAuthorized = await verifyTradeActionSignature({
      address: body.creator,
      signature: body.authorization.signature,
      authorization: body.authorization,
      origin,
      tradeReference: `create:${body.authorizationNonce}`,
      payload: getAuthorizedPayload(body),
      chainId,
      expectedUpdatedAt: BigInt(0),
    });
    if (!isAuthorized || body.action !== "create_trade") {
      return NextResponse.json(
        { success: false, error: "The trade creation signature is invalid or expired." },
        { status: 401 }
      );
    }

    if (!body.creator || !body.buyer || !body.seller || !body.amount || !body.asset || !body.agreedTerms) {
      return NextResponse.json(
        { success: false, error: "Missing required trade fields: creator, buyer, seller, amount, asset, agreedTerms" },
        { status: 400 }
      );
    }

    const roleWallet =
      body.creatorRole === "buyer"
        ? body.buyer
        : body.creatorRole === "seller"
          ? body.seller
          : undefined;
    if (!roleWallet || body.creator.toLowerCase() !== roleWallet.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "The creator wallet must match the selected buyer or seller role." },
        { status: 400 }
      );
    }

    if (
      typeof body.authorizationNonce !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.authorizationNonce)
    ) {
      return NextResponse.json(
        { success: false, error: "The trade authorization nonce is malformed." },
        { status: 400 }
      );
    }

    const tradeId = `signed-${keccak256(toHex(body.authorizationNonce)).slice(2, 34)}`;
    if (await tradeService.getTrade(tradeId)) {
      return NextResponse.json(
        { success: false, error: "This signed trade creation request has already been used." },
        { status: 409 }
      );
    }

    const trade = await tradeService.createTrade({
      id: tradeId,
      creator: body.creator,
      creatorRole: body.creatorRole,
      buyer: body.buyer,
      seller: body.seller,
      arbiter: body.arbiter,
      asset: body.asset,
      amount: body.amount,
      network: body.network,
      agreedTerms: body.agreedTerms,
      conditions: body.conditions || [],
      expirationHours: body.expirationHours || 72,
    });

    return NextResponse.json({ success: true, trade }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : undefined },
      { status: 500 }
    );
  }
}
