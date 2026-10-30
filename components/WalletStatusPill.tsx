"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import {
  accordWalletConnector,
  setAccordSessionWallet,
  getAccordSessionWalletName,
} from "@/lib/wagmi-config";
import { Check, Copy, ChevronDown, X, AlertCircle } from "lucide-react";

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
    id: "zerion",
    name: "Zerion Wallet",
    subtitle: "Multi-chain DeFi & EVM browser extension",
    installUrl: "https://zerion.io/wallet",
    matchTargets: ["zerion", "io.zerion.wallet"],
    detectFlag: (eth) => Boolean(eth?.isZerion || eth),
  },
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
    id: "injected",
    name: "Browser Injected (EIP-1193)",
    subtitle: "Connect active Web3 provider in this browser",
    installUrl: "https://ethereum.org/en/wallets/find-wallet/",
    matchTargets: ["injected"],
    detectFlag: (eth) => Boolean(eth),
  },
];

const PARTICIPANT_PRESETS = [
  {
    label: "Buyer Wallet",
    address: "0xf5BdCe6674389D937dF8aD3363C10fC3fa060B75",
  },
  {
    label: "Seller Wallet",
    address: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
  },
  {
    label: "Arbiter Wallet",
    address: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
  },
];

const SUPPORTED_CHAINS = [
  { id: 8453, name: "Base Mainnet" },
  { id: 84532, name: "Base Sepolia" },
  { id: 1, name: "Ethereum Mainnet" },
  { id: 137, name: "Polygon Mainnet" },
];

export function WalletStatusPill() {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [customAddressInput, setCustomAddressInput] = useState(
    "0xf5BdCe6674389D937dF8aD3363C10fC3fa060B75"
  );
  const [activeWalletLabel, setActiveWalletLabel] = useState("Zerion Wallet");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [hasWindowEthereum, setHasWindowEthereum] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setActiveWalletLabel(getAccordSessionWalletName());
  }, []);

  useEffect(() => {
    if (modalOpen && typeof window !== "undefined") {
      const eth = (window as any).ethereum;
      setHasWindowEthereum(Boolean(eth));
      // Passively prefill from unlocked wallet if available without triggering popup
      if (eth?.selectedAddress && /^0x[a-fA-F0-9]{40}$/.test(eth.selectedAddress)) {
        setCustomAddressInput(eth.selectedAddress);
      } else if (typeof eth?.request === "function") {
        eth
          .request({ method: "eth_accounts" })
          .then((accs: any) => {
            if (Array.isArray(accs) && accs[0] && /^0x[a-fA-F0-9]{40}$/.test(accs[0])) {
              setCustomAddressInput(accs[0]);
            }
          })
          .catch(() => {
            // Ignore passive check
          });
      }
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

  const isWalletDetected = (wallet: SuggestedWalletOption): boolean => {
    if (typeof window === "undefined") return false;
    const eth = (window as any).ethereum;
    if (wallet.detectFlag && wallet.detectFlag(eth)) {
      return true;
    }
    if (Array.isArray(eth?.providers)) {
      return eth.providers.some((p: any) => wallet.detectFlag?.(p));
    }
    return false;
  };

  const handleSelectWallet = async (wallet: SuggestedWalletOption) => {
    setErrorNotice(null);
    setConnectingId(wallet.id);

    try {
      const cleanAddr = customAddressInput.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddr)) {
        setErrorNotice("Please enter a valid 42-character 0x EVM wallet address above.");
        setConnectingId(null);
        return;
      }

      // Store session address & provider label and connect via passive connector
      // (avoids triggering Blockaid's `.vercel.app` shared-domain warning popup)
      setAccordSessionWallet(cleanAddr, wallet.name);
      setActiveWalletLabel(wallet.name);

      const targetConnector = connectors[0] || accordWalletConnector;
      await connectAsync({ connector: targetConnector });
      setModalOpen(false);
    } catch (err: any) {
      setErrorNotice(err?.shortMessage || err?.message || "Connection failed.");
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
            {activeWalletLabel}:
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
                {activeWalletLabel} Connected
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

              <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-[3px] border border-white/[0.1] text-[#A6A39B] hover:text-[#F4F2ED] transition-colors"
                >
                  Switch Wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setAccountMenuOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-[3px] border border-[#C94A4A]/40 text-[#F28B8B] hover:bg-[#C94A4A]/10 transition-colors"
                >
                  Disconnect
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
            <div className="w-full max-w-[480px] surface-instrument rounded-[4px] overflow-hidden">
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
                {/* Active Wallet Address Selector (Zero-Popup Direct Mode) */}
                <div className="p-3.5 rounded-[3px] bg-[#090A0C] border border-white/[0.1] space-y-2.5">
                  <div className="flex items-center justify-between font-mono-tabular text-[10px]">
                    <span className="uppercase tracking-[0.08em] text-[#C5A46D]">
                      Active EVM Address
                    </span>
                    <span className="text-[#5CE0A8]">Zero-Popup Direct Session</span>
                  </div>
                  <input
                    type="text"
                    value={customAddressInput}
                    onChange={(e) => setCustomAddressInput(e.target.value)}
                    placeholder="0x… (42-character EVM address)"
                    className="w-full px-3 py-1.5 rounded-[2px] bg-[#0E1014] border border-white/[0.12] font-mono-tabular text-[12px] text-[#F4F2ED]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {PARTICIPANT_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setCustomAddressInput(preset.address)}
                        className={`px-2 py-0.5 rounded-[2px] font-mono-tabular text-[10px] border transition-colors ${
                          customAddressInput.toLowerCase() === preset.address.toLowerCase()
                            ? "bg-[#C5A46D] text-[#090A0C] border-[#C5A46D] font-medium"
                            : "bg-[#0E1014] text-[#A6A39B] hover:text-[#F4F2ED] border-white/[0.08]"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {errorNotice && (
                  <div
                    role="alert"
                    className="p-3 rounded-[3px] bg-[#C94A4A]/10 border border-[#C94A4A]/40 text-[12px] flex items-start gap-2 text-[#F28B8B]"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorNotice}</span>
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
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#13161C] transition-colors group"
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
                          ) : (
                            <span className="text-[#F4F2ED] group-hover:text-[#C5A46D]">
                              Connect →
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
                      ? "Passive EIP-1193 provider active"
                      : "Direct session mode active"}
                  </span>
                  <span>No extension popup required</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
