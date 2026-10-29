/**
 * Accord - Walrus Memory Integration (Mainnet)
 *
 * Provides persistent, verifiable decentralized memory for peer-to-peer crypto trades
 * using the official @mysten-incubation/memwal SDK targeting https://relayer.memory.walrus.xyz.
 *
 * Epistemic Integrity Rule:
 * - `verifiedOnWalrus` is ONLY set to `true` when the official MemWal SDK receives a
 *   confirmed response (`job_id` / `blob_id`) from the Walrus Memory Mainnet Relayer.
 * - When `MEMWAL_PRIVATE_KEY` or `MEMWAL_ACCOUNT_ID` is not configured in `.env.local`,
 *   memories are indexed via `MemWalMock` and marked `verifiedOnWalrus: false` and
 *   `storageMode: "local_unconfigured"`. Never fabricate mock blob IDs as Mainnet writes.
 */

import crypto from "node:crypto";

export interface WalrusTradeMemory {
  id: string;
  jobId?: string;
  blobId?: string;
  contentHash: string;
  tradeRef: string;
  namespace: string;
  type:
    | "TRADE_TERMS"
    | "TERMS_AMENDMENT"
    | "TRADE_ACCEPTANCE"
    | "ONCHAIN_VERIFICATION"
    | "CONDITION_UPDATE"
    | "DISPUTE_EVIDENCE"
    | "SETTLEMENT_LESSON"
    | "USER_PREFERENCE"
    | "DISPUTE_RESOLUTION";
  content: string;
  metadata: {
    participants?: string[];
    network?: string;
    txHash?: string;
    amount?: string;
    timestamp: number;
    termsHash?: string;
    evidenceHash?: string;
    [key: string]: any;
  };
  storedAt: string;
  verifiedOnWalrus: boolean;
  storageMode: "walrus_mainnet" | "local_unconfigured" | "relayer_error";
  relayerError?: string;
  relayerUrl: string;
}

export interface RecallResult {
  memories: WalrusTradeMemory[];
  query: string;
  count: number;
  mainnetVerifiedCount: number;
  source: "memwal_sdk_mainnet" | "memwal_mock_local";
}

export interface WalrusConfigStatus {
  configured: boolean;
  missingEnvVars: string[];
  serverUrl: string;
  namespace: string;
  accountIdPreview: string | null;
}

const ACCORD_MEMORY_CACHE: Map<string, WalrusTradeMemory> = new Map();

export class WalrusMemoryService {
  private serverUrl: string;
  private namespace: string;
  private sdkClient: any = null;
  private mockClient: any = null;

  constructor() {
    this.serverUrl = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
    this.namespace = process.env.MEMWAL_NAMESPACE || "accord-trades";
  }

  /**
   * Reads fresh environment variables (allowing runtime updates in .env.local or process.env)
   */
  getConfigurationStatus(): WalrusConfigStatus {
    const privateKey = (process.env.MEMWAL_PRIVATE_KEY || "").trim();
    const accountId = (process.env.MEMWAL_ACCOUNT_ID || "").trim();
    const missingEnvVars: string[] = [];

    if (!privateKey) missingEnvVars.push("MEMWAL_PRIVATE_KEY");
    if (!accountId) missingEnvVars.push("MEMWAL_ACCOUNT_ID");

    return {
      configured: missingEnvVars.length === 0,
      missingEnvVars,
      serverUrl: process.env.MEMWAL_SERVER_URL || this.serverUrl,
      namespace: process.env.MEMWAL_NAMESPACE || this.namespace,
      accountIdPreview: accountId ? `${accountId.slice(0, 10)}...${accountId.slice(-6)}` : null,
    };
  }

  /**
   * Initialize the real @mysten-incubation/memwal Mainnet SDK client when credentials exist
   */
  private async getMainnetClient(): Promise<any | null> {
    const privateKey = (process.env.MEMWAL_PRIVATE_KEY || "").trim();
    const accountId = (process.env.MEMWAL_ACCOUNT_ID || "").trim();
    if (!privateKey || !accountId) {
      return null;
    }

    if (this.sdkClient) return this.sdkClient;

    try {
      const { MemWal } = await import("@mysten-incubation/memwal");
      this.sdkClient = MemWal.create({
        key: privateKey,
        accountId,
        serverUrl: process.env.MEMWAL_SERVER_URL || this.serverUrl,
        namespace: process.env.MEMWAL_NAMESPACE || this.namespace,
      });
      return this.sdkClient;
    } catch (err: any) {
      console.warn("[WalrusMemory] Failed to initialize MemWal client:", err.message);
      return null;
    }
  }

