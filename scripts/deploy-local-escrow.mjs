import {
  createPublicClient,
  defineChain,
  http,
  toHex,
} from "viem";
import { compileAccordEscrow } from "./compile-escrow.mjs";

async function rpcRequest(url, method, params = []) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `Local RPC request failed: ${method}`);
  }
  return payload.result;
}

const rpcUrl = process.env.ACCORD_LOCAL_RPC_URL || "http://127.0.0.1:8545";
const localChain = defineChain({
  id: 31337,
  name: "Accord Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const publicClient = createPublicClient({ chain: localChain, transport: http(rpcUrl) });

const actualChainId = await publicClient.getChainId();
if (actualChainId !== localChain.id) {
  throw new Error(`Expected local chain ID ${localChain.id}, received ${actualChainId}.`);
}

const [account] = await rpcRequest(rpcUrl, "eth_accounts");
if (!account) {
  throw new Error(`No unlocked deployment account is available at ${rpcUrl}. Start the local chain first.`);
}

const { bytecode } = await compileAccordEscrow();
const gas = await publicClient.estimateGas({ account, data: bytecode });
const hash = await rpcRequest(rpcUrl, "eth_sendTransaction", [
  { from: account, data: bytecode, gas: toHex(gas) },
]);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`AccordEscrow deployment failed for transaction ${hash}.`);
}

console.log(`AccordEscrow deployed to ${receipt.contractAddress}`);
console.log(`Local chain ID: ${actualChainId}`);
console.log(`RPC URL: ${rpcUrl}`);
console.log(`Set ACCORD_ESCROW_LOCAL=${receipt.contractAddress} in .env.local when needed.`);
