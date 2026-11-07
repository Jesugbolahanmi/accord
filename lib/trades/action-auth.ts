import {
  keccak256,
  toHex,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";

const ACTION_AUTH_TYPES = {
  AccordTradeAction: [
    { name: "origin", type: "string" },
    { name: "tradeReferenceHash", type: "bytes32" },
    { name: "actionHash", type: "bytes32" },
    { name: "expectedUpdatedAt", type: "uint256" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

const NETWORK_CHAIN_IDS: Record<string, number> = {
  "base-mainnet": 8453,
  "base-sepolia": 84532,
  "arbitrum-one": 42161,
  "ethereum-mainnet": 1,
  "polygon-mainnet": 137,
};

export interface TradeActionAuthorization {
  signature: Hex;
  issuedAt: string;
  expiresAt: string;
  expectedUpdatedAt: string;
}

export interface TradeActionPayload {
  origin: string;
  tradeReference: string;
  payload: Record<string, unknown>;
  expectedUpdatedAt: bigint;
  issuedAt: bigint;
  expiresAt: bigint;
  chainId: number;
}

export function getTradeActionChainId(network: string): number | undefined {
  return NETWORK_CHAIN_IDS[network];
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("Action payload contains an unsupported value.");
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function hashTradeActionPayload(payload: Record<string, unknown>): Hex {
  return keccak256(toHex(canonicalize(payload)));
}

export function createTradeActionTypedData(input: TradeActionPayload) {
  return {
    domain: {
      name: "Accord Trade Authorization",
      version: "1",
      chainId: input.chainId,
    },
    types: ACTION_AUTH_TYPES,
    primaryType: "AccordTradeAction" as const,
    message: {
      origin: input.origin,
      tradeReferenceHash: keccak256(toHex(input.tradeReference)),
      actionHash: hashTradeActionPayload(input.payload),
      expectedUpdatedAt: input.expectedUpdatedAt,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
    },
  };
}

export async function verifyTradeActionSignature(input: {
  address: Address;
  signature: Hex;
  authorization: TradeActionAuthorization;
  origin: string;
  tradeReference: string;
  payload: Record<string, unknown>;
  chainId: number;
  expectedUpdatedAt: bigint;
}): Promise<boolean> {
  const issuedAt = BigInt(input.authorization.issuedAt);
  const expiresAt = BigInt(input.authorization.expiresAt);
  const expectedUpdatedAt = BigInt(input.authorization.expectedUpdatedAt);

  if (expectedUpdatedAt !== input.expectedUpdatedAt) return false;
  if (expiresAt <= issuedAt || expiresAt - issuedAt > BigInt(300)) return false;

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (
    issuedAt > now + BigInt(30) ||
    expiresAt <= now ||
    issuedAt < now - BigInt(330)
  ) return false;

  const typedData = createTradeActionTypedData({
    origin: input.origin,
    tradeReference: input.tradeReference,
    payload: input.payload,
    expectedUpdatedAt,
    issuedAt,
    expiresAt,
    chainId: input.chainId,
  });

  return verifyTypedData({
    address: input.address,
    ...typedData,
    signature: input.signature,
  });
}

export function getAuthorizedPayload(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== "actor" && key !== "authorization")
  );
}

export function isTradeActionAuthorization(value: unknown): value is TradeActionAuthorization {
  if (typeof value !== "object" || value === null) return false;
  const authorization = value as Record<string, unknown>;
  return (
    typeof authorization.signature === "string" &&
    /^0x[a-fA-F0-9]{130}$/.test(authorization.signature) &&
    typeof authorization.issuedAt === "string" &&
    /^\d+$/.test(authorization.issuedAt) &&
    typeof authorization.expiresAt === "string" &&
    /^\d+$/.test(authorization.expiresAt) &&
    typeof authorization.expectedUpdatedAt === "string" &&
    /^\d+$/.test(authorization.expectedUpdatedAt)
  );
}
