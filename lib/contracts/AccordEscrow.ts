/**
 * AccordEscrow Contract ABI and TypeScript Definitions
 * Synchronized with contracts/AccordEscrow.sol
 */

export enum TradeState {
  Draft = 0,
  AwaitingAcceptance = 1,
  AwaitingDeposit = 2,
  Funded = 3,
  AwaitingConditions = 4,
  ReadyForRelease = 5,
  Completed = 6,
  Disputed = 7,
  Refunded = 8,
  Expired = 9,
}

export const TradeStateLabels: Record<TradeState, string> = {
  [TradeState.Draft]: "Draft",
  [TradeState.AwaitingAcceptance]: "Awaiting Acceptance",
  [TradeState.AwaitingDeposit]: "Awaiting Deposit",
  [TradeState.Funded]: "Funded (Escrow Locked)",
  [TradeState.AwaitingConditions]: "Awaiting Conditions",
  [TradeState.ReadyForRelease]: "Ready for Release",
  [TradeState.Completed]: "Completed & Settled",
  [TradeState.Disputed]: "In Dispute",
  [TradeState.Refunded]: "Refunded to Buyer",
  [TradeState.Expired]: "Expired",
};

export const ACCORD_ESCROW_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: false, internalType: "string", name: "tradeRef", type: "string" },
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: true, internalType: "address", name: "seller", type: "address" },
      { indexed: false, internalType: "address", name: "arbiter", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "deadline", type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "termsHash", type: "bytes32" },
    ],
    name: "TradeCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "depositor", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "TradeDeposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "seller", type: "address" },
    ],
    name: "SellerFulfilled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "TradeReleased",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "TradeRefunded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "initiator", type: "address" },
      { indexed: false, internalType: "string", name: "reason", type: "string" },
    ],
    name: "TradeDisputed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "resolver", type: "address" },
      { indexed: false, internalType: "uint256", name: "buyerPayout", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "sellerPayout", type: "uint256" },
      { indexed: false, internalType: "string", name: "resolutionNote", type: "string" },
    ],
    name: "DisputeResolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { indexed: true, internalType: "address", name: "proposer", type: "address" },
      { indexed: false, internalType: "uint256", name: "buyerSplitBps", type: "uint256" },
    ],
    name: "MutualSettlementProposed",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "tradeRef", type: "string" },
      { internalType: "address payable", name: "seller", type: "address" },
      { internalType: "address", name: "arbiter", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "bytes32", name: "termsHash", type: "bytes32" },
    ],
    name: "createTrade",
    outputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "confirmFulfillment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "approveRelease",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "refund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "claimExpiredRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { internalType: "string", name: "reason", type: "string" },
    ],
    name: "raiseDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { internalType: "uint256", name: "buyerSplitBps", type: "uint256" },
      { internalType: "string", name: "resolutionNote", type: "string" },
    ],
    name: "resolveDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { internalType: "uint256", name: "buyerSplitBps", type: "uint256" },
    ],
    name: "proposeMutualSettlement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "acceptMutualSettlement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "getTrade",
    outputs: [
      {
        components: [
          { internalType: "bytes32", name: "id", type: "bytes32" },
          { internalType: "string", name: "tradeRef", type: "string" },
          { internalType: "address payable", name: "buyer", type: "address" },
          { internalType: "address payable", name: "seller", type: "address" },
          { internalType: "address", name: "arbiter", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
          { internalType: "bytes32", name: "termsHash", type: "bytes32" },
          { internalType: "uint8", name: "state", type: "uint8" },
          { internalType: "bool", name: "buyerApproved", type: "bool" },
          { internalType: "bool", name: "sellerFulfilled", type: "bool" },
          { internalType: "uint256", name: "proposedBuyerSplitBps", type: "uint256" },
          { internalType: "address", name: "settlementProposer", type: "address" },
        ],
        internalType: "struct AccordEscrow.Trade",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Deployed AccordEscrow addresses are configured per network through server-side
 * environment variables, e.g. `ACCORD_ESCROW_BASE_MAINNET=0x...`.
 *
 * No address is assumed. When a network has no configured deployment, Accord runs in
 * "direct" settlement mode: the buyer pays the seller directly and Accord verifies the
 * transfer through Tatum RPC. The interface must never describe such funds as escrowed.
 */
export function getEscrowAddress(network: string): `0x${string}` | undefined {
  const key = `ACCORD_ESCROW_${network.toUpperCase().replace(/-/g, "_")}`;
  const value = (process.env[key] || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as `0x${string}`) : undefined;
}
