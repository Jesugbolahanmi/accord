import { config } from "dotenv";
config({ path: ".env.local" });

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
if (!ALCHEMY_API_KEY) {
  throw new Error("ALCHEMY_API_KEY environment variable is not set");
}

const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

async function alchemyCall(method: string, params: any[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const res = await fetch(ALCHEMY_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const data = await res.json();
    console.log(`ALCHEMY RESPONSE for ${method}:`, JSON.stringify(data, null, 2));
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWalletTransactions(address: string) {
  const [outgoing, incoming] = await Promise.all([
    alchemyCall("alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      fromAddress: address,
      category: ["external", "erc20"],
      order: "desc",
      maxCount: "0x64",
    }]),
    alchemyCall("alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      toAddress: address,
      category: ["external", "erc20"],
      order: "desc",
      maxCount: "0x64",
    }]),
  ]);


  const all = [...(outgoing?.transfers || []), ...(incoming?.transfers || [])];

 return all
  .map((t: any) => ({
    from: t.from,
    to: t.to,
    value: t.rawContract?.value || "0",
    decimal: t.rawContract?.decimal ? parseInt(t.rawContract.decimal, 16) : 18,
    timeStamp: Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000).toString(),
    hash: t.hash,
    asset: t.asset || "",
  }))
  .sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));
}


export async function getTokenMetadata(address: string) {
  const metadata = await alchemyCall("alchemy_getTokenMetadata", [address]);
  return metadata;
}

export async function isContract(address: string) {
  const code = await alchemyCall("eth_getCode", [address, "latest"]);
  return code && code !== "0x";
}



export async function classifyAddress(address: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, reason: "Not a valid address format (must be 0x followed by 40 hex characters)." };
  }

  const code = await alchemyCall("eth_getCode", [address, "latest"]);
  const isContractAddr = code && code !== "0x";

  const [outgoing, incoming] = await Promise.all([
    alchemyCall("alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      fromAddress: address,
      category: ["external", "erc20"],
      maxCount: "0x1",
    }]),
    alchemyCall("alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      toAddress: address,
      category: ["external", "erc20"],
      maxCount: "0x1",
    }]),
  ]);

  const hasActivity =
    (outgoing?.transfers?.length || 0) > 0 || (incoming?.transfers?.length || 0) > 0;

  // If not found on Base at all, check DexScreener to see if it's a token on another chain
  if (!isContractAddr && !hasActivity) {
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const dexData = await dexRes.json();
      const pair = dexData?.pairs?.[0];
      if (pair) {
        const chainId = pair.chainId;
        const tokenName = pair.baseToken?.name || "This token";
        const chainLabel = chainId.charAt(0).toUpperCase() + chainId.slice(1);
        return {
          valid: false,
          reason: `${tokenName} was found on ${chainLabel} chain, not Base. Sentinel currently supports Base-chain tokens only.`,
        };
      }
    } catch {
      // DexScreener check failed silently — fall through to default message
    }
  }

  return {
    valid: true,
    isContract: isContractAddr,
    hasActivity,
    reason: !hasActivity
      ? "This address has no recorded activity on Base — it may be unused, new, or on a different network."
      : null,
  };
}

export async function getTokenMarketData(address: string) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
  const data = await res.json();
  const pair = data?.pairs?.[0];

  if (!pair) return null;

  return {
    priceUsd: pair.priceUsd,
    liquidityUsd: pair.liquidity?.usd,
    marketCap: pair.marketCap,
    fdv: pair.fdv,
    dexUrl: pair.url,
  };
}

export async function getNFTMetadata(address: string) {
  const url = `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getContractMetadata?contractAddress=${address}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}