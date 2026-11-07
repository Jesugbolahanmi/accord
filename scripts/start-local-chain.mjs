import ganache from "ganache";

const server = ganache.server({
  chain: { chainId: 31337 },
  logging: { quiet: true },
  server: { host: "127.0.0.1", port: 8545 },
  wallet: { totalAccounts: 10, defaultBalance: 1000 },
});

await server.listen(8545, "127.0.0.1");
console.log("Accord local EVM listening at http://127.0.0.1:8545 (chain ID 31337).");
