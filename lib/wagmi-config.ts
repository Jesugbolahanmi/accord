import { http, createConfig, createConnector } from "wagmi";
import { base, baseSepolia, mainnet, polygon } from "wagmi/chains";
import { getAddress } from "viem";

const STORAGE_ADDRESS_KEY = "accord_active_wallet_address";
const STORAGE_WALLET_NAME_KEY = "accord_active_wallet_name";
const STORAGE_CHAIN_KEY = "accord_active_chain_id";

let activeEip1193Provider: any = null;

export function setAccordSessionWallet(address: string, walletName: string, provider?: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ADDRESS_KEY, getAddress(address));
  localStorage.setItem(STORAGE_WALLET_NAME_KEY, walletName);
  if (provider) {
    activeEip1193Provider = provider;
  }
}

export function getAccordSessionWalletName(): string {
  if (typeof window === "undefined") return "Connected";
  return localStorage.getItem(STORAGE_WALLET_NAME_KEY) || "Connected";
}

export const accordWalletConnector = createConnector((config) => {
  let currentChainId: number = base.id;

  return {
    id: "accordWallet",
    name: "Web3 Wallet",
    type: "injected",

    async connect({ chainId } = {}) {
      if (chainId) currentChainId = chainId;

      if (typeof window === "undefined") {
        throw new Error("Cannot connect wallet on server");
      }

      const saved = localStorage.getItem(STORAGE_ADDRESS_KEY);
      if (!saved || !/^0x[a-fA-F0-9]{40}$/.test(saved)) {
        throw new Error("No wallet account authorized.");
      }

      const resolvedAddress = getAddress(saved);
      const savedChain = Number(localStorage.getItem(STORAGE_CHAIN_KEY));
      if (
        savedChain &&
        [base.id, baseSepolia.id, mainnet.id, polygon.id].includes(savedChain as any)
      ) {
        currentChainId = savedChain;
      }

      const accounts = [resolvedAddress as `0x${string}`] as const;
      return {
        accounts,
        chainId: currentChainId,
      } as any;
    },

    async disconnect() {
      activeEip1193Provider = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_ADDRESS_KEY);
        localStorage.removeItem(STORAGE_WALLET_NAME_KEY);
      }
    },

    async getAccounts() {
      if (typeof window === "undefined") return [];
      const saved = localStorage.getItem(STORAGE_ADDRESS_KEY);
      if (saved && /^0x[a-fA-F0-9]{40}$/.test(saved)) {
        return [getAddress(saved)];
      }
      return [];
    },

    async getChainId() {
      if (typeof window !== "undefined") {
        const savedChain = Number(localStorage.getItem(STORAGE_CHAIN_KEY));
        if (savedChain) return savedChain;
      }
      return currentChainId;
    },

    async getProvider() {
      if (activeEip1193Provider) return activeEip1193Provider;
      if (typeof window !== "undefined" && (window as any).ethereum) {
        return (window as any).ethereum;
      }
      return {};
    },

    async isAuthorized() {
      if (typeof window === "undefined") return false;
      const saved = localStorage.getItem(STORAGE_ADDRESS_KEY);
      return Boolean(saved && /^0x[a-fA-F0-9]{40}$/.test(saved));
    },

    async switchChain({ chainId }) {
      currentChainId = chainId;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_CHAIN_KEY, String(chainId));
      }
      if (activeEip1193Provider?.request) {
        try {
          await activeEip1193Provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          });
        } catch {
          // Keep internal chain state synced even if extension declines chain switch
        }
      }
      const chain = config.chains.find((c) => c.id === chainId) || base;
      config.emitter.emit("change", { chainId });
      return chain;
    },

    onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        config.emitter.emit("disconnect");
      } else {
        const addr = getAddress(accounts[0]);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_ADDRESS_KEY, addr);
        }
        config.emitter.emit("change", {
          accounts: accounts.map((x) => getAddress(x)),
        });
      }
    },

    onChainChanged(chain) {
      const chainId = Number(chain);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_CHAIN_KEY, String(chainId));
      }
      config.emitter.emit("change", { chainId });
    },

    onDisconnect() {
      config.emitter.emit("disconnect");
    },
  };
});

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia, mainnet, polygon],
  multiInjectedProviderDiscovery: false,
  connectors: [accordWalletConnector],
  transports: {
    [base.id]: http("https://base-mainnet.gateway.tatum.io"),
    [baseSepolia.id]: http("https://base-sepolia.gateway.tatum.io"),
    [mainnet.id]: http("https://ethereum-mainnet.gateway.tatum.io"),
    [polygon.id]: http("https://polygon-mainnet.gateway.tatum.io"),
  },
  ssr: true,
});
