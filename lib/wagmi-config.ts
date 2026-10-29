import { http, createConfig, injected } from "wagmi";
import { base, baseSepolia, mainnet, polygon } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia, mainnet, polygon],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected({ target: "metaMask" }),
    injected({ target: "rabby" }),
    injected({ target: "coinbaseWallet" }),
    injected({ target: "phantom" }),
    injected({ target: "braveWallet" }),
    injected(),
  ],
  transports: {
    [base.id]: http("https://base-mainnet.gateway.tatum.io"),
    [baseSepolia.id]: http("https://base-sepolia.gateway.tatum.io"),
    [mainnet.id]: http("https://ethereum-mainnet.gateway.tatum.io"),
    [polygon.id]: http("https://polygon-mainnet.gateway.tatum.io"),
  },
  ssr: true,
});
