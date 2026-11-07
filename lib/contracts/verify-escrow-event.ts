import {
  createPublicClient,
  decodeEventLog,
  parseEther,
  zeroHash,
  type Address,
  type Chain,
  type Hash,
  http,
  type PublicClient,
  type Transport,
} from "viem";
import { ACCORD_ESCROW_ABI } from "@/lib/contracts/AccordEscrow";
import { getEvmEscrowNetwork } from "@/lib/contracts/escrow-networks";

export interface EscrowTradeDetails {
  reference: string;
  buyer: string;
  seller: string;
  amount: string;
  termsHash: string;
}

export type EscrowActionEvent =
  | "TradeDeposited"
  | "FulfillmentConfirmed"
  | "TradeReleased"
  | "TradeRefunded";

export function createEscrowPublicClient(network: string) {
  const config = getEvmEscrowNetwork(network);
  if (!config) throw new Error(`Unsupported escrow network: ${network}`);
  return createPublicClient({
    chain: config.chain,
    transport: http(process.env[config.rpcEnv] || config.fallbackRpcUrl),
  });
}

export async function getEscrowContractVersion<
  TTransport extends Transport,
  TChain extends Chain | undefined,
>(
  client: PublicClient<TTransport, TChain>,
  contractAddress: Address
): Promise<bigint> {
  return client.readContract({
    address: contractAddress,
    abi: ACCORD_ESCROW_ABI,
    functionName: "version",
  });
}

export async function verifyEscrowActionEvent<
  TTransport extends Transport,
  TChain extends Chain | undefined,
>(input: {
  client: PublicClient<TTransport, TChain>;
  contractAddress: Address;
  trade: EscrowTradeDetails;
  txHash: Hash;
  actor: Address;
  expectedEvent: EscrowActionEvent;
}): Promise<void> {
  const { client, contractAddress, trade, txHash, actor, expectedEvent } = input;
  const [transaction, receipt, tradeId] = await Promise.all([
    client.getTransaction({ hash: txHash }),
    client.getTransactionReceipt({ hash: txHash }),
    client.readContract({
      address: contractAddress,
      abi: ACCORD_ESCROW_ABI,
      functionName: "tradeRefToId",
      args: [trade.reference],
    }),
  ]);

  if (
    String(transaction.from).toLowerCase() !== actor.toLowerCase() ||
    String(transaction.to).toLowerCase() !== contractAddress.toLowerCase() ||
    receipt.status !== "success" ||
    tradeId === zeroHash
  ) {
    throw new Error("The transaction is not a successful action for this escrow trade.");
  }

  const onChainTrade = await client.readContract({
    address: contractAddress,
    abi: ACCORD_ESCROW_ABI,
    functionName: "getTrade",
    args: [tradeId],
  });
  if (
    onChainTrade.id !== tradeId ||
    onChainTrade.tradeRef !== trade.reference ||
    onChainTrade.buyer.toLowerCase() !== trade.buyer.toLowerCase() ||
    onChainTrade.seller.toLowerCase() !== trade.seller.toLowerCase() ||
    onChainTrade.amount !== parseEther(trade.amount) ||
    onChainTrade.termsHash.toLowerCase() !== trade.termsHash.toLowerCase()
  ) {
    throw new Error("The on-chain escrow terms do not match this trade.");
  }

  const expectedAmount = parseEther(trade.amount);
  const foundExpectedEvent = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) return false;
    try {
      const event = decodeEventLog({
        abi: ACCORD_ESCROW_ABI,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
      switch (event.eventName) {
        case "TradeDeposited":
          if (expectedEvent !== "TradeDeposited") return false;
          return (
            event.args.tradeId === tradeId &&
            event.args.buyer?.toLowerCase() === actor.toLowerCase() &&
            event.args.amount === expectedAmount &&
            transaction.value === expectedAmount
          );
        case "FulfillmentConfirmed":
          if (expectedEvent !== "FulfillmentConfirmed") return false;
          return (
            event.args.tradeId === tradeId &&
            event.args.seller?.toLowerCase() === actor.toLowerCase() &&
            event.args.fulfillmentProofHash !== zeroHash
          );
        case "TradeReleased":
          if (expectedEvent !== "TradeReleased") return false;
          return (
            event.args.tradeId === tradeId &&
            actor.toLowerCase() === trade.buyer.toLowerCase() &&
            event.args.seller?.toLowerCase() === trade.seller.toLowerCase() &&
            event.args.amount === expectedAmount
          );
        case "TradeRefunded":
          if (expectedEvent !== "TradeRefunded") return false;
          return (
            event.args.tradeId === tradeId &&
            actor.toLowerCase() === trade.seller.toLowerCase() &&
            event.args.buyer?.toLowerCase() === trade.buyer.toLowerCase() &&
            event.args.amount === expectedAmount &&
            event.args.reason === "VOLUNTARY_SELLER_REFUND"
          );
      }
    } catch {
      return false;
    }
  });

  if (!foundExpectedEvent) {
    throw new Error(`The transaction does not contain the expected ${expectedEvent} event.`);
  }
}
