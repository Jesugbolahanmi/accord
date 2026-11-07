# Accord

**Trade on agreed terms.**

Accord brings peer-to-peer trade agreements, wallet-approved actions, on-chain ETH escrow, payment verification, and a shared trade history into one workspace.

## What Accord can do

- Create a trade agreement between a buyer and seller, with an optional arbiter, an amount, terms, an expiry, and completion conditions.
- Share a trade-room link so the other participant can review the agreement and accept it with their wallet.
- Keep a versioned record of agreement terms and amendments.
- Create an on-chain escrow after both participants accept the current terms.
- Let the buyer deposit the exact agreed native ETH amount, the seller confirm fulfillment, and the buyer release the escrow.
- Record refunds and disputes, collect supporting notes, and support arbiter or mutual settlement flows.
- Verify escrow transactions against the configured network, contract, trade participants, amount, and contract events before updating the trade record.
- Keep shared trade records in Supabase for hosted use.
- Save, search, and retry persisted trade-memory records through Walrus Memory when configured.
- Answer trade-room questions using saved trade details, memory records, and transaction verification results.
- Inspect EVM network RPC connectivity and transaction receipts in the Tatum diagnostics page.

Trade requirements such as delivery and inspection are recorded as participant attestations. Accord keeps them distinct from facts verified directly on-chain.

## EVM networks and assets

Accord's escrow contract handles native ETH. EVM chain settings are:

| Network | Trade network ID | Chain ID | Explorer |
|---|---|---:|---|
| Base Sepolia | `base-sepolia` | 84532 | [BaseScan Sepolia](https://sepolia.basescan.org) |
| Base | `base-mainnet` | 8453 | [BaseScan](https://basescan.org) |
| Arbitrum One | `arbitrum-one` | 42161 | [Arbiscan](https://arbiscan.io) |
| Ethereum Mainnet | `ethereum-mainnet` | 1 | [Etherscan](https://etherscan.io) |

Use the network for which the Accord escrow contract address and server configuration are set. The public mainnet switch controls network visibility in the app, while the server-side mainnet switch controls trade creation and escrow actions.

## Create and complete a trade

1. Open **New Trade** and connect the buyer or seller wallet that will create the agreement.
2. Select the network, enter both participant wallet addresses, the amount, optional arbiter, expiry, terms, and completion conditions.
3. Review the agreement and sign the wallet authorization.
4. Share the generated trade-room link with the other participant.
5. Both participants review the current terms and accept them with their wallets.
6. The buyer creates the on-chain escrow and deposits the exact agreed amount.
7. The seller confirms fulfillment. Participants record the agreement's off-chain conditions in the trade room.
8. The buyer reviews the trade and releases the escrow when ready.
9. Follow the on-chain transactions and the trade timeline in the room. Disputes can be recorded and resolved through an arbiter or a mutual settlement.

## Run locally

### Requirements

- Node.js `>= 22.23.4`
- pnpm `>= 10` (npm can also be used)

### Install and configure

```powershell
pnpm install
Copy-Item .env.example .env.local
```

Configure integrations through the deployment's environment settings. The app uses wallet connections for participant approvals, Supabase for hosted shared trade records, Tatum for EVM transaction checks, and Walrus Memory for persistent trade context.

### Configure shared trade storage

Hosted deployments use Supabase Postgres:

1. Create a Supabase project.
2. Apply [`supabase/migrations/20261105190000_create_accord_trades.sql`](./supabase/migrations/20261105190000_create_accord_trades.sql) in the Supabase SQL Editor or with the Supabase CLI.
3. Configure the Supabase project in the hosting provider's environment settings.
4. Set the deployed app's canonical HTTPS origin for wallet authorization.
5. Redeploy the application.

Local development can use the configured local trade-storage fallback.

### Start the app

```powershell
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy an escrow contract

The setup page at `/setup/base-sepolia` deploys the Accord escrow contract to Base Sepolia from a connected wallet. After the deployment confirms:

1. Copy the contract address.
2. Configure the contract address in the server environment.
3. Restart or redeploy the app so the server uses the configured address.
4. Confirm the deployment and transactions in BaseScan.

For local contract development, use a disposable local EVM:

```powershell
# Terminal 1
pnpm run chain:local

# Terminal 2
pnpm run deploy:local
pnpm dev
```

The local chain uses chain ID `31337` and RPC URL `http://127.0.0.1:8545`.

## Other pages

- `/trades` — browse saved trade rooms.
- `/trades/new` — create an agreement.
- `/trade/<reference>` — review terms, accept, record conditions, manage escrow, and view trade activity.
- `/memory` — browse, search, and retry saved trade-memory records.
- `/tatum-diagnostic` — check RPC connectivity and inspect transaction receipts.

## Development checks

```powershell
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
