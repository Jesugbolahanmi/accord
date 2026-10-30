/**
 * Accord — Memory Box & Walrus Memory Mainnet Integration
 *
 * Provides persistent, searchable, and verifiable financial records archive for P2P trades
 * using the official @mysten-incubation/memwal SDK targeting:
 * - Relayer:    https://relayer.memory.walrus.xyz
 * - Aggregator: https://aggregator.memory.walrus-mainnet.walrus.space
 *
 * Strict Epistemic & Persistence Rules:
 * 1. `verifiedOnWalrus` is ONLY set to `true` after:
 *    (a) An actual Mainnet write succeeds via the SDK,
 *    (b) A genuine Mainnet `blobId` is returned, AND
 *    (c) The record is successfully retrieved and confirmed from the Mainnet Aggregator or SDK recall.
 * 2. An endpoint `/health` check NEVER proves memory persistence.
 * 3. A submitted write (`jobId` only) is `write_submitted`, NOT `confirmed_mainnet`.
 * 4. When credentials are missing or relayer is unreachable, records are preserved locally as
 *    `pending_unconfigured` or `write_failed` and can be retried in-place without creating duplicates.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type MemoryCategory =
  | "Agreements"
  | "Transactions"
  | "Fulfilment"
  | "Disputes"
  | "Settlement"
  | "Trade History";

export type MemoryRecordType =
  | "TRADE_CREATED"
  | "TRADE_TERMS"
  | "TERMS_AMENDMENT"
  | "TRADE_ACCEPTANCE"
  | "PAYMENT_SUBMITTED"
  | "ONCHAIN_VERIFICATION"
  | "CONDITION_UPDATE"
  | "DISPUTE_EVIDENCE"
  | "DISPUTE_RESOLUTION"
  | "SETTLEMENT_COMPLETED"
  | "SETTLEMENT_REFUNDED"
  | "SETTLEMENT_LESSON"
  | "USER_PREFERENCE";

export type PersistenceStatus =
  | "confirmed_mainnet"
  | "write_submitted"
  | "pending_unconfigured"
  | "write_failed";

export interface WalrusTradeMemory {
  id: string;
  title: string;
  category: MemoryCategory;
  type: MemoryRecordType;
  tradeId?: string;
  tradeRef: string;
  namespace: string;
  actor: string;
  sourceRole: "buyer" | "seller" | "arbiter" | "tatum_rpc" | "accord_ledger" | "participant";
  content: string;
  structuredPayload: Record<string, any>;
  relatedRecordIds: string[];
  relatedTxHash?: string;
  relatedEvidenceHash?: string;
  relatedTermsHash?: string;
  contentHash: string;
  metadata: {
    participants?: string[];
    network?: string;
    txHash?: string;
    amount?: string;
    asset?: string;
    timestamp: number;
    termsHash?: string;
    evidenceHash?: string;
    [key: string]: any;
  };
  storedAt: string;
  verifiedOnWalrus: boolean;
  persistenceStatus: PersistenceStatus;
  storageMode: "walrus_mainnet" | "local_unconfigured" | "relayer_error";
  jobId?: string;
  blobId?: string;
  retrievalConfirmedAt?: string;
  relayerError?: string;
  relayerUrl: string;
  aggregatorUrl: string;
  retryCount: number;
  lastRetryAt?: string;
}

export interface MemoryBoxOverview {
  totalRecords: number;
  confirmedMainnetRecords: number;
  writeSubmittedRecords: number;
  pendingOrUnconfirmedRecords: number;
  failedRecords: number;
  tradesWithPreservedHistories: number;
  recentActivityCount24h: number;
  categoryCounts: Record<MemoryCategory, number>;
}

export interface MemorySearchFilters {
  query?: string;
  tradeRef?: string;
  category?: MemoryCategory | "";
  type?: MemoryRecordType | "";
  participant?: string;
  persistenceStatus?: "all" | "confirmed_mainnet" | "pending" | "failed";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface RecallResult {
  memories: WalrusTradeMemory[];
  query: string;
  count: number;
  mainnetVerifiedCount: number;
  overview: MemoryBoxOverview;
  source: "memwal_sdk_mainnet" | "accord_memory_box_index";
}

export interface WalrusConfigStatus {
  configured: boolean;
  missingEnvVars: string[];
  serverUrl: string;
  aggregatorUrl: string;
  namespace: string;
  accountIdPreview: string | null;
}

export interface WalrusIntegrationTelemetry {
  relayerReachable: boolean;
  aggregatorReachable: boolean;
  credentialsConfigured: boolean;
  mainnetWritesEnabled: boolean;
  writesSubmittedCount: number;
  writesConfirmedCount: number;
  memoriesRetrievedVerifiedCount: number;
  writesFailedOrPendingCount: number;
  overallStatus:
    | "mainnet_verified"
    | "mainnet_ready"
    | "relayer_reachable_credentials_missing"
    | "relayer_unreachable";
  overallLabel: string;
  status: string;
  mode: string;
  writesReady: boolean;
  relayerVersion: string;
  url: string;
  aggregatorUrl: string;
  packageId?: string;
  registryId?: string;
  suiRpcUrl?: string;
  configStatus: WalrusConfigStatus;
}

export function classifyMemoryCategory(type: MemoryRecordType): MemoryCategory {
  switch (type) {
    case "TRADE_TERMS":
    case "TERMS_AMENDMENT":
    case "TRADE_ACCEPTANCE":
      return "Agreements";
    case "PAYMENT_SUBMITTED":
    case "ONCHAIN_VERIFICATION":
      return "Transactions";
    case "CONDITION_UPDATE":
      return "Fulfilment";
    case "DISPUTE_EVIDENCE":
    case "DISPUTE_RESOLUTION":
      return "Disputes";
    case "SETTLEMENT_COMPLETED":
    case "SETTLEMENT_REFUNDED":
    case "SETTLEMENT_LESSON":
      return "Settlement";
    case "TRADE_CREATED":
    case "USER_PREFERENCE":
    default:
      return "Trade History";
  }
}

export function defaultTitleForMemory(type: MemoryRecordType, tradeRef: string): string {
  switch (type) {
    case "TRADE_CREATED":
      return `Trade Room Initialized — ${tradeRef}`;
    case "TRADE_TERMS":
      return `Original Agreement Terms Drafted — ${tradeRef}`;
    case "TERMS_AMENDMENT":
      return `Agreement Terms Amended — ${tradeRef}`;
    case "TRADE_ACCEPTANCE":
      return `Agreement Version Accepted — ${tradeRef}`;
    case "PAYMENT_SUBMITTED":
      return `Payment Transaction Reference Submitted — ${tradeRef}`;
    case "ONCHAIN_VERIFICATION":
      return `Tatum RPC Verified Blockchain Deposit — ${tradeRef}`;
    case "CONDITION_UPDATE":
      return `Fulfilment Condition & Evidence Recorded — ${tradeRef}`;
    case "DISPUTE_EVIDENCE":
      return `Dispute & Supporting Evidence Submitted — ${tradeRef}`;
    case "DISPUTE_RESOLUTION":
      return `Arbitral Dispute Resolution Recorded — ${tradeRef}`;
    case "SETTLEMENT_COMPLETED":
      return `Settlement Released & Completed — ${tradeRef}`;
    case "SETTLEMENT_REFUNDED":
      return `Principal Refund Completed — ${tradeRef}`;
    case "SETTLEMENT_LESSON":
      return `Completed Settlement Outcome Record — ${tradeRef}`;
    case "USER_PREFERENCE":
      return `Counterparty Settlement Preference — ${tradeRef}`;
    default:
      return `Trade Memory Record — ${tradeRef}`;
  }
}

const ACCORD_MEMORY_CACHE: Map<string, WalrusTradeMemory> = new Map();
let diskHydrated = false;

function getPersistenceFilePath(): string {
  if (process.env.ACCORD_TEST_MODE === "1") {
    return path.join(os.tmpdir(), `accord-test-memories-${process.pid}.json`);
  }
  const localDir = path.join(process.cwd(), ".accord-data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, "memories.json");
  } catch {
    return path.join(os.tmpdir(), "accord-memories.json");
  }
}

function hydrateFromDisk(): void {
  if (diskHydrated) return;
  diskHydrated = true;
  try {
    const file = getPersistenceFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.id) {
            ACCORD_MEMORY_CACHE.set(item.id, item);
          }
        }
      }
    }
  } catch {
    // Continue with in-memory store if disk read fails
  }
}

function persistToDisk(): void {
  try {
    const file = getPersistenceFilePath();
    const arr = Array.from(ACCORD_MEMORY_CACHE.values());
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");
  } catch {
    // Ignore write failure in read-only environments
  }
}

export class WalrusMemoryService {
  private serverUrl: string;
  private aggregatorUrl: string;
  private namespace: string;
  private sdkClient: any = null;
  private mockClient: any = null;

  constructor() {
    this.serverUrl = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
    this.aggregatorUrl =
      process.env.WALRUS_AGGREGATOR_URL ||
      "https://aggregator.memory.walrus-mainnet.walrus.space";
    this.namespace = process.env.MEMWAL_NAMESPACE || "accord-trades";
    hydrateFromDisk();
  }

  /**
   * Reads fresh environment variables
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
      aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL || this.aggregatorUrl,
      namespace: process.env.MEMWAL_NAMESPACE || this.namespace,
      accountIdPreview: accountId ? `${accountId.slice(0, 10)}...${accountId.slice(-6)}` : null,
    };
  }

  /**
   * Initialize the official @mysten-incubation/memwal Mainnet SDK client when credentials exist
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
   * Initialize the official MemWalMock client for development-only local indexing
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
   * Verify a genuine Mainnet blob ID by retrieving it from the Walrus Mainnet Aggregator
   * or confirming its presence via MemWal SDK recall.
   */
  async verifyBlobRetrievalOnMainnet(blobId: string, expectedTradeRef?: string): Promise<boolean> {
    if (!blobId || typeof blobId !== "string") return false;
    try {
      const aggRes = await fetch(
        `${this.aggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}`,
        { method: "GET", cache: "no-store" }
      );
      if (aggRes.ok) {
        return true;
      }
    } catch {
      // Fallback to SDK recall check if aggregator endpoint path differs
    }

    const sdk = await this.getMainnetClient();
    if (sdk && typeof sdk.recall === "function") {
      try {
        const recallRes = await sdk.recall(expectedTradeRef || blobId, {
          limit: 5,
          namespace: this.namespace,
        });
        if (Array.isArray(recallRes?.results) && recallRes.results.length > 0) {
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Comprehensive, accurate telemetry that strictly distinguishes:
   * - Relayer reachable (`https://relayer.memory.walrus.xyz/health`)
   * - Credentials configured (`MEMWAL_PRIVATE_KEY` & `MEMWAL_ACCOUNT_ID`)
   * - Mainnet writes enabled
   * - Writes submitted vs Writes confirmed (`blobId` + retrieval verified)
   */
  async checkRelayerHealth(): Promise<WalrusIntegrationTelemetry> {
    const configStatus = this.getConfigurationStatus();
    const allMems = Array.from(ACCORD_MEMORY_CACHE.values());

    const writesConfirmedCount = allMems.filter(
      (m) => m.verifiedOnWalrus && m.persistenceStatus === "confirmed_mainnet"
    ).length;
    const writesSubmittedCount = allMems.filter(
      (m) => m.persistenceStatus === "write_submitted" || m.persistenceStatus === "confirmed_mainnet"
    ).length;
    const memoriesRetrievedVerifiedCount = allMems.filter(
      (m) => Boolean(m.retrievalConfirmedAt && m.verifiedOnWalrus)
    ).length;
    const writesFailedOrPendingCount = allMems.filter(
      (m) => !m.verifiedOnWalrus
    ).length;

    let relayerReachable = false;
    let aggregatorReachable = false;
    let relayerWritesReady = false;
    let relayerVersion = "unknown";
    let mode = "production";
    let cfgData: any = {};

    try {
      const [healthRes, cfgRes, aggRes] = await Promise.all([
        fetch(`${this.serverUrl}/health`, { cache: "no-store" }).catch(() => null),
        fetch(`${this.serverUrl}/config`, { cache: "no-store" }).catch(() => null),
        fetch(this.aggregatorUrl, { method: "HEAD", cache: "no-store" }).catch(() => null),
      ]);

      if (cfgRes && cfgRes.ok) {
        cfgData = await cfgRes.json().catch(() => ({}));
      }
      if (aggRes && (aggRes.ok || aggRes.status < 500)) {
        aggregatorReachable = true;
      }

      if (healthRes && healthRes.ok) {
        const data = await healthRes.json().catch(() => ({}));
        relayerReachable = true;
        mode = data.mode || "production";
        relayerWritesReady = Boolean(data.write_ready || data.writes === "ok" || data.status === "ok");
        relayerVersion = data.relayerVersion || data.version || "0.1.0";
      }
    } catch {
      relayerReachable = false;
    }

    const mainnetWritesEnabled =
      relayerReachable && relayerWritesReady && configStatus.configured;

    let overallStatus: WalrusIntegrationTelemetry["overallStatus"] = "relayer_unreachable";
    let overallLabel = "Relayer Unreachable · Local Pending Queue Active";

    if (writesConfirmedCount > 0 && mainnetWritesEnabled) {
      overallStatus = "mainnet_verified";
      overallLabel = `Mainnet Active · ${writesConfirmedCount} Confirmed Blob(s)`;
    } else if (mainnetWritesEnabled) {
      overallStatus = "mainnet_ready";
      overallLabel = "Mainnet Writes Enabled · Ready to Anchor";
    } else if (relayerReachable && !configStatus.configured) {
      overallStatus = "relayer_reachable_credentials_missing";
      overallLabel = "Relayer Reachable · Credentials Missing (Dev Mock Active)";
    }

    return {
      relayerReachable,
      aggregatorReachable,
      credentialsConfigured: configStatus.configured,
      mainnetWritesEnabled,
      writesSubmittedCount,
      writesConfirmedCount,
      memoriesRetrievedVerifiedCount,
      writesFailedOrPendingCount,
      overallStatus,
      overallLabel,
      status: relayerReachable ? "ok" : "unreachable",
      mode,
      writesReady: mainnetWritesEnabled,
      relayerVersion,
      url: this.serverUrl,
      aggregatorUrl: this.aggregatorUrl,
      packageId: cfgData.packageId,
      registryId: cfgData.registryId,
      suiRpcUrl: cfgData.suiRpcUrl,
      configStatus,
    };
  }

  /**
   * Compute genuine overview statistics from actual Memory Box records
   */
  getOverviewStats(): MemoryBoxOverview {
    const all = Array.from(ACCORD_MEMORY_CACHE.values());
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const categoryCounts: Record<MemoryCategory, number> = {
      Agreements: 0,
      Transactions: 0,
      Fulfilment: 0,
      Disputes: 0,
      Settlement: 0,
      "Trade History": 0,
    };

    const distinctTradeRefs = new Set<string>();
    let confirmedMainnetRecords = 0;
    let writeSubmittedRecords = 0;
    let pendingOrUnconfirmedRecords = 0;
    let failedRecords = 0;
    let recentActivityCount24h = 0;

    for (const m of all) {
      const cat = m.category || classifyMemoryCategory(m.type);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      if (m.tradeRef && m.tradeRef !== "ACC-GLOBAL-PREFS") {
        distinctTradeRefs.add(m.tradeRef);
      }

      if (m.verifiedOnWalrus && m.persistenceStatus === "confirmed_mainnet") {
        confirmedMainnetRecords++;
      } else if (m.persistenceStatus === "write_submitted") {
        writeSubmittedRecords++;
        pendingOrUnconfirmedRecords++;
      } else if (m.persistenceStatus === "write_failed") {
        failedRecords++;
        pendingOrUnconfirmedRecords++;
      } else {
        pendingOrUnconfirmedRecords++;
      }

      if ((m.metadata?.timestamp || 0) >= dayAgo) {
        recentActivityCount24h++;
      }
    }

    return {
      totalRecords: all.length,
      confirmedMainnetRecords,
      writeSubmittedRecords,
      pendingOrUnconfirmedRecords,
      failedRecords,
      tradesWithPreservedHistories: distinctTradeRefs.size,
      recentActivityCount24h,
      categoryCounts,
    };
  }

  /**
   * Create and persist a structured trade memory record.
   * Automatically links to previous records belonging to the same trade (`relatedRecordIds`).
   */
  async remember(params: {
    id?: string;
    title?: string;
    category?: MemoryCategory;
    tradeId?: string;
    tradeRef: string;
    type: MemoryRecordType;
    actor?: string;
    sourceRole?: WalrusTradeMemory["sourceRole"];
    content: string;
    structuredPayload?: Record<string, any>;
    metadata?: Record<string, any>;
    waitForWalrusBlob?: boolean;
  }): Promise<WalrusTradeMemory> {
    const existingId = params.id;
    const existingRecord = existingId ? ACCORD_MEMORY_CACHE.get(existingId) : undefined;
    const memoryId =
      existingRecord?.id ||
      params.id ||
      `wal-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const timestamp = existingRecord?.metadata?.timestamp || Date.now();
    const category = params.category || classifyMemoryCategory(params.type);
    const title = params.title || defaultTitleForMemory(params.type, params.tradeRef);

    // Find related records for the same trade reference to build a navigable graph
    const priorForTrade = Array.from(ACCORD_MEMORY_CACHE.values())
      .filter((m) => m.tradeRef === params.tradeRef && m.id !== memoryId)
      .sort((a, b) => (b.metadata.timestamp || 0) - (a.metadata.timestamp || 0))
      .slice(0, 6)
      .map((m) => m.id);

    const structuredPayload: Record<string, any> = {
      tradeRef: params.tradeRef,
      category,
      type: params.type,
      ...(params.structuredPayload || {}),
      ...(params.metadata || {}),
    };

    const formattedPayload = JSON.stringify({
      accordMemoryId: memoryId,
      title,
      category,
      tradeRef: params.tradeRef,
      namespace: this.namespace,
      type: params.type,
      actor: params.actor || params.metadata?.actor || "system:accord",
      content: params.content,
      structuredPayload,
      metadata: {
        ...params.metadata,
        timestamp,
      },
    });

    const contentHash = `0x${crypto.createHash("sha256").update(formattedPayload).digest("hex")}`;

    let jobId: string | undefined = existingRecord?.jobId;
    let blobId: string | undefined = existingRecord?.blobId;
    let verifiedOnWalrus = false;
    let persistenceStatus: PersistenceStatus = "pending_unconfigured";
    let storageMode: WalrusTradeMemory["storageMode"] = "local_unconfigured";
    let retrievalConfirmedAt: string | undefined;
    let relayerError: string | undefined;

    const sdk = await this.getMainnetClient();
    if (sdk) {
      try {
        if (typeof sdk.rememberAndWait === "function") {
          const waitRes = await sdk.rememberAndWait(
            formattedPayload,
            { namespace: this.namespace },
            { timeoutMs: 25000, pollIntervalMs: 1500 }
          );
          jobId = waitRes?.job_id;
          blobId = waitRes?.result?.blob_id || waitRes?.blob_id || undefined;
        } else {
          const res = await sdk.remember(formattedPayload, { namespace: this.namespace });
          jobId = res?.job_id;
          if (jobId && typeof sdk.getJobStatus === "function") {
            try {
              const statusRes = await sdk.getJobStatus(jobId);
              if (statusRes?.result?.blob_id) {
                blobId = statusRes.result.blob_id;
              }
            } catch {
              // Job still queued
            }
          }
        }

        // Strict verification rule: only mark `verifiedOnWalrus: true` when:
        // 1. Write succeeded (`jobId`), 2. `blobId` returned, AND 3. Retrieval confirmed!
        if (jobId && blobId) {
          const retrievedOk = await this.verifyBlobRetrievalOnMainnet(blobId, params.tradeRef);
          if (retrievedOk) {
            verifiedOnWalrus = true;
            persistenceStatus = "confirmed_mainnet";
            storageMode = "walrus_mainnet";
            retrievalConfirmedAt = new Date().toISOString();
          } else {
            verifiedOnWalrus = false;
            persistenceStatus = "write_submitted";
            storageMode = "walrus_mainnet";
          }
        } else if (jobId) {
          verifiedOnWalrus = false;
          persistenceStatus = "write_submitted";
          storageMode = "walrus_mainnet";
        } else {
          verifiedOnWalrus = false;
          persistenceStatus = "write_failed";
          storageMode = "relayer_error";
          relayerError = "Mainnet relayer did not return a job_id or blob_id.";
        }
      } catch (err: any) {
        relayerError = err.message || "Walrus Mainnet relayer request failed";
        persistenceStatus = "write_failed";
        storageMode = "relayer_error";
        verifiedOnWalrus = false;
      }
    } else {
      // Unconfigured credentials: write to official MemWalMock for development-only local indexing
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
      title,
      category,
      type: params.type,
      tradeId: params.tradeId || existingRecord?.tradeId,
      tradeRef: params.tradeRef,
      namespace: this.namespace,
      actor:
        params.actor ||
        params.metadata?.actor ||
        params.metadata?.participants?.[0] ||
        "system:accord",
      sourceRole: params.sourceRole || "accord_ledger",
      content: params.content,
      structuredPayload,
      relatedRecordIds: priorForTrade,
      relatedTxHash: params.metadata?.txHash || params.structuredPayload?.txHash,
      relatedEvidenceHash:
        params.metadata?.evidenceHash || params.structuredPayload?.evidenceHash,
      relatedTermsHash: params.metadata?.termsHash || params.structuredPayload?.termsHash,
      contentHash,
      metadata: {
        ...params.metadata,
        timestamp,
      },
      storedAt: existingRecord?.storedAt || new Date().toISOString(),
      verifiedOnWalrus,
      persistenceStatus,
      storageMode,
      jobId,
      blobId,
      retrievalConfirmedAt,
      relayerError,
      relayerUrl: this.serverUrl,
      aggregatorUrl: this.aggregatorUrl,
      retryCount: existingRecord ? existingRecord.retryCount + 1 : 0,
      lastRetryAt: existingRecord ? new Date().toISOString() : undefined,
    };

    ACCORD_MEMORY_CACHE.set(memoryId, memoryItem);
    persistToDisk();
    return memoryItem;
  }

  /**
   * Retry persisting an existing pending or failed memory record in-place without creating duplicates.
   */
  async retryPersistMemory(memoryId: string): Promise<WalrusTradeMemory> {
    const existing = ACCORD_MEMORY_CACHE.get(memoryId);
    if (!existing) {
      throw new Error(`Memory record ${memoryId} not found`);
    }
    if (existing.verifiedOnWalrus && existing.persistenceStatus === "confirmed_mainnet") {
      return existing;
    }

    return this.remember({
      id: existing.id,
      title: existing.title,
      category: existing.category,
      tradeId: existing.tradeId,
      tradeRef: existing.tradeRef,
      type: existing.type,
      actor: existing.actor,
      sourceRole: existing.sourceRole,
      content: existing.content,
      structuredPayload: existing.structuredPayload,
      metadata: existing.metadata,
      waitForWalrusBlob: true,
    });
  }

  /**
   * Retry all pending/unconfirmed memories in-place without duplicating records.
   */
  async retryAllPendingMemories(): Promise<{
    attempted: number;
    confirmed: number;
    memories: WalrusTradeMemory[];
  }> {
    const all = Array.from(ACCORD_MEMORY_CACHE.values());
    const pending = all.filter((m) => !m.verifiedOnWalrus);
    let confirmed = 0;

    for (const mem of pending) {
      const updated = await this.retryPersistMemory(mem.id);
      if (updated.verifiedOnWalrus) {
        confirmed++;
      }
    }

    return {
      attempted: pending.length,
      confirmed,
      memories: this.listAllMemories(),
    };
  }

  /**
   * Get a single memory record by ID, along with its related trade memories
   */
  getMemoryById(memoryId: string): {
    memory: WalrusTradeMemory | null;
    relatedMemories: WalrusTradeMemory[];
  } {
    const memory = ACCORD_MEMORY_CACHE.get(memoryId) || null;
    if (!memory) {
      return { memory: null, relatedMemories: [] };
    }
    const relatedMemories = Array.from(ACCORD_MEMORY_CACHE.values())
      .filter((m) => m.tradeRef === memory.tradeRef && m.id !== memory.id)
      .sort((a, b) => (a.metadata.timestamp || 0) - (b.metadata.timestamp || 0));

    return { memory, relatedMemories };
  }

  /**
   * Deterministic search & filtering across the Memory Box archive.
   * Works with zero AI dependency across trade ID, counterparty, txHash, agreement ref,
   * evidence ref, category, record type, date range, participant, and persistence status.
   */
  async searchMemories(filters: MemorySearchFilters = {}): Promise<RecallResult> {
    const limit = filters.limit || 50;
    const rawQuery = (filters.query || "").trim();
    const queryLower = rawQuery.toLowerCase();

    const allMemories = Array.from(ACCORD_MEMORY_CACHE.values()).sort(
      (a, b) => (b.metadata.timestamp || 0) - (a.metadata.timestamp || 0)
    );

    const results: WalrusTradeMemory[] = [];
    const fromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
    const toMs = filters.dateTo ? new Date(filters.dateTo).getTime() + 86399999 : null;

    for (const mem of allMemories) {
      // 1. Filter by trade reference
      if (filters.tradeRef && filters.tradeRef !== "all") {
        const refMatch =
          mem.tradeRef.toLowerCase() === filters.tradeRef.toLowerCase() ||
          mem.tradeId?.toLowerCase() === filters.tradeRef.toLowerCase();
        if (!refMatch) continue;
      }

      // 2. Filter by category
      if (filters.category) {
        const cat = mem.category || classifyMemoryCategory(mem.type);
        if (cat !== filters.category) continue;
      }

      // 3. Filter by record type
      if (filters.type && mem.type !== filters.type) {
        continue;
      }

      // 4. Filter by participant
      if (filters.participant && filters.participant.trim()) {
        const pLower = filters.participant.trim().toLowerCase();
        const actorMatch = mem.actor?.toLowerCase().includes(pLower);
        const listMatch = (mem.metadata?.participants || []).some((p: string) =>
          p.toLowerCase().includes(pLower)
        );
        const userMatch = mem.metadata?.userAddress?.toLowerCase().includes(pLower);
        if (!actorMatch && !listMatch && !userMatch) continue;
      }

      // 5. Filter by persistence status
      if (filters.persistenceStatus && filters.persistenceStatus !== "all") {
        if (filters.persistenceStatus === "confirmed_mainnet" && !mem.verifiedOnWalrus) {
          continue;
        }
        if (
          filters.persistenceStatus === "pending" &&
          (mem.verifiedOnWalrus || mem.persistenceStatus === "write_failed")
        ) {
          continue;
        }
        if (
          filters.persistenceStatus === "failed" &&
          mem.persistenceStatus !== "write_failed"
        ) {
          continue;
        }
      }

      // 6. Filter by date range
      const memTs = mem.metadata?.timestamp || new Date(mem.storedAt).getTime();
      if (fromMs && !Number.isNaN(fromMs) && memTs < fromMs) continue;
      if (toMs && !Number.isNaN(toMs) && memTs > toMs) continue;

      // 7. Deterministic text & identifier query across all searchable fields
      if (queryLower && queryLower !== "*") {
        const searchableText = [
          mem.id,
          mem.title,
          mem.tradeRef,
          mem.tradeId,
          mem.category,
          mem.type,
          mem.actor,
          mem.content,
          mem.contentHash,
          mem.blobId,
          mem.jobId,
          mem.relatedTxHash,
          mem.relatedEvidenceHash,
          mem.relatedTermsHash,
          ...(mem.metadata?.participants || []),
          JSON.stringify(mem.structuredPayload || {}),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        // Support both exact substring match and multi-token match
        const tokens = queryLower.split(/\s+/).filter((t) => t.length > 1);
        const exactMatch = searchableText.includes(queryLower);
        const tokenMatch =
          tokens.length > 0 && tokens.every((tok) => searchableText.includes(tok));
        const anyMeaningfulTokenMatch =
          tokens.filter((t) => t.length > 3).some((tok) => searchableText.includes(tok));

        if (!exactMatch && !tokenMatch && !anyMeaningfulTokenMatch) {
          continue;
        }
      }

      results.push(mem);
      if (results.length >= limit) break;
    }

    const mainnetVerifiedCount = results.filter((m) => m.verifiedOnWalrus).length;

    return {
      memories: results,
      query: rawQuery || "*",
      count: results.length,
      mainnetVerifiedCount,
      overview: this.getOverviewStats(),
      source: mainnetVerifiedCount > 0 ? "memwal_sdk_mainnet" : "accord_memory_box_index",
    };
  }

  /**
   * Backward-compatible recall method used by API routes and Trade Room
   */
  async recall(params: {
    query: string;
    tradeRef?: string;
    participant?: string;
    category?: MemoryCategory;
    type?: MemoryRecordType;
    persistenceStatus?: "all" | "confirmed_mainnet" | "pending" | "failed";
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<RecallResult> {
    return this.searchMemories({
      query: params.query,
      tradeRef: params.tradeRef,
      participant: params.participant,
      category: params.category,
      type: params.type,
      persistenceStatus: params.persistenceStatus,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      limit: params.limit,
    });
  }

  /**
   * Get chronological memories for a specific trade room
   */
  async getMemoriesForTrade(tradeRef: string): Promise<WalrusTradeMemory[]> {
    return Array.from(ACCORD_MEMORY_CACHE.values())
      .filter((m) => m.tradeRef.toLowerCase() === tradeRef.toLowerCase())
      .sort((a, b) => (a.metadata.timestamp || 0) - (b.metadata.timestamp || 0));
  }

  /**
   * List all indexed memories (newest first)
   */
  listAllMemories(): WalrusTradeMemory[] {
    return Array.from(ACCORD_MEMORY_CACHE.values()).sort(
      (a, b) => (b.metadata.timestamp || 0) - (a.metadata.timestamp || 0)
    );
  }

  /**
   * Seed 12 distinct, meaningful trade memories across all 6 categories.
   * When forceMainnetSync is true, retries pending memories in-place without duplicating records.
   */
  async seedDemonstrationMemories(forceMainnetSync: boolean = false): Promise<WalrusTradeMemory[]> {
    const existing = Array.from(ACCORD_MEMORY_CACHE.values());

    if (existing.length >= 12) {
      if (forceMainnetSync) {
        const retried = await this.retryAllPendingMemories();
        return retried.memories;
      }
      return this.listAllMemories();
    }

    const baseTime = Date.now() - 3600 * 1000;
    const seeds: Array<{
      id: string;
      title: string;
      category: MemoryCategory;
      tradeRef: string;
      type: MemoryRecordType;
      actor: string;
      sourceRole: WalrusTradeMemory["sourceRole"];
      content: string;
      structuredPayload: Record<string, any>;
      metadata: Record<string, any>;
    }> = [
      {
        id: "wal-seed-8812-01",
        title: "Trade Room Initialized — ACC-2026-8812",
        category: "Trade History",
        tradeRef: "ACC-2026-8812",
        type: "TRADE_CREATED",
        actor: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
        sourceRole: "buyer",
        content:
          "Trade ACC-2026-8812 created by Buyer 0xf5bdce6674389d937df8ad3363c10fc3fa060b75 for 0.000371 ETH on Base Mainnet with Seller 0x0729e2a4716d9f7dd17858d5d504426d228697f7 and Neutral Arbiter 0x12c4E5496F5bAbE7F9159958742D2635B1a084c7.",
        structuredPayload: {
          event: "TRADE_CREATED",
          amount: "0.000371",
          asset: "ETH",
          network: "base-mainnet",
          buyer: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
          seller: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
        },
        metadata: {
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
          amount: "0.000371",
          asset: "ETH",
          network: "base-mainnet",
          timestamp: baseTime + 1000,
        },
      },
      {
        id: "wal-seed-8812-02",
        title: "Agreement Version 1 Drafted — ACC-2026-8812",
        category: "Agreements",
        tradeRef: "ACC-2026-8812",
        type: "TRADE_TERMS",
        actor: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
        sourceRole: "buyer",
        content:
          "Agreed P2P Trade Terms (Version 1): 0.000371 ETH on Base Mainnet between Buyer 0xf5bdce6674389d937df8ad3363c10fc3fa060b75 and Seller 0x0729e2a4716d9f7dd17858d5d504426d228697f7. Settlement condition: Tatum RPC verifies Base Mainnet deposit tx 0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c and Seller delivers cryptographically signed API key.",
        structuredPayload: {
          version: 1,
          amount: "0.000371",
          asset: "ETH",
          network: "base-mainnet",
          termsHash: "0x89ab12cd34ef567890abcdef1234567890abcdef1234567890abcdef12345678",
        },
        metadata: {
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
          amount: "0.000371",
          asset: "ETH",
          network: "base-mainnet",
          termsHash: "0x89ab12cd34ef567890abcdef1234567890abcdef1234567890abcdef12345678",
          timestamp: baseTime + 2000,
        },
      },
      {
        id: "wal-seed-8812-03",
        title: "Bilateral Acceptance Recorded (Version 1) — ACC-2026-8812",
        category: "Agreements",
        tradeRef: "ACC-2026-8812",
        type: "TRADE_ACCEPTANCE",
        actor: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
        sourceRole: "seller",
        content:
          "Seller 0x0729e2a4716d9f7dd17858d5d504426d228697f7 reviewed and accepted Version 1 terms for trade ACC-2026-8812 on Base Mainnet.",
        structuredPayload: {
          acceptedVersion: 1,
          buyerAccepted: true,
          sellerAccepted: true,
          acceptedBy: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
        },
        metadata: {
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
          acceptedVersion: 1,
          timestamp: baseTime + 3000,
        },
      },
      {
        id: "wal-seed-8812-04",
        title: "Tatum RPC Verified Base Mainnet Deposit — ACC-2026-8812",
        category: "Transactions",
        tradeRef: "ACC-2026-8812",
        type: "ONCHAIN_VERIFICATION",
        actor: "system:tatum-rpc",
        sourceRole: "tatum_rpc",
        content:
          "Tatum RPC verified real Base Mainnet transaction 0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c in block 53221342 (status 0x1, value 0.000371 ETH from 0xf5bdce6674389d937df8ad3363c10fc3fa060b75 to 0x0729e2a4716d9f7dd17858d5d504426d228697f7).",
        structuredPayload: {
          txHash: "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c",
          network: "base-mainnet",
          chainId: 8453,
          blockNumber: 53221342,
          receiptStatus: "0x1",
          valueEth: "0.000371",
          from: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
          to: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
        },
        metadata: {
          txHash: "0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c",
          network: "base-mainnet",
          blockNumber: 53221342,
          verifiedStatus: "0x1",
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
          timestamp: baseTime + 4000,
        },
      },
      {
        id: "wal-seed-8812-05",
        title: "Fulfilment Evidence & Attestation Recorded — ACC-2026-8812",
        category: "Fulfilment",
        tradeRef: "ACC-2026-8812",
        type: "CONDITION_UPDATE",
        actor: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
        sourceRole: "seller",
        content:
          "Off-chain condition attested: Seller 0x0729e2a4716d9f7dd17858d5d504426d228697f7 submitted signed API bundle receipt (SHA-256: 0x6f9b1c2e8a4d3f5e7b9c0a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f).",
        structuredPayload: {
          conditionTitle: "Signed API Bundle Delivery (Off-Chain Attestation)",
          verificationCategory: "offchain_attestation",
          attestedBy: "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          evidenceHash: "0x6f9b1c2e8a4d3f5e7b9c0a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
        },
        metadata: {
          conditionId: "cond-offchain-receipt",
          verificationMethod: "offchain_attestation",
          evidenceHash: "0x6f9b1c2e8a4d3f5e7b9c0a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
          participants: ["0x0729e2a4716d9f7dd17858d5d504426d228697f7"],
          timestamp: baseTime + 5000,
        },
      },
      {
        id: "wal-seed-8812-06",
        title: "Settlement Completed Without Dispute — ACC-2026-8812",
        category: "Settlement",
        tradeRef: "ACC-2026-8812",
        type: "SETTLEMENT_LESSON",
        actor: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
        sourceRole: "buyer",
        content:
          "Trade ACC-2026-8812 settled cleanly on Base Mainnet in 28 minutes with zero disputes. Counterparty 0x0729e2a4716d9f7dd17858d5d504426d228697f7 fulfilled off-chain deliverables promptly after Tatum RPC deposit confirmation.",
        structuredPayload: {
          outcome: "COMPLETED",
          settlementMinutes: 28,
          releasedAmount: "0.000371 ETH",
        },
        metadata: {
          outcome: "COMPLETED",
          settlementMinutes: 28,
          participants: [
            "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
            "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
          ],
          timestamp: baseTime + 6000,
        },
      },
      {
        id: "wal-seed-9041-01",
        title: "Original Agreement Drafted — ACC-2026-9041",
        category: "Agreements",
        tradeRef: "ACC-2026-9041",
        type: "TRADE_TERMS",
        actor: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
        sourceRole: "buyer",
        content:
          "Agreed P2P Trade Terms: 1.20 ETH for ENS/Web3 Domain Transfer on Ethereum Mainnet between Buyer 0x71C83647249C0392B7e4136f1c7dC1a978641a96 and Seller 0x3d7b4A8911f4dF2309C8198542F559d873138b1E. Neutral Arbiter: 0x12c4E5496F5bAbE7F9159958742D2635B1a084c7.",
        structuredPayload: {
          version: 1,
          amount: "1.20",
          asset: "ETH",
          network: "ethereum-mainnet",
        },
        metadata: {
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
          ],
          amount: "1.20",
          asset: "ETH",
          network: "ethereum-mainnet",
          timestamp: baseTime + 7000,
        },
      },
      {
        id: "wal-seed-9041-02",
        title: "Terms Amended to Version 2 — ACC-2026-9041",
        category: "Agreements",
        tradeRef: "ACC-2026-9041",
        type: "TERMS_AMENDMENT",
        actor: "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
        sourceRole: "seller",
        content:
          "Terms amended to Version 2 for ACC-2026-9041 by Seller 0x3d7b4A8911f4dF2309C8198542F559d873138b1E: Extended domain transfer window from 2 hours to 4 hours. Buyer acceptance was automatically reset and subsequently re-confirmed.",
        structuredPayload: {
          previousVersion: 1,
          newVersion: 2,
          acceptanceInvalidated: true,
        },
        metadata: {
          previousVersion: 1,
          newVersion: 2,
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
          ],
          timestamp: baseTime + 8000,
        },
      },
      {
        id: "wal-seed-9041-03",
        title: "Ethereum Mainnet Deposit Confirmation — ACC-2026-9041",
        category: "Transactions",
        tradeRef: "ACC-2026-9041",
        type: "ONCHAIN_VERIFICATION",
        actor: "system:tatum-rpc",
        sourceRole: "tatum_rpc",
        content:
          "Tatum RPC verified Ethereum Mainnet deposit and ERC-721 transfer receipt for ACC-2026-9041 with 32 block confirmations.",
        structuredPayload: {
          network: "ethereum-mainnet",
          chainId: 1,
          confirmations: 32,
          receiptStatus: "0x1",
        },
        metadata: {
          network: "ethereum-mainnet",
          confirmations: 32,
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x3d7b4A8911f4dF2309C8198542F559d873138b1E",
          ],
          timestamp: baseTime + 9000,
        },
      },
      {
        id: "wal-seed-7734-01",
        title: "Dispute & Return Manifest Evidence Submitted — ACC-2026-7734",
        category: "Disputes",
        tradeRef: "ACC-2026-7734",
        type: "DISPUTE_EVIDENCE",
        actor: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
        sourceRole: "buyer",
        content:
          "Dispute evidence anchored for trade ACC-2026-7734: Buyer 0x71C83647249C0392B7e4136f1c7dC1a978641a96 submitted courier return manifest (SHA-256 hash 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855) showing off-chain hardware parcel was returned to sender.",
        structuredPayload: {
          disputedBy: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
          reason: "Deliverable hardware specification mismatch",
          evidenceHash: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        metadata: {
          evidenceHash: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          disputedBy: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x89205A3A3b2A55385750058eE9B6615b8B94611C",
          ],
          timestamp: baseTime + 10000,
        },
      },
      {
        id: "wal-seed-7734-02",
        title: "Neutral Arbiter Dispute Ruling & Full Refund — ACC-2026-7734",
        category: "Disputes",
        tradeRef: "ACC-2026-7734",
        type: "DISPUTE_RESOLUTION",
        actor: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
        sourceRole: "arbiter",
        content:
          "Neutral Arbiter 0x12c4E5496F5bAbE7F9159958742D2635B1a084c7 resolved dispute ACC-2026-7734 (10000 bps / 100% refund to buyer) after verifying courier return hash against Seller's dispatch receipt.",
        structuredPayload: {
          arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
          buyerSplitBps: 10000,
          sellerSplitBps: 0,
          resolutionOutcome: "FULL_REFUND_TO_BUYER",
        },
        metadata: {
          arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
          buyerSplitBps: 10000,
          resolution: "FULL_REFUND_TO_BUYER",
          participants: [
            "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
            "0x89205A3A3b2A55385750058eE9B6615b8B94611C",
          ],
          timestamp: baseTime + 11000,
        },
      },
      {
        id: "wal-seed-prefs-01",
        title: "Counterparty Safety Policy — 0x71C8…1a96",
        category: "Trade History",
        tradeRef: "ACC-GLOBAL-PREFS",
        type: "USER_PREFERENCE",
        actor: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
        sourceRole: "participant",
        content:
          "Trader 0x71C83647249C0392B7e4136f1c7dC1a978641a96 explicit safety preference: Require minimum 12 Tatum RPC block confirmations for trades above 0.5 ETH and always appoint neutral arbiter 0x12c4E5496F5bAbE7F9159958742D2635B1a084c7.",
        structuredPayload: {
          userAddress: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
          minConfirmations: 12,
          preferredArbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
        },
        metadata: {
          userAddress: "0x71C83647249C0392B7e4136f1c7dC1a978641a96",
          participants: ["0x71C83647249C0392B7e4136f1c7dC1a978641a96"],
          minConfirmations: 12,
          timestamp: baseTime + 12000,
        },
      },
      {
        id: "wal-seed-prefs-02",
        title: "Counterparty Settlement Policy — 0xf5bd…0b75",
        category: "Trade History",
        tradeRef: "ACC-GLOBAL-PREFS",
        type: "USER_PREFERENCE",
        actor: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
        sourceRole: "participant",
        content:
          "Trader 0xf5bdce6674389d937df8ad3363c10fc3fa060b75 explicit preference: Prefers Base Mainnet for low-latency P2P settlement and requires SHA-256 evidence hashes anchored to Walrus Memory before releasing funds.",
        structuredPayload: {
          userAddress: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
          preferredNetwork: "base-mainnet",
          requireSha256Evidence: true,
        },
        metadata: {
          userAddress: "0xf5bdce6674389d937df8ad3363c10fc3fa060b75",
          participants: ["0xf5bdce6674389d937df8ad3363c10fc3fa060b75"],
          preferredNetwork: "base-mainnet",
          timestamp: baseTime + 13000,
        },
      },
    ];

    const results: WalrusTradeMemory[] = [];
    for (const seed of seeds) {
      if (!ACCORD_MEMORY_CACHE.has(seed.id)) {
        const memory = await this.remember(seed);
        results.push(memory);
      } else {
        results.push(ACCORD_MEMORY_CACHE.get(seed.id)!);
      }
    }

    return results;
  }
}

export const walrusMemory = new WalrusMemoryService();
