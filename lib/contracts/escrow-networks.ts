import { arbitrum, base, baseSepolia, mainnet } from "viem/chains";
import type { Chain } from "viem";

export const EVM_ESCROW_NETWORKS = {
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: baseSepolia.id,
    chain: baseSepolia,
    asset: "ETH",
    testnet: true,
    explorerUrl: "https://sepolia.basescan.org",
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    fallbackRpcUrl: "https://sepolia.base.org",
  },
  "base-mainnet": {
    name: "Base",
    chainId: base.id,
    chain: base,
    asset: "ETH",
    testnet: false,
    explorerUrl: "https://basescan.org",
    rpcEnv: "BASE_MAINNET_RPC_URL",
    fallbackRpcUrl: "https://mainnet.base.org",
  },
  "arbitrum-one": {
    name: "Arbitrum One",
    chainId: arbitrum.id,
    chain: arbitrum,
    asset: "ETH",
    testnet: false,
    explorerUrl: "https://arbiscan.io",
    rpcEnv: "ARBITRUM_ONE_RPC_URL",
    fallbackRpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  "ethereum-mainnet": {
    name: "Ethereum Mainnet",
    chainId: mainnet.id,
    chain: mainnet,
    asset: "ETH",
    testnet: false,
    explorerUrl: "https://etherscan.io",
    rpcEnv: "ETHEREUM_MAINNET_RPC_URL",
    fallbackRpcUrl: "https://ethereum-rpc.publicnode.com",
  },
} satisfies Record<
  string,
  {
    name: string;
    chainId: number;
    chain: Chain;
    asset: "ETH";
    testnet: boolean;
    explorerUrl: string;
    rpcEnv: string;
    fallbackRpcUrl: string;
  }
>;

export type EvmEscrowNetwork = keyof typeof EVM_ESCROW_NETWORKS;

export function getEvmEscrowNetwork(network: string) {
  return Object.hasOwn(EVM_ESCROW_NETWORKS, network)
    ? EVM_ESCROW_NETWORKS[network as EvmEscrowNetwork]
    : undefined;
}

export function isEvmEscrowNetwork(network: string): network is EvmEscrowNetwork {
  return Object.hasOwn(EVM_ESCROW_NETWORKS, network);
}

export function isMainnetEscrowNetwork(network: string): boolean {
  const config = getEvmEscrowNetwork(network);
  return Boolean(config && !config.testnet);
}

export function isMainnetEscrowPubliclyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ACCORD_MAINNET_ESCROW_ENABLED === "true";
}