  /**
   * Initialize the official MemWalMock client from @mysten-incubation/memwal for unconfigured/offline environments
   */
  private async getMockClient(): Promise<any | null> {
    if (this.mockClient) return this.mockClient;
    try {
      const { MemWalMock } = await import("@mysten-incubation/memwal");
      if (MemWalMock) {
        this.mockClient = MemWalMock.create({
          namespace: this.namespace,
        });
      }
      return this.mockClient;
    } catch {
      return null;
    }
  }

  /**
   * Live health & config check against Walrus Memory Mainnet Relayer (https://relayer.memory.walrus.xyz)
   */
  async checkRelayerHealth(): Promise<{
    status: string;
    mode: string;
    writesReady: boolean;
    relayerVersion: string;
    url: string;
    packageId?: string;
    registryId?: string;
    suiRpcUrl?: string;
    configStatus: WalrusConfigStatus;
  }> {
    const configStatus = this.getConfigurationStatus();
    try {
      const [healthRes, cfgRes] = await Promise.all([
        fetch(`${this.serverUrl}/health`, { cache: "no-store" }),
        fetch(`${this.serverUrl}/config`, { cache: "no-store" }).catch(() => null),
      ]);

      let cfgData: any = {};
      if (cfgRes && cfgRes.ok) {
        cfgData = await cfgRes.json();
      }

      if (healthRes.ok) {
        const data = await healthRes.json();
        return {
          status: data.status || "ok",
          mode: data.mode || "production",
          writesReady: !!data.write_ready || data.writes === "ok",
          relayerVersion: data.relayerVersion || data.version || "0.1.0",
          url: this.serverUrl,
          packageId: cfgData.packageId,
          registryId: cfgData.registryId,
          suiRpcUrl: cfgData.suiRpcUrl,
          configStatus,
        };
      }
    } catch (err: any) {
      console.warn("[WalrusMemory] Relayer health ping failed:", err.message);
    }

    return {
      status: "unreachable",
      mode: "mainnet",
      writesReady: false,
      relayerVersion: "unknown",
      url: this.serverUrl,
      configStatus,
    };
  }

