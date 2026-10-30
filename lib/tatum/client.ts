/**
 * Accord - Tatum RPC Gateway & Verification Client
 *
 * Provides real-time on-chain transaction verification, block confirmations,
 * balance queries, and RPC diagnostics across EVM networks supported by Tatum.
 *
 * Security rule: Keep TATUM_API_KEY server-side only.
 */

export interface NetworkConfig {
  id: string;
  name: string;
  slug: string;
  gatewayUrl: string;
  fallbackRpcUrl: string;
  nativeCurrency: string;
  blockExplorer: string;
  chainId: number;
}

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  "base-mainnet": {
    id: "base-mainnet",
    name: "Base Mainnet",
    slug: "base-mainnet",
    gatewayUrl: "https://base-mainnet.gateway.tatum.io",
    fallbackRpcUrl: "https://mainnet.base.org",
    nativeCurrency: "ETH",
    blockExplorer: "https://basescan.org",
    chainId: 8453,
  },
  "base-sepolia": {
    id: "base-sepolia",
    name: "Base Sepolia Testnet",
    slug: "base-sepolia",
    gatewayUrl: "https://base-sepolia.gateway.tatum.io",
    fallbackRpcUrl: "https://sepolia.base.org",
    nativeCurrency: "ETH",
    blockExplorer: "https://sepolia.basescan.org",
    chainId: 84532,
  },
  "ethereum-mainnet": {
    id: "ethereum-mainnet",
    name: "Ethereum Mainnet",
    slug: "ethereum-mainnet",
    gatewayUrl: "https://ethereum-mainnet.gateway.tatum.io",
    fallbackRpcUrl: "https://ethereum-rpc.publicnode.com",
    nativeCurrency: "ETH",
    blockExplorer: "https://etherscan.io",
    chainId: 1,
  },
  "polygon-mainnet": {
    id: "polygon-mainnet",
    name: "Polygon Mainnet",
    slug: "polygon-mainnet",
    gatewayUrl: "https://polygon-mainnet.gateway.tatum.io",
    fallbackRpcUrl: "https://polygon-bor-rpc.publicnode.com",
    nativeCurrency: "POL",
    blockExplorer: "https://polygonscan.com",
    chainId: 137,
  },
};

const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Convert a decimal amount string (e.g. "0.000371") to wei/smallest unit without floating point loss.
 * Returns null for malformed input.
 */
export function decimalToWei(amount: string, decimals = 18): bigint | null {
  const clean = (amount || "").trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  if (fraction.length > decimals) return null;
  return (
    BigInt(whole) * BigInt(10) ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  );
}

