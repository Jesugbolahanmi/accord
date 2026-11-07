import { http, createConfig, createConnector } from "wagmi";
import { arbitrum, base, baseSepolia, mainnet, polygon } from "wagmi/chains";
import { defineChain, getAddress } from "viem";

const STORAGE_ADDRESS_KEY = "accord_active_wallet_address";
const STORAGE_WALLET_NAME_KEY = "accord_active_wallet_name";
const STORAGE_CHAIN_KEY = "accord_active_chain_id";

export const accordLocalChain = defineChain({
  id: 31337,
  name: "Accord Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  testnet: true,
});

interface SwitchableEip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function isSwitchableEip1193Provider(value: unknown): value is SwitchableEip1193Provider {
  return (
    typeof value === "object" &&
    value !== null &&
    "request" in value &&
    typeof value.request === "function"
  );
}

function getProviderErrorCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  ) {
    return error.code;
  }
  return undefined;
}

let activeEip1193Provider: SwitchableEip1193Provider | null = null;

export function setAccordSessionWallet(address: string, walletName: string, provider?: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ADDRESS_KEY, getAddress(address));
  localStorage.setItem(STORAGE_WALLET_NAME_KEY, walletName);
  if (isSwitchableEip1193Provider(provider)) {
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

    async connect<withCapabilities extends boolean = false>({
      chainId,
      withCapabilities,
    }: {
      chainId?: number;
      isReconnecting?: boolean;
      withCapabilities?: withCapabilities | boolean;
    } = {}): Promise<{
      accounts: withCapabilities extends true
        ? readonly { address: `0x${string}`; capabilities: Record<string, unknown> }[]
        : readonly `0x${string}`[];
      chainId: number;
    }> {
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
      const supportedChainIds: number[] = [
        base.id,
        baseSepolia.id,
        arbitrum.id,
        mainnet.id,
        polygon.id,
        accordLocalChain.id,
      ];
      if (savedChain && supportedChainIds.includes(savedChain)) {
        currentChainId = savedChain;
      }

      const accounts =
        withCapabilities === true
          ? [{ address: resolvedAddress, capabilities: {} }] as const
          : [resolvedAddress] as const;
      return {
        accounts: accounts as unknown as withCapabilities extends true
          ? readonly { address: `0x${string}`; capabilities: Record<string, unknown> }[]
          : readonly `0x${string}`[],
        chainId: currentChainId,
      };
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
      if (typeof window !== "undefined") {
        const injectedProvider = (window as Window & { ethereum?: unknown }).ethereum;
        if (isSwitchableEip1193Provider(injectedProvider)) return injectedProvider;
      }
      return {};
    },

    async isAuthorized() {
      if (typeof window === "undefined") return false;
      const saved = localStorage.getItem(STORAGE_ADDRESS_KEY);
      return Boolean(saved && /^0x[a-fA-F0-9]{40}$/.test(saved));
    },

    async switchChain({ chainId }) {
      const chain = config.chains.find((candidate) => candidate.id === chainId);
      if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);

      const injectedProvider =
        typeof window === "undefined"
          ? undefined
          : (window as Window & { ethereum?: unknown }).ethereum;
      const provider =
        activeEip1193Provider ??
        (isSwitchableEip1193Provider(injectedProvider) ? injectedProvider : null);
      if (!provider) throw new Error("The connected wallet does not expose a switchable provider.");

      const hexChainId = `0x${chainId.toString(16)}`;
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        });
      } catch (error) {
        if (chainId !== accordLocalChain.id || getProviderErrorCode(error) !== 4902) {
          throw error;
        }

        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls.default.http,
            },
          ],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        });
      }

      currentChainId = chainId;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_CHAIN_KEY, String(chainId));
      }
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
  chains: [base, baseSepolia, arbitrum, mainnet, polygon, accordLocalChain],
  multiInjectedProviderDiscovery: false,
  connectors: [accordWalletConnector],
  transports: {
    [base.id]: http("https://base-mainnet.gateway.tatum.io"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [mainnet.id]: http("https://ethereum-mainnet.gateway.tatum.io"),
    [polygon.id]: http("https://polygon-mainnet.gateway.tatum.io"),
    [accordLocalChain.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
