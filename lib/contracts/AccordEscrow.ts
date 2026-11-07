import { ACCORD_ESCROW_DEPLOYMENT_ABI } from "@/contracts/artifacts/AccordEscrow";

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

export const ACCORD_ESCROW_ABI = ACCORD_ESCROW_DEPLOYMENT_ABI;