export function weiToDecimal(wei: bigint, decimals = 18): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = wei / base;
  const fraction = (wei % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

export interface VerificationResult {
  verified: boolean;
  status: "confirmed" | "pending" | "reverted" | "not_found" | "mismatch";
  confirmations: number;
  requiredConfirmations?: number;
  blockNumber?: number;
  txHash: string;
  from?: string;
  to?: string;
  valueEth?: string;
  asset?: string;
  network: string;
  chainId?: number;
  timestamp?: number;
  errorMessage?: string;
  receipt?: {
    gasUsed?: string;
    status?: string;
    contractAddress?: string | null;
    logsCount?: number;
  };
}

export class TatumRpcClient {
  private explicitApiKey?: string;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  private getApiKey(): string {
    return (this.explicitApiKey ?? process.env.TATUM_API_KEY ?? "").trim();
  }

  hasConfiguredApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Generic JSON-RPC call dispatcher targeting Tatum Gateway with automatic retry on 429 burst throttling
   */
  async rpcCall(networkSlug: string, method: string, params: any[] = []): Promise<any> {
    const network = SUPPORTED_NETWORKS[networkSlug] || SUPPORTED_NETWORKS["base-mainnet"];
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const apiKey = this.getApiKey();
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    const startTime = Date.now();
    let response = await fetch(network.gatewayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    // If unauthenticated Tatum public gateway rate-limits burst parallel calls (429), fallback to chain RPC
    if (response.status === 429 && network.fallbackRpcUrl) {
      response = await fetch(network.fallbackRpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Tatum RPC HTTP error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Tatum RPC Error [${data.error.code}]: ${data.error.message}`);
    }

    return { result: data.result, latencyMs };
  }

  /**
   * Get latest block number from Tatum RPC
   */
  async getBlockNumber(networkSlug: string): Promise<{ blockNumber: number; latencyMs: number }> {
    const { result, latencyMs } = await this.rpcCall(networkSlug, "eth_blockNumber");
    return {
      blockNumber: parseInt(result, 16),
      latencyMs,
    };
  }

  /**
   * Get account balance in native currency (wei converted to human-readable)
   */
  async getBalance(address: string, networkSlug: string): Promise<string> {
    const { result } = await this.rpcCall(networkSlug, "eth_getBalance", [address, "latest"]);
    const wei = BigInt(result);
    const ethWhole = wei / BigInt(10 ** 18);
    const ethRemainder = wei % BigInt(10 ** 18);
    const formattedDecimals = ethRemainder.toString().padStart(18, "0").slice(0, 6);
    return `${ethWhole}.${formattedDecimals}`;
  }

  /**
   * Verify an on-chain transaction receipt through Tatum RPC
   * Validates:
   * 1. Transaction receipt exists on the designated network
   * 2. Transaction status was successful (0x1) vs reverted (0x0)
   * 3. Calculates actual block confirmation depth and enforces `minConfirmations`
   * 4. Matches sender and recipient addresses (including ERC-20 Transfer logs if applicable)
   * 5. Matches exact expected amount
   */
  async verifyTransaction(
    txHash: string,
    networkSlug: string,
    expected?: {
      from?: string;
      to?: string;
      allowedRecipients?: string[];
      expectedValueEth?: string;
      asset?: string;
      minConfirmations?: number;
    }
  ): Promise<VerificationResult> {
    const cleanHash = (txHash || "").trim();
    const network = SUPPORTED_NETWORKS[networkSlug] || SUPPORTED_NETWORKS["base-mainnet"];
    const requiredConfirmations = Math.max(1, expected?.minConfirmations || 1);

    if (!cleanHash.startsWith("0x") || cleanHash.length !== 66 || !/^0x[0-9a-fA-F]{64}$/.test(cleanHash)) {
      return {
        verified: false,
        status: "not_found",
        confirmations: 0,
        requiredConfirmations,
        txHash: cleanHash,
        network: networkSlug,
        chainId: network.chainId,
        errorMessage:
          "Invalid transaction hash format. Expected 66-character hexadecimal string starting with 0x.",
      };
    }

    try {
      const [txData, receiptData, blockData] = await Promise.all([
        this.rpcCall(networkSlug, "eth_getTransactionByHash", [cleanHash]),
        this.rpcCall(networkSlug, "eth_getTransactionReceipt", [cleanHash]),
        this.rpcCall(networkSlug, "eth_blockNumber", []),
      ]);

      const tx = txData.result;
      const receipt = receiptData.result;
      const currentBlock = parseInt(blockData.result, 16);

      if (!tx && !receipt) {
        return {
          verified: false,
          status: "not_found",
          confirmations: 0,
          requiredConfirmations,
          txHash: cleanHash,
          network: networkSlug,
          chainId: network.chainId,
          errorMessage: `Transaction ${cleanHash} was not found on ${network.name} (${networkSlug}). Verify the hash and selected blockchain network.`,
        };
      }

      if (tx && !receipt) {
        return {
          verified: false,
          status: "pending",
          confirmations: 0,
          requiredConfirmations,
          txHash: cleanHash,
          from: tx.from,
          to: tx.to,
          network: networkSlug,
          chainId: network.chainId,
          errorMessage:
            "Transaction is currently pending in the mempool and has not been mined yet.",
        };
      }

      const isSuccess = receipt.status === "0x1" || receipt.status === 1;
      const txBlock = parseInt(receipt.blockNumber, 16);
      const confirmations = Math.max(1, currentBlock - txBlock + 1);

      if (!isSuccess) {
        return {
          verified: false,
          status: "reverted",
          confirmations,
          requiredConfirmations,
          blockNumber: txBlock,
          txHash: cleanHash,
          from: receipt.from,
          to: receipt.to,
          network: networkSlug,
          chainId: network.chainId,
          errorMessage: "Transaction reverted on-chain (status 0x0). Funds were not transferred.",
        };
      }

      const assetSymbol = (expected?.asset || network.nativeCurrency).toUpperCase();
      const isStablecoin = assetSymbol === "USDC" || assetSymbol === "USDT";
      const tokenDecimals = isStablecoin ? 6 : 18;

      let effectiveFrom: string = receipt.from || tx?.from || "";
      let effectiveTo: string = receipt.to || tx?.to || "";
      let txValueWei = tx && tx.value ? BigInt(tx.value) : BigInt(0);
      let valueFormatted = weiToDecimal(txValueWei, 18);

      // Decode ERC-20 Transfer(address,address,uint256) event log when native value is 0 or asset is ERC-20
      if ((txValueWei === BigInt(0) || isStablecoin) && Array.isArray(receipt.logs)) {
        const transferLog = receipt.logs.find(
          (log: any) =>
            Array.isArray(log.topics) &&
            log.topics.length >= 3 &&
            String(log.topics[0]).toLowerCase() === ERC20_TRANSFER_TOPIC
        );
        if (transferLog) {
          effectiveFrom = `0x${String(transferLog.topics[1]).slice(-40)}`;
          effectiveTo = `0x${String(transferLog.topics[2]).slice(-40)}`;
          if (transferLog.data && transferLog.data !== "0x") {
            txValueWei = BigInt(transferLog.data);
            valueFormatted = weiToDecimal(txValueWei, tokenDecimals);
          }
        }
      }

      // Sender check if provided
      if (
        expected?.from &&
        effectiveFrom &&
        effectiveFrom.toLowerCase() !== expected.from.toLowerCase()
      ) {
        return {
          verified: false,
          status: "mismatch",
          confirmations,
          requiredConfirmations,
          blockNumber: txBlock,
          txHash: cleanHash,
          from: effectiveFrom,
          to: effectiveTo,
          valueEth: valueFormatted,
          asset: assetSymbol,
          network: networkSlug,
          chainId: network.chainId,
          errorMessage: `Sender mismatch: expected buyer ${expected.from}, but transaction was sent from ${effectiveFrom}.`,
        };
      }

      // Recipient check (supports single `to` or `allowedRecipients` list such as [escrowAddress, seller])
      const allowedList = [
        ...(expected?.allowedRecipients || []),
        ...(expected?.to ? [expected.to] : []),
      ]
        .filter(Boolean)
        .map((a) => a.toLowerCase());

      if (
        allowedList.length > 0 &&
        effectiveTo &&
        !allowedList.includes(effectiveTo.toLowerCase())
      ) {
        return {
          verified: false,
          status: "mismatch",
          confirmations,
          requiredConfirmations,
          blockNumber: txBlock,
          txHash: cleanHash,
          from: effectiveFrom,
          to: effectiveTo,
          valueEth: valueFormatted,
          asset: assetSymbol,
          network: networkSlug,
          chainId: network.chainId,
          errorMessage: `Recipient mismatch: transaction recipient ${effectiveTo} does not match trade escrow or seller address (${allowedList.join(" or ")}).`,
        };
      }

      // Value check: the transfer must cover the agreed amount
      if (expected?.expectedValueEth) {
        const expectedWei = decimalToWei(expected.expectedValueEth, tokenDecimals);
        if (expectedWei !== null && txValueWei < expectedWei) {
          return {
            verified: false,
            status: "mismatch",
            confirmations,
            requiredConfirmations,
            blockNumber: txBlock,
            txHash: cleanHash,
            from: effectiveFrom,
            to: effectiveTo,
            valueEth: valueFormatted,
            asset: assetSymbol,
            network: networkSlug,
            chainId: network.chainId,
            errorMessage: `Amount mismatch: the transaction transferred ${valueFormatted} ${assetSymbol}, but the agreement requires ${expected.expectedValueEth} ${assetSymbol}.`,
          };
        }
      }

      // Confirmation depth check
      if (confirmations < requiredConfirmations) {
        return {
          verified: false,
          status: "pending",
          confirmations,
          requiredConfirmations,
          blockNumber: txBlock,
          txHash: cleanHash,
          from: effectiveFrom,
          to: effectiveTo,
          valueEth: valueFormatted,
          asset: assetSymbol,
          network: networkSlug,
          chainId: network.chainId,
          errorMessage: `Insufficient confirmation depth: transaction has ${confirmations} confirmation(s), but ${requiredConfirmations} confirmation(s) are required.`,
        };
      }

      return {
        verified: true,
        status: "confirmed",
        confirmations,
        requiredConfirmations,
        blockNumber: txBlock,
        txHash: cleanHash,
        from: effectiveFrom,
        to: effectiveTo,
        valueEth: valueFormatted,
        asset: assetSymbol,
        network: networkSlug,
        chainId: network.chainId,
        timestamp: Date.now(),
        receipt: {
          gasUsed: parseInt(receipt.gasUsed, 16).toString(),
          status: receipt.status,
          contractAddress: receipt.contractAddress,
          logsCount: Array.isArray(receipt.logs) ? receipt.logs.length : 0,
        },
      };
    } catch (err: any) {
      return {
        verified: false,
        status: "not_found",
        confirmations: 0,
        requiredConfirmations,
        txHash: cleanHash,
        network: networkSlug,
        chainId: network.chainId,
        errorMessage: `Tatum RPC verification error: ${err.message}`,
      };
    }
  }

  /**
   * Health and diagnostic ping for Tatum Gateway
   */
  async diagnose(networkSlug: string = "base-mainnet"): Promise<{
    network: NetworkConfig;
    blockNumber: number;
    latencyMs: number;
    status: "healthy" | "degraded" | "offline";
    apiKeyConfigured: boolean;
    timestamp: string;
  }> {
    const network = SUPPORTED_NETWORKS[networkSlug] || SUPPORTED_NETWORKS["base-mainnet"];
    try {
      const { blockNumber, latencyMs } = await this.getBlockNumber(network.slug);
      return {
        network,
        blockNumber,
        latencyMs,
        status: latencyMs < 1500 ? "healthy" : "degraded",
        apiKeyConfigured: this.hasConfiguredApiKey(),
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        network,
        blockNumber: 0,
        latencyMs: -1,
        status: "offline",
        apiKeyConfigured: this.hasConfiguredApiKey(),
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const tatum = new TatumRpcClient();
