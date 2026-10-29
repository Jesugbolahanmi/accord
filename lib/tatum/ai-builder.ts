/**
 * Accord - Tatum AI Builder Integration (Bonus Hackathon Feature)
 *
 * Integrates official machine-readable agent layer from https://ai.tatum.io:
 * - Manifest inspection (/.well-known/tatum-agent.json)
 * - Chain discovery and health checking (/api/chains)
 * - Canonical workflows (incoming-payment-monitor, rpc-diagnostic-agent)
 */

export interface TatumAgentManifest {
  version: string;
  name: string;
  description: string;
  url: string;
  counts: {
    chains: number;
    networks: number;
    mcpTools: number;
    workflows: number;
  };
  entrypoints: {
    manifest: string;
    workflows: { index: string; slugs: string[] };
    capabilities: { index: string };
    docs: string;
  };
}

export interface TatumChainEntry {
  chain: string;
  network: string;
  interface: string;
  url: string;
  type: string;
}

export class TatumAIBuilder {
  private static BASE_URL = "https://ai.tatum.io";

  /**
   * Fetch the official Tatum Agent manifest
   */
  static async getManifest(): Promise<TatumAgentManifest | null> {
    try {
      const res = await fetch(`${this.BASE_URL}/.well-known/tatum-agent.json`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Fetch live Tatum workflow specification
   */
  static async getWorkflow(slug: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.BASE_URL}/workflows/${slug}.md`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  /**
   * Query Tatum supported chains for a network
   */
  static async getSupportedChains(): Promise<any[]> {
    try {
      const res = await fetch(`${this.BASE_URL}/api/chains`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.chains || [];
    } catch {
      return [];
    }
  }

  /**
   * Execute automated payment monitor workflow check
   * Inspired by Tatum's incoming-payment-monitor recipe
   */
  static async checkIncomingPayment(params: {
    address: string;
    expectedAmountEth: string;
    network: string;
    targetTxHash?: string;
  }): Promise<{
    monitored: boolean;
    txFound: boolean;
    status: string;
    details: any;
  }> {
    // Queries Tatum RPC for incoming funds
    const { tatum } = await import("./client");
    if (params.targetTxHash) {
      const verification = await tatum.verifyTransaction(params.targetTxHash, params.network, {
        to: params.address,
        expectedValueEth: params.expectedAmountEth,
      });
      return {
        monitored: true,
        txFound: verification.verified,
        status: verification.status,
        details: verification,
      };
    }

    const balance = await tatum.getBalance(params.address, params.network);
    return {
      monitored: true,
      txFound: false,
      status: "listening",
      details: {
        address: params.address,
        currentBalance: balance,
        expectedAmountEth: params.expectedAmountEth,
        network: params.network,
      },
    };
  }
}
