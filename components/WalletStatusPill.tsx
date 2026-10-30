"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { Check, Copy, ChevronDown, X, ArrowUpRight, AlertCircle } from "lucide-react";

interface SuggestedWalletOption {
  id: string;
  name: string;
  subtitle: string;
  installUrl: string;
  matchTargets: string[];
  detectFlag?: (eth: any) => boolean;
}

const SUGGESTED_WALLETS: SuggestedWalletOption[] = [
  {
    id: "metaMask",
    name: "MetaMask",
    subtitle: "Browser extension & hardware bridge",
    installUrl: "https://metamask.io/download/",
    matchTargets: ["metamask", "io.metamask"],
    detectFlag: (eth) => Boolean(eth?.isMetaMask),
  },
  {
    id: "rabby",
    name: "Rabby Wallet",
    subtitle: "Institutional multi-chain EVM security wallet",
    installUrl: "https://rabby.io/",
    matchTargets: ["rabby", "io.rabby"],
    detectFlag: (eth) => Boolean(eth?.isRabby),
  },
  {
    id: "coinbaseWallet",
    name: "Coinbase Wallet",
    subtitle: "Smart wallet & browser extension",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    matchTargets: ["coinbasewallet", "coinbase", "com.coinbase.wallet"],
    detectFlag: (eth) => Boolean(eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser),
  },
  {
    id: "phantom",
    name: "Phantom",
    subtitle: "Multi-chain EVM browser wallet",
    installUrl: "https://phantom.com/download",
    matchTargets: ["phantom", "app.phantom"],
    detectFlag: (eth) => Boolean(eth?.isPhantom || (window as any)?.phantom?.ethereum),
  },
  {
    id: "braveWallet",
    name: "Brave Wallet",
    subtitle: "Native browser cryptography wallet",
    installUrl: "https://brave.com/wallet/",
    matchTargets: ["bravewallet", "com.brave.wallet"],
    detectFlag: (eth) => Boolean(eth?.isBraveWallet),
  },
  {
    id: "injected",
    name: "Browser Injected (EIP-1193)",
    subtitle: "Connect any active Web3 provider in this browser",
    installUrl: "https://ethereum.org/en/wallets/find-wallet/",
    matchTargets: ["injected"],
    detectFlag: (eth) => Boolean(eth),
  },
];

const SUPPORTED_CHAINS = [
  { id: 8453, name: "Base Mainnet" },
  { id: 84532, name: "Base Sepolia" },
  { id: 1, name: "Ethereum Mainnet" },
  { id: 137, name: "Polygon Mainnet" },
];

