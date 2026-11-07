import { isAddress, type Address } from "viem";
import {
  getEvmEscrowNetwork,
  isMainnetEscrowNetwork,
} from "@/lib/contracts/escrow-networks";

export function isEscrowNetworkEnabled(network: string): boolean {
  const config = getEvmEscrowNetwork(network);
  if (!config) return false;
  if (config.testnet) return true;
  if (process.env.ACCORD_ENABLE_MAINNET_ESCROW !== "true") return false;
  if (process.env.NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED !== "true") return false;
  return Boolean(getConfiguredEscrowAddress(network));
}

export function getConfiguredEscrowAddress(network: string): Address | undefined {
  const config = getEvmEscrowNetwork(network);
  if (!config) return undefined;
  const envKey = `ACCORD_ESCROW_${network.toUpperCase().replace(/-/g, "_")}`;
  const value = (process.env[envKey] || "").trim();
  return isAddress(value) ? value : undefined;
}

export function getEscrowAddress(network: string): Address | undefined {
  if (isMainnetEscrowNetwork(network) && !isEscrowNetworkEnabled(network)) {
    return undefined;
  }
  return getConfiguredEscrowAddress(network);
}
