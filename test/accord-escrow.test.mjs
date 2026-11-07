import assert from "node:assert/strict";
import test from "node:test";
import ganache from "ganache";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  keccak256,
  parseEther,
  toHex,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACCORD_ESCROW_DEPLOYMENT_ABI } from "../contracts/artifacts/AccordEscrow.ts";
import { verifyEscrowActionEvent } from "../lib/contracts/verify-escrow-event.ts";
import { compileAccordEscrow } from "../scripts/compile-escrow.mjs";

test("local AccordEscrow supports a complete ETH escrow lifecycle", async (t) => {
  const provider = ganache.provider({
    chain: { chainId: 31337 },
    logging: { quiet: true },
    wallet: { totalAccounts: 3, defaultBalance: 100 },
  });
  t.after(async () => provider.disconnect());

  const chain = defineChain({
    id: 31337,
    name: "Accord Local Test",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
    testnet: true,
  });
  const accounts = Object.values(provider.getInitialAccounts());
  const buyer = privateKeyToAccount(accounts[0].secretKey);
  const seller = privateKeyToAccount(accounts[1].secretKey);
  const secondBuyer = privateKeyToAccount(accounts[2].secretKey);
  const buyerWallet = createWalletClient({ account: buyer, chain, transport: custom(provider) });
  const sellerWallet = createWalletClient({ account: seller, chain, transport: custom(provider) });
  const secondBuyerWallet = createWalletClient({
    account: secondBuyer,
    chain,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({ chain, transport: custom(provider) });
  const { abi, bytecode } = await compileAccordEscrow();
  assert.deepEqual(ACCORD_ESCROW_DEPLOYMENT_ABI, abi);

  const deploymentHash = await buyerWallet.deployContract({ abi, bytecode, args: [] });
  const deployment = await publicClient.waitForTransactionReceipt({ hash: deploymentHash });
  assert.equal(deployment.status, "success");
  assert.ok(deployment.contractAddress);
  const otherDeploymentHash = await buyerWallet.deployContract({ abi, bytecode, args: [] });
  const otherDeployment = await publicClient.waitForTransactionReceipt({ hash: otherDeploymentHash });
  assert.equal(otherDeployment.status, "success");
  assert.ok(otherDeployment.contractAddress);

  const amount = parseEther("1");
  const tradeRef = `LOCAL-${Date.now()}`;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const termsHash = keccak256(toHex("Agreed local test terms"));
  const fulfillmentProofHash = keccak256(toHex("Fulfillment evidence"));
  const tradeId = await publicClient.readContract({
    address: deployment.contractAddress,
    abi,
    functionName: "computeTradeId",
    args: [tradeRef, buyer.address],
  });

  const createHash = await buyerWallet.writeContract({
    address: deployment.contractAddress,
    abi,
    functionName: "createTrade",
    args: [tradeRef, seller.address, zeroAddress, amount, deadline, termsHash],
  });
  await publicClient.waitForTransactionReceipt({ hash: createHash });
  assert.equal(await publicClient.readContract({
    address: deployment.contractAddress,
    abi,
    functionName: "version",
  }), 2n);

  await assert.rejects(
    secondBuyerWallet.writeContract({
      address: deployment.contractAddress,
      abi,
      functionName: "createTrade",
      args: [tradeRef, seller.address, zeroAddress, amount, deadline, termsHash],
    })
  );

  const depositHash = await buyerWallet.writeContract({
    address: deployment.contractAddress,
    abi,
    functionName: "deposit",
    args: [tradeId],
    value: amount,
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  const tradeDetails = {
    reference: tradeRef,
    buyer: buyer.address,
    seller: seller.address,
    amount: "1",
    termsHash,
  };
  await verifyEscrowActionEvent({
    client: publicClient,
    contractAddress: deployment.contractAddress,
    trade: tradeDetails,
    txHash: depositHash,
    actor: buyer.address,
    expectedEvent: "TradeDeposited",
  });
  await assert.rejects(
    verifyEscrowActionEvent({
      client: publicClient,
      contractAddress: deployment.contractAddress,
      trade: tradeDetails,
      txHash: depositHash,
      actor: buyer.address,
      expectedEvent: "TradeReleased",
    }),
    /expected TradeReleased/
  );
  await assert.rejects(
    verifyEscrowActionEvent({
      client: publicClient,
      contractAddress: deployment.contractAddress,
      trade: tradeDetails,
      txHash: depositHash,
      actor: seller.address,
      expectedEvent: "TradeDeposited",
    }),
    /not a successful action/
  );
  await assert.rejects(
    verifyEscrowActionEvent({
      client: publicClient,
      contractAddress: otherDeployment.contractAddress,
      trade: tradeDetails,
      txHash: depositHash,
      actor: buyer.address,
      expectedEvent: "TradeDeposited",
    })
  );
  await assert.rejects(
    verifyEscrowActionEvent({
      client: publicClient,
      contractAddress: deployment.contractAddress,
      trade: { ...tradeDetails, termsHash: keccak256(toHex("Different agreed terms")) },
      txHash: depositHash,
      actor: buyer.address,
      expectedEvent: "TradeDeposited",
    }),
    /terms do not match/
  );

  await assert.rejects(
    buyerWallet.writeContract({
      address: deployment.contractAddress,
      abi,
      functionName: "approveRelease",
      args: [tradeId],
    })
  );
  const fulfillmentHash = await sellerWallet.writeContract({
    address: deployment.contractAddress,
    abi,
    functionName: "confirmFulfillment",
    args: [tradeId, fulfillmentProofHash],
  });
  await publicClient.waitForTransactionReceipt({ hash: fulfillmentHash });
  await verifyEscrowActionEvent({
    client: publicClient,
    contractAddress: deployment.contractAddress,
    trade: tradeDetails,
    txHash: fulfillmentHash,
    actor: seller.address,
    expectedEvent: "FulfillmentConfirmed",
  });

  const sellerBalanceBefore = await publicClient.getBalance({ address: seller.address });
  const releaseHash = await buyerWallet.writeContract({
    address: deployment.contractAddress,
    abi,
    functionName: "approveRelease",
    args: [tradeId],
  });
  await publicClient.waitForTransactionReceipt({ hash: releaseHash });
  await verifyEscrowActionEvent({
    client: publicClient,
    contractAddress: deployment.contractAddress,
    trade: tradeDetails,
    txHash: releaseHash,
    actor: buyer.address,
    expectedEvent: "TradeReleased",
  });

  const finalTrade = await publicClient.readContract({
    address: deployment.contractAddress,
    abi,
    functionName: "getTrade",
    args: [tradeId],
  });
  const sellerBalanceAfter = await publicClient.getBalance({ address: seller.address });

  assert.equal(Number(finalTrade.state), 6);
  assert.equal(sellerBalanceAfter - sellerBalanceBefore, amount);
});