export function WalletStatusPill() {
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<{
    message: string;
    installUrl?: string;
    walletName?: string;
  } | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [hasWindowEthereum, setHasWindowEthereum] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (modalOpen && typeof window !== "undefined") {
      setHasWindowEthereum(Boolean((window as any).ethereum));
    }
  }, [modalOpen]);

  // Close popovers on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setAccountMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!mounted) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono-tabular text-[#6E6C65] border border-white/[0.07] rounded-[3px]">
        Wallet —
      </span>
    );
  }

  const findConnectorForWallet = (wallet: SuggestedWalletOption): Connector | undefined => {
    // 1. Exact ID or name match from EIP-6963 or configured target
    const direct = connectors.find((c) => {
      const cId = c.id.toLowerCase();
      const cName = c.name.toLowerCase();
      return wallet.matchTargets.some(
        (t) => cId === t || cId.includes(t) || cName.includes(t)
      );
    });
    if (direct) return direct;

    // 2. Fallback to generic injected connector
    return connectors.find((c) => c.id === "injected") || connectors[0];
  };

  const isWalletDetected = (wallet: SuggestedWalletOption): boolean => {
    if (typeof window === "undefined") return false;
    const eth = (window as any).ethereum;

    // Check if EIP-6963 discovered this specific wallet
    const eip6963Match = connectors.some((c) => {
      const cId = c.id.toLowerCase();
      const cName = c.name.toLowerCase();
      return (
        c.id !== "injected" &&
        !["metamask", "rabby", "coinbasewallet", "phantom", "bravewallet"].includes(cId) &&
        wallet.matchTargets.some((t) => cId.includes(t) || cName.includes(t))
      );
    });
    if (eip6963Match) return true;

    if (wallet.detectFlag && wallet.detectFlag(eth)) {
      return true;
    }

    // Multiple providers array check
    if (Array.isArray(eth?.providers)) {
      return eth.providers.some((p: any) => wallet.detectFlag?.(p));
    }

    return false;
  };

  const handleSelectWallet = async (wallet: SuggestedWalletOption) => {
    setErrorNotice(null);
    setConnectingId(wallet.id);

    try {
      const eth = typeof window !== "undefined" ? (window as any).ethereum : undefined;
      const detected = isWalletDetected(wallet);

      if (!eth && !detected) {
        setErrorNotice({
          walletName: wallet.name,
          message: `${wallet.name} was not detected in this browser session.`,
          installUrl: wallet.installUrl,
        });
        setConnectingId(null);
        return;
      }

      const targetConnector = findConnectorForWallet(wallet);
      if (!targetConnector) {
        setErrorNotice({
          walletName: wallet.name,
          message: `No compatible connector available for ${wallet.name}.`,
          installUrl: wallet.installUrl,
        });
        setConnectingId(null);
        return;
      }

      await connectAsync({ connector: targetConnector });
      setModalOpen(false);
    } catch (err: any) {
      const rawMsg = err?.shortMessage || err?.message || "Connection request failed.";
      const isRejected =
        rawMsg.toLowerCase().includes("rejected") ||
        rawMsg.toLowerCase().includes("denied");
      setErrorNotice({
        walletName: wallet.name,
        message: isRejected
          ? `Connection request was declined in ${wallet.name}.`
          : `${wallet.name} provider not found or locked (${rawMsg}).`,
        installUrl: isRejected ? undefined : wallet.installUrl,
      });
    } finally {
      setConnectingId(null);
    }
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  // Connected state with dropdown account & network panel
  if (isConnected && address) {
    const activeChain =
      SUPPORTED_CHAINS.find((c) => c.id === chainId) || SUPPORTED_CHAINS[0];

    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setAccountMenuOpen(!accountMenuOpen)}
          className="inline-flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-mono-tabular bg-[#13161C] hover:bg-[#181C24] border border-white/[0.14] rounded-[3px] text-[#F4F2ED] transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E9B6E]" />
          <span className="text-[#A6A39B] hidden sm:inline">
            {activeConnector?.name || "Connected"}:
          </span>
          <span>
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
          <ChevronDown className="w-3 h-3 text-[#6E6C65]" />
        </button>

        {accountMenuOpen && (
          <div className="absolute right-0 mt-2 w-72 surface-instrument rounded-[4px] z-50 overflow-hidden">
            <div className="px-4 py-3 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between font-mono-tabular text-[11px]">
              <span className="text-[#5CE0A8]">
                {activeConnector?.name || "Web3 Wallet"} Connected
              </span>
              <span className="text-[#6E6C65]">Chain {chainId}</span>
            </div>

            <div className="p-4 space-y-4 font-mono-tabular text-[11px]">
              <div>
                <div className="text-[10px] uppercase text-[#6E6C65]">Active Address</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[#F4F2ED] bg-[#090A0C] border border-white/[0.08] px-2.5 py-1.5 rounded-[3px]">
                  <span className="truncate">{address}</span>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="text-[#C5A46D] hover:text-[#D6B882] shrink-0"
                    title="Copy wallet address"
                  >
                    {copiedAddr ? (
                      <Check className="w-3.5 h-3.5 text-[#5CE0A8]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#6E6C65] mb-1.5">
                  Switch Settlement Network
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SUPPORTED_CHAINS.map((c) => {
                    const isCurrent = c.id === activeChain.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => switchChain?.({ chainId: c.id })}
                        className={`px-2 py-1.5 rounded-[2px] border text-left truncate transition-colors ${
                          isCurrent
                            ? "bg-[#13161C] border-[#C5A46D] text-[#F4F2ED]"
                            : "bg-[#090A0C] border-white/[0.07] text-[#A6A39B] hover:text-[#F4F2ED]"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.08] flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setAccountMenuOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-[3px] border border-[#C94A4A]/40 text-[#F28B8B] hover:bg-[#C94A4A]/10 transition-colors"
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorNotice(null);
          setModalOpen(true);
        }}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono-tabular text-[#F4F2ED] bg-[#0E1014] hover:bg-[#13161C] border border-white/[0.12] rounded-[3px] transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46D]" />
        <span>Connect Wallet</span>
        <ChevronDown className="w-3 h-3 text-[#6E6C65]" />
      </button>

      {/* Wallet Selection Modal rendered via Portal to document.body */}
      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="accord-wallet-modal-title"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div className="w-full max-w-[460px] surface-instrument rounded-[4px] overflow-hidden">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <div className="font-mono-tabular text-[10px] uppercase tracking-[0.12em] text-[#C5A46D]">
                    Participant Authentication
                  </div>
                  <h2
                    id="accord-wallet-modal-title"
                    className="font-editorial text-[22px] text-[#F4F2ED] leading-tight mt-0.5"
                  >
                    Select a Wallet to Connect
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-[3px] text-[#6E6C65] hover:text-[#F4F2ED] hover:bg-white/[0.05] transition-colors"
                  aria-label="Close wallet selector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Suggested Wallet Options List */}
              <div className="p-5 space-y-4">
                <p className="text-[12px] text-[#A6A39B] leading-relaxed">
                  Choose your preferred EVM wallet provider to sign agreements or authorize
                  settlement transactions on Base, Ethereum, or Polygon.
                </p>

                {errorNotice && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-[3px] bg-[#C94A4A]/10 border border-[#C94A4A]/40 text-[12px] space-y-2"
                  >
                    <div className="flex items-start gap-2 text-[#F28B8B]">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorNotice.message}</span>
                    </div>
                    {errorNotice.installUrl && (
                      <div className="pl-6">
                        <a
                          href={errorNotice.installUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#C5A46D] hover:text-[#D6B882]"
                        >
                          <span>Install or open {errorNotice.walletName}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div className="divide-y divide-white/[0.07] border border-white/[0.1] rounded-[3px] bg-[#090A0C]">
                  {SUGGESTED_WALLETS.map((wallet) => {
                    const detected = isWalletDetected(wallet);
                    const isConnecting = connectingId === wallet.id;

                    return (
                      <button
                        key={wallet.id}
                        type="button"
                        disabled={Boolean(connectingId)}
                        onClick={() => handleSelectWallet(wallet)}
                        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#13161C] transition-colors group"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#F4F2ED] group-hover:text-[#D6B882] transition-colors">
                              {wallet.name}
                            </span>
                            {detected && (
                              <span className="status-pill status-pill-verified">
                                Detected
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#6E6C65]">{wallet.subtitle}</div>
                        </div>

                        <div className="font-mono-tabular text-[11px] shrink-0">
                          {isConnecting ? (
                            <span className="text-[#C5A46D]">Connecting…</span>
                          ) : detected ? (
                            <span className="text-[#F4F2ED] group-hover:text-[#C5A46D]">
                              Connect →
                            </span>
                          ) : (
                            <span className="text-[#6E6C65] group-hover:text-[#A6A39B]">
                              Select →
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] font-mono-tabular text-[#6E6C65]">
                  <span>
                    {hasWindowEthereum
                      ? "EIP-1193 / EIP-6963 browser provider active"
                      : "No browser wallet extension detected"}
                  </span>
                  <span>Read-only mode supported</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
