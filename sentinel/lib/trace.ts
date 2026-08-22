import { getWalletTransactions } from "./basescan";
import { checkLargeOutflow } from "./rules";

export interface TraceHop {
  address: string;
  incomingFrom?: string;
  outflowTo?: string;
  outflowAmount?: string;
}

export async function traceFunds(startAddress: string, maxHops: number = 3) {
  const trail: TraceHop[] = [];
  let currentAddress = startAddress;

  for (let hop = 0; hop < maxHops; hop++) {
    const transactions = await getWalletTransactions(currentAddress);
    const outgoing = transactions.filter(
      (tx: any) => tx.from.toLowerCase() === currentAddress.toLowerCase() && tx.decimal === 18 && !tx.asset
    );

    const outflowFlag = checkLargeOutflow(transactions, currentAddress);

    if (!outflowFlag || outgoing.length === 0) {
      trail.push({ address: currentAddress });
      break;
    }

    const largest = outgoing.reduce((max: any, tx: any) =>
      BigInt(tx.value) > BigInt(max.value) ? tx : max
    );

    trail.push({
      address: currentAddress,
      outflowTo: largest.to,
      outflowAmount: (Number(BigInt(largest.value)) / 1e18).toFixed(4),
    });

    currentAddress = largest.to;
  }

  return trail;
}