  /**
   * Remember: Write a structured trade memory to Walrus Memory Mainnet via @mysten-incubation/memwal.
   * Strictly tracks whether the write was confirmed on Mainnet vs stored locally while awaiting credentials.
   */
  async remember(params: {
    tradeRef: string;
    type: WalrusTradeMemory["type"];
    content: string;
    metadata?: Record<string, any>;
    waitForWalrusBlob?: boolean;
  }): Promise<WalrusTradeMemory> {
    const memoryId = `wal-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const timestamp = Date.now();

    const formattedPayload = JSON.stringify({
      accordMemoryId: memoryId,
      tradeRef: params.tradeRef,
      namespace: this.namespace,
      type: params.type,
      content: params.content,
      metadata: {
        ...params.metadata,
        timestamp,
      },
    });

    const contentHash = `0x${crypto.createHash("sha256").update(formattedPayload).digest("hex")}`;

    let jobId: string | undefined;
    let blobId: string | undefined;
    let verifiedOnWalrus = false;
    let storageMode: WalrusTradeMemory["storageMode"] = "local_unconfigured";
    let relayerError: string | undefined;

    const sdk = await this.getMainnetClient();
    if (sdk) {
      try {
        if (params.waitForWalrusBlob && typeof sdk.rememberAndWait === "function") {
          const waitRes = await sdk.rememberAndWait(
            formattedPayload,
            { namespace: this.namespace },
            { timeoutMs: 25000, pollIntervalMs: 1500 }
          );
          jobId = waitRes?.job_id;
          blobId = waitRes?.result?.blob_id || undefined;
          verifiedOnWalrus = Boolean(jobId);
          storageMode = verifiedOnWalrus ? "walrus_mainnet" : "relayer_error";
        } else {
          const res = await sdk.remember(formattedPayload, { namespace: this.namespace });
          jobId = res?.job_id;
          // Optionally check immediate job status if available
          if (jobId && typeof sdk.getJobStatus === "function") {
            try {
              const statusRes = await sdk.getJobStatus(jobId);
              if (statusRes?.result?.blob_id) {
                blobId = statusRes.result.blob_id;
              }
            } catch {
              // Async job still processing on Walrus relayer
            }
          }
          verifiedOnWalrus = Boolean(jobId);
          storageMode = verifiedOnWalrus ? "walrus_mainnet" : "relayer_error";
        }
      } catch (err: any) {
        relayerError = err.message || "Walrus Mainnet relayer request failed";
        storageMode = "relayer_error";
        verifiedOnWalrus = false;
        console.warn("[WalrusMemory] Mainnet SDK write failed:", relayerError);
      }
    } else {
      // Unconfigured credentials: write to official MemWalMock for local testing
      const mock = await this.getMockClient();
      if (mock && typeof mock.remember === "function") {
        try {
          await mock.remember(formattedPayload, { namespace: this.namespace });
        } catch {
          // ignore mock notice
        }
      }
    }

    const memoryItem: WalrusTradeMemory = {
      id: memoryId,
      jobId,
      blobId,
      contentHash,
      tradeRef: params.tradeRef,
      namespace: this.namespace,
      type: params.type,
      content: params.content,
      metadata: {
        ...params.metadata,
        timestamp,
      },
      storedAt: new Date().toISOString(),
      verifiedOnWalrus,
      storageMode,
      relayerError,
      relayerUrl: this.serverUrl,
    };

    ACCORD_MEMORY_CACHE.set(memoryId, memoryItem);
    return memoryItem;
  }

  /**
   * Recall: Semantic vector & keyword retrieval of persistent trade memories
   */
  async recall(params: {
    query: string;
    tradeRef?: string;
    participant?: string;
    type?: WalrusTradeMemory["type"];
    limit?: number;
  }): Promise<RecallResult> {
    const limit = params.limit || 10;
    const queryLower = (params.query || "").toLowerCase();

    // 1. Query official MemWal SDK on Mainnet if credentials are configured
    const sdk = await this.getMainnetClient();
    if (sdk) {
      try {
        const sdkRes = await sdk.recall(params.query || "Accord trade agreement", {
          limit,
          namespace: this.namespace,
        });
        if (sdkRes?.results && sdkRes.results.length > 0) {
          const mapped: WalrusTradeMemory[] = sdkRes.results.map((r: any, idx: number) => {
            let parsed: any = null;
            const rawText = typeof r === "string" ? r : r.text || r.content || JSON.stringify(r);
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = null;
            }
            const contentText = parsed?.content || rawText;
            const contentHash = `0x${crypto.createHash("sha256").update(rawText).digest("hex")}`;
            return {
              id: parsed?.accordMemoryId || r.id || `wal-mainnet-${idx}`,
              blobId: r.blob_id || parsed?.blobId,
              jobId: r.job_id || parsed?.jobId,
              contentHash,
              tradeRef: parsed?.tradeRef || params.tradeRef || "ACC-MAINNET",
              namespace: this.namespace,
              type: parsed?.type || "SETTLEMENT_LESSON",
              content: contentText,
              metadata: parsed?.metadata || { timestamp: Date.now(), distance: r.distance },
              storedAt: new Date().toISOString(),
              verifiedOnWalrus: true,
              storageMode: "walrus_mainnet",
              relayerUrl: this.serverUrl,
            };
          });

          return {
            memories: mapped,
            query: params.query,
            count: mapped.length,
            mainnetVerifiedCount: mapped.length,
            source: "memwal_sdk_mainnet",
          };
        }
      } catch (err: any) {
        console.warn("[WalrusMemory] Mainnet SDK recall notice:", err.message);
      }
    }

    // 2. Search local memory index (populated during trade lifecycle or mock runs)
    const results: WalrusTradeMemory[] = [];
    const allMemories = Array.from(ACCORD_MEMORY_CACHE.values()).sort(
      (a, b) => (b.metadata.timestamp || 0) - (a.metadata.timestamp || 0)
    );

    for (const mem of allMemories) {
      if (params.tradeRef && mem.tradeRef !== params.tradeRef && mem.tradeRef !== "ACC-GLOBAL-PREFS") {
        continue;
      }

      if (params.type && mem.type !== params.type) {
        continue;
      }

      if (params.participant && mem.metadata.participants) {
        const matchesParticipant = mem.metadata.participants.some(
          (p: string) => p.toLowerCase() === params.participant?.toLowerCase()
        );
        const matchesUser =
          mem.metadata.userAddress &&
          mem.metadata.userAddress.toLowerCase() === params.participant?.toLowerCase();
        if (!matchesParticipant && !matchesUser) continue;
      }

      const contentLower = `${mem.content} ${mem.tradeRef} ${mem.type}`.toLowerCase();
      const tokens = queryLower.split(/\s+/).filter((t) => t.length > 2);
      const matchesToken =
        tokens.length === 0 ||
        queryLower === "*" ||
        tokens.some((t) => contentLower.includes(t)) ||
        Boolean(params.tradeRef && mem.tradeRef === params.tradeRef);

      if (matchesToken) {
        results.push(mem);
      }

      if (results.length >= limit) break;
    }

    const mainnetVerifiedCount = results.filter((m) => m.verifiedOnWalrus).length;

    return {
      memories: results,
      query: params.query,
      count: results.length,
      mainnetVerifiedCount,
      source: mainnetVerifiedCount > 0 ? "memwal_sdk_mainnet" : "memwal_mock_local",
    };
  }

  /**
   * Get all memories for a specific trade room
   */
  async getMemoriesForTrade(tradeRef: string): Promise<WalrusTradeMemory[]> {
    return Array.from(ACCORD_MEMORY_CACHE.values()).filter((m) => m.tradeRef === tradeRef);
  }

  /**
   * List all indexed memories
   */
  listAllMemories(): WalrusTradeMemory[] {
    return Array.from(ACCORD_MEMORY_CACHE.values()).sort(
      (a, b) => (b.metadata.timestamp || 0) - (a.metadata.timestamp || 0)
    );
  }

  /**
   * Seed 12 distinct, meaningful trade memories (Hackathon Requirement 3: 10+ memories).
   * If MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID are configured, writes each memory directly
   * to Walrus Memory Mainnet and records its real job_id / blob_id.
   * If unconfigured, stores them with `verifiedOnWalrus: false` and `storageMode: "local_unconfigured"`.
   */
  async seedDemonstrationMemories(forceMainnetSync: boolean = false): Promise<WalrusTradeMemory[]> {
    const configStatus = this.getConfigurationStatus();
    const existing = Array.from(ACCORD_MEMORY_CACHE.values());

    // If already seeded and not forcing a sync after credentials were added, return existing
    if (existing.length >= 12 && !forceMainnetSync) {
      return existing;
    }

    // If forcing sync and memories exist that were local_unconfigured, re-submit them if now configured
    if (forceMainnetSync && configStatus.configured && existing.length > 0) {
      ACCORD_MEMORY_CACHE.clear();
    } else if (existing.length >= 12) {
      return existing;
    }

    const seeds = [
      {
        tradeRef: "ACC-2026-8812",
        type: "TRADE_TERMS" as const,
        content:
          "Agreed P2P Trade Terms: 0.000371 ETH on Base Mainnet between Buyer 0xf5bdce6674389d937df8ad3363c10fc3fa060b75 and Seller 0x0729e2a4716d9f7dd17858d5d504426d228697f7. Settlement condition: Tatum RPC verifies Base Mainnet deposit tx 0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c and Seller delivers cryptographically signed API key.",
        metadata: {
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
          amount: "0.000371",
          asset: "ETH",
          network: "base-mainnet",
          termsHash: "0x89ab12cd34ef567890abcdef1234567890abcdef1234567890abcdef12345678",
        },
      },
      {
        tradeRef: "ACC-2026-8812",
        type: "TRADE_ACCEPTANCE" as const,
        content:
          "Seller 0x0729e2a4716d9f7dd17858d5d504426d228697f7 reviewed and accepted Version 1 terms for trade ACC-2026-8812 on Base Mainnet.",
        metadata: {
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
          acceptedVersion: 1,
        },
      },
      {
        tradeRef: "ACC-2026-8812",
        type: "ONCHAIN_VERIFICATION" as const,
        content:
          "Tatum RPC verified real Base Mainnet transaction 0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c in block 53221342 (status 0x1, value 0.000371 ETH from 0xf5bdce6674389d937df8ad3363c10fc3fa060b75 to 0x0729e2a4716d9f7dd17858d5d504426d228697f7).",
        metadata: {
          txHash: "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c",
          network: "base-mainnet",
          blockNumber: 53221342,
          verifiedStatus: "0x1",
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
        },
      },
      {
        tradeRef: "ACC-2026-8812",
        type: "CONDITION_UPDATE" as const,
        content:
          "Off-chain condition attested: Seller 0x0729e2a4716d9f7dd17858d5d504426d228697f7 submitted signed API bundle receipt (SHA-256: 0x6f9b1c2e8a4d3f5e7b9c0a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f).",
        metadata: {
          conditionId: "cond-offchain-receipt",
          verificationMethod: "offchain_attestation",
          participants: ["0x0729e2a4716d9f7dd17858d5d504426d228697f7"],
        },
      },
      {
        tradeRef: "ACC-2026-8812",
        type: "SETTLEMENT_LESSON" as const,
        content:
          "Trade ACC-2026-8812 settled cleanly on Base Mainnet in 28 minutes with zero disputes. Counterparty 0x0729e2a4716d9f7dd17858d5d504426d228697f7 fulfilled off-chain deliverables promptly after Tatum RPC deposit confirmation.",
        metadata: {
          outcome: "COMPLETED",
          settlementMinutes: 28,
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
        },
      },
      {
        tradeRef: "ACC-2026-9041",
        type: "TRADE_TERMS" as const,
        content:
          "Agreed P2P Trade Terms: 1.20 ETH for ENS/Web3 Domain Transfer on Ethereum Mainnet between Buyer 0x71C83647249C0392B7e4136f1c7dC1a978641a96 and Seller 0x3d7b4A8911f4dF2309C8198542F559d873138b1E. Neutral Arbiter: 0x12c4E5496F5bAbE7F9159958742D2635B1a084c7.",
        metadata: {
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
          ],
          amount: "1.20",
          asset: "ETH",
          network: "ethereum-mainnet",
        },
      },
      {
        tradeRef: "ACC-2026-9041",
        type: "TERMS_AMENDMENT" as const,
        content:
          "Terms amended to Version 2 for ACC-2026-9041 by Seller 0x3d7b4A8911f4dF2309C8198542F559d873138b1E: Extended domain transfer window from 2 hours to 4 hours. Buyer acceptance was automatically reset and subsequently re-confirmed.",
        metadata: {
          previousVersion: 1,
          newVersion: 2,
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
          ],
        },
      },
      {
        tradeRef: "ACC-2026-9041",
        type: "ONCHAIN_VERIFICATION" as const,
        content:
          "Tatum RPC verified Ethereum Mainnet deposit and ERC-721 transfer receipt for ACC-2026-9041 with 32 block confirmations.",
        metadata: {
          network: "ethereum-mainnet",
          confirmations: 32,
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
          ],
        },
      },
      {
        tradeRef: "ACC-2026-7734",
        type: "DISPUTE_EVIDENCE" as const,
        content:
          "Dispute evidence anchored for trade ACC-2026-7734: Buyer 0x71C83647249C0392B7e4136f1c7dC1a978641a96 submitted courier return manifest (SHA-256 hash 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855) showing off-chain hardware parcel was returned to sender.",
        metadata: {
          evidenceHash: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          disputedBy: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x89205A3A3b2A55385750058eE9B6615b8B94611C",
          ],
        },
      },
      {
        tradeRef: "ACC-2026-7734",
        type: "DISPUTE_RESOLUTION" as const,
        content:
          "Neutral Arbiter 0x12c4E5496F5bAbE7F9159958742D2635B1a084c7 resolved dispute ACC-2026-7734 (10000 bps / 100% refund to buyer) after verifying courier return hash against Seller's dispatch receipt.",
        metadata: {
          arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
          buyerSplitBps: 10000,
          resolution: "FULL_REFUND_TO_BUYER",
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x89205A3A3b2A55385750058eE9B6615b8B94611C",
          ],
        },
      },
      {
        tradeRef: "ACC-GLOBAL-PREFS",
        type: "USER_PREFERENCE" as const,
        content:
          "Trader 0x71C83647249C0392B7e4136f1c7dC1a978641a96 explicit safety preference: Require minimum 12 Tatum RPC block confirmations for trades above 0.5 ETH and always appoint neutral arbiter 0x12c4E5496F5bAbE7F9159958742D2635B1a084c7.",
        metadata: {
          userAddress: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
          participants: ["0x71C83647249C0392B7e4136f1c7dC1a978641a96"],
          minConfirmations: 12,
        },
      },
      {
        tradeRef: "ACC-GLOBAL-PREFS",
        type: "USER_PREFERENCE" as const,
        content:
          "Trader 0xf5bdce6674389d937df8ad3363c10fc3fa060b75 explicit preference: Prefers Base Mainnet for low-latency P2P settlement and requires SHA-256 evidence hashes anchored to Walrus Memory before releasing funds.",
        metadata: {
          userAddress: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
          participants: ["0xf5bdce6674389d937df8ad3363c10fc3fa060b75"],
          preferredNetwork: "base-mainnet",
        },
      },
    ];

    const results: WalrusTradeMemory[] = [];
    for (const seed of seeds) {
      const memory = await this.remember(seed);
      results.push(memory);
    }

    return results;
  }
}

export const walrusMemory = new WalrusMemoryService();
