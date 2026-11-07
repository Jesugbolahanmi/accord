"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useAccount,
  useDeployContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { ArrowLeft, ArrowUpRight, Check, Copy, ExternalLink } from "lucide-react";
import {
  ACCORD_ESCROW_BYTECODE,
  ACCORD_ESCROW_DEPLOYMENT_ABI,
} from "@/contracts/artifacts/AccordEscrow";

const STORAGE_KEY = "accord_escrow_base_sepolia";

export default function BaseSepoliaSetupPage() {
  const { address, chainId, isConnected } = useAccount();
  const { deployContractAsync, isPending: isSubmitting } = useDeployContract();
  const { switchChainAsync } = useSwitchChain();
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | undefined>();
  const [deployedAddress, setDeployedAddress] = useState<`0x${string}` | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const {
    data: deploymentReceipt,
    isLoading: isConfirming,
    isError: receiptFailed,
  } = useWaitForTransactionReceipt({
    chainId: baseSepolia.id,
    hash: transactionHash,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedAddress = window.localStorage.getItem(STORAGE_KEY);
    if (/^0x[a-fA-F0-9]{40}$/.test(storedAddress || "")) {
      queueMicrotask(() => setDeployedAddress(storedAddress as `0x${string}`));
    }
  }, []);

  useEffect(() => {
    const confirmedAddress =
      deploymentReceipt?.status === "success" ? deploymentReceipt.contractAddress : undefined;
    if (confirmedAddress) window.localStorage.setItem(STORAGE_KEY, confirmedAddress);
  }, [deploymentReceipt]);

  const confirmedAddress =
    deploymentReceipt?.status === "success" ? deploymentReceipt.contractAddress : undefined;
  const displayedAddress = confirmedAddress || deployedAddress;
  const receiptError = receiptFailed
    ? "Could not confirm the deployment receipt. Check BaseScan and try again."
    : deploymentReceipt?.status === "reverted"
      ? "The deployment transaction reverted on Base Sepolia."
      : "";

  const handleDeploy = async () => {
    setErrorMessage("");
    setTransactionHash(undefined);
    try {
      if (!isConnected || !address) {
        throw new Error("Connect your EVM wallet first.");
      }
      if (chainId !== baseSepolia.id) {
        await switchChainAsync({ chainId: baseSepolia.id });
      }
      const hash = await deployContractAsync({
        abi: ACCORD_ESCROW_DEPLOYMENT_ABI,
        bytecode: ACCORD_ESCROW_BYTECODE,
        account: address,
        chainId: baseSepolia.id,
        args: [],
      });
      setTransactionHash(hash);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The wallet rejected or could not submit deployment."
      );
    }
  };

  const copyAddress = async () => {
    if (!displayedAddress) return;
    await navigator.clipboard.writeText(displayedAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const waitingForWallet = isSubmitting;
  const waitingForReceipt = isConfirming && Boolean(transactionHash);

  return (
    <main className="max-w-[900px] mx-auto px-4 sm:px-8 py-12 space-y-8">
      <Link
        href="/trades"
        className="inline-flex items-center gap-2 text-[12px] text-[#A6A39B] hover:text-[#F4F2ED]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to trades
      </Link>

      <section className="surface-instrument rounded-[4px] overflow-hidden">
        <div className="px-6 py-5 bg-[#11141B] border-b border-white/[0.08]">
          <div className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#C5A46D]">
            Base Sepolia · chain 84532
          </div>
          <h1 className="font-editorial text-[32px] text-[#F4F2ED] mt-1">
            Set up Accord escrow
          </h1>
          <p className="text-[13px] text-[#A6A39B] mt-2 max-w-[68ch] leading-relaxed">
            Deploy the Accord ETH escrow contract from your connected wallet. Your wallet submits
            and approves the transaction; Accord never asks for your recovery phrase or private key.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <ol className="space-y-3 text-[13px] text-[#A6A39B]">
            <li>1. Connect the wallet that holds your Base Sepolia test ETH.</li>
            <li>2. Switch it to Base Sepolia and approve the contract deployment in your wallet.</li>
            <li>3. Wait for the deployment receipt. Only test ETH is used; do not use mainnet.</li>
          </ol>

          {!isConnected && (
            <p className="rounded-[3px] border border-[#C88A32]/35 bg-[#C88A32]/[0.07] p-3 text-[12px] text-[#DEC392]">
              Connect your wallet using the button in the page header before deploying.
            </p>
          )}

          {isConnected && (
            <div className="rounded-[3px] border border-white/[0.08] bg-[#090A0C] p-3 font-mono-tabular text-[11px] text-[#A6A39B]">
              Wallet: {address}
              <br />
              Current network: {chainId === baseSepolia.id ? "Base Sepolia" : `Chain ${chainId}`}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleDeploy()}
            disabled={!isConnected || waitingForWallet || waitingForReceipt}
            className="inline-flex items-center gap-2 rounded-[3px] bg-[#C5A46D] px-4 py-2.5 text-[12px] font-medium text-[#090A0C] hover:bg-[#D6B882] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {waitingForWallet
              ? "Confirm in your wallet…"
              : waitingForReceipt
                ? "Waiting for Base Sepolia confirmation…"
                : displayedAddress
                  ? "Deploy a new escrow instance"
                  : "Deploy Accord escrow"}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          {transactionHash && (
            <p className="text-[12px] text-[#A6A39B] break-all">
              Deployment transaction:{" "}
              <a
                href={`https://sepolia.basescan.org/tx/${transactionHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#C5A46D] underline underline-offset-2"
              >
                {transactionHash} <ExternalLink className="inline w-3 h-3" />
              </a>
            </p>
          )}

          {(errorMessage || receiptError) && (
            <p role="alert" className="rounded-[3px] border border-[#C94A4A]/40 bg-[#C94A4A]/10 p-3 text-[12px] text-[#F28B8B]">
              {errorMessage || receiptError}
            </p>
          )}

          {displayedAddress && (
            <div className="space-y-3 rounded-[3px] border border-[#2E9B6E]/40 bg-[#2E9B6E]/[0.08] p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#5CE0A8]">
                <Check className="w-4 h-4" />
                Escrow contract deployed on Base Sepolia
              </div>
              <div className="break-all font-mono-tabular text-[12px] text-[#F4F2ED]">
                {displayedAddress}
              </div>
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="inline-flex items-center gap-2 rounded-[3px] border border-white/[0.12] px-3 py-1.5 text-[11px] text-[#A6A39B] hover:text-[#F4F2ED]"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy contract address"}
              </button>
              <p className="text-[12px] leading-relaxed text-[#DEC392]">
                This address is saved in this browser only. Server-side escrow verification uses
                ACCORD_ESCROW_BASE_SEPOLIA from .env.local; restart the app after changing it. Keep
                testing on Base Sepolia and confirm the server is configured before funding a trade.
              </p>
              <a
                href={`https://sepolia.basescan.org/address/${displayedAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#C5A46D] underline underline-offset-2"
              >
                View on BaseScan <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
