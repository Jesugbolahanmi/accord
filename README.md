# Accord — Trade on agreed terms.

**Accord** is a peer-to-peer crypto trading coordination and settlement platform built for the **Tatum × Walrus Memory ("Total Recall") Hackathon**.

Peer-to-peer crypto transactions often depend on blind trust, scattered Telegram/Discord messages, manual block explorer checks, and uncertainty about when each participant should act. **Accord** brings the versioned agreement, escrow authorization rules, live **Tatum RPC** on-chain verification, and persistent **Walrus Memory** context into a single shared trade room.

---

## Core Capabilities

1. **Create a Trade & Counterparty Invitation Flow (`/trades/new`)**
   - Generate a unique trade reference (`ACC-YYYY-XXXX`), specify asset & amount, designate Buyer, Seller, and an independent **Neutral Arbiter**, select the EVM settlement network, and define agreed terms and settlement conditions.
   - Generates a shareable invitation link (`/trade/ACC-...`) for the counterparty.
   - **Transparent Term Versioning**: Any amendment to the agreed terms before deposit creates a new numbered `TermsVersion` with its own SHA-256 `termsHash` and automatically resets counterparty acceptance (`AwaitingAcceptance`)—changes never silently overwrite previously accepted terms.

2. **Shared Trade Room (`/trade/[id]`)**
   - Displays trade participants, acceptance badges, versioned agreement history, "What Happens Next" action guidance, live Tatum RPC transaction receipt telemetry, settlement conditions checklist, chronological activity timeline, and cryptographic dispute evidence vault.
   - Enforces a strict state machine: `Draft` → `AwaitingAcceptance` → `AwaitingDeposit` → `Funded` → `AwaitingConditions` → `ReadyForRelease` → `Completed` / `Disputed` / `Refunded` / `Expired`.
   - **Never Falsely Marked Funded**: A frontend button alone can never mark a trade as `Funded` or `Completed`; moving to `Funded` requires a verified `0x1` transaction receipt from **Tatum RPC**.

3. **Real Transaction Security (`contracts/AccordEscrow.sol`)**
   - Solidity `^0.8.20` smart contract implementing `createTrade`, `deposit`, `confirmFulfillment`, `approveRelease`, `refund`, `claimExpiredRefund`, `raiseDispute`, `resolveDispute`, `proposeMutualSettlement`, and `acceptMutualSettlement`.
   - Protected by a reentrancy guard (`nonReentrant`), strict separation of duties (`arbiter != buyer && arbiter != seller`), and checks-effects-interactions payout ordering.
   - **On-Chain vs. Off-Chain Clarity**: Accord explicitly distinguishes conditions verified on-chain via Tatum RPC (`onchain_receipt`) from off-chain deliverables (`external_delivery`, `inspection`), which are recorded as participant attestations anchored with SHA-256 evidence hashes.
   - **Strict AI Boundary**: The Accord Context Assistant never authorizes fund releases, signs transactions, transfers funds, or decides disputes.

4. **Tatum RPC Gateway & AI Builder Integration (`lib/tatum/client.ts`, `/tatum-diagnostic`)**
   - Server-side JSON-RPC integration with `https://<network>.gateway.tatum.io` across **Base Mainnet**, **Base Sepolia**, **Ethereum Mainnet**, and **Polygon Mainnet**.
   - Executes `eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_blockNumber`, and `eth_getBalance` to verify execution status (`0x1` vs `0x0`), confirmation depth, sender (`from`), recipient (`to`), and transferred value.
   - Integrates **Tatum AI Builder (`https://ai.tatum.io`)** manifest and multi-chain RPC blueprints (Hackathon Requirement 6).

5. **Walrus Memory on Mainnet (`lib/walrus/memory.ts`, `/memory`)**
   - Integrates the official `@mysten-incubation/memwal` SDK targeting the Walrus Memory Mainnet Relayer (`https://relayer.memory.walrus.xyz`, Sui Mainnet Package `0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5`).
   - Persists structured trade memories (`TRADE_TERMS`, `TERMS_AMENDMENT`, `TRADE_ACCEPTANCE`, `ONCHAIN_VERIFICATION`, `CONDITION_UPDATE`, `DISPUTE_EVIDENCE`, `DISPUTE_RESOLUTION`, `SETTLEMENT_LESSON`, `USER_PREFERENCE`) under namespace `accord-trades`.
   - **Epistemic Integrity**: Records are only marked `verifiedOnWalrus: true` when confirmed by the Mainnet Relayer. When `.env.local` credentials are not yet configured, Accord falls back to `@mysten-incubation/memwal`'s `MemWalMock` and transparently labels records `verifiedOnWalrus: false`.

6. **Persistent Memory Context Assistant (`lib/assistant/accord-ai.ts`)**
   - Recalls past counterparty trade outcomes and explicit user preferences when creating or managing a trade.
   - Answers practical trade questions (*"What have both parties agreed to?"*, *"Has the deposit actually been confirmed?"*, *"Which condition remains outstanding?"*, *"What happened during our previous trade?"*, *"What evidence is needed to resolve this dispute?"*), explicitly separating `[Verified On-Chain via Tatum RPC]`, `[Walrus Memory Record]`, and `[Participant Claim / Attestation]`.

---

## Architecture Overview

```text
├── app/
│   ├── page.tsx                        # Landing page & protocol overview
│   ├── trades/page.tsx                 # Filterable P2P Trade Rooms directory
│   ├── trades/new/page.tsx             # Create Trade flow + Walrus Memory counterparty recall
│   ├── trade/[id]/page.tsx             # Shared Trade Room (terms, Tatum RPC verify, escrow, AI)
│   ├── memory/page.tsx                 # Walrus Memory Mainnet Explorer & 12-Memory Seeder
│   ├── tatum-diagnostic/page.tsx       # Tatum RPC Gateway & AI Builder Diagnostic Console
│   └── api/
│       ├── trades/route.ts             # GET list / POST create trade
│       ├── trades/[id]/route.ts        # GET trade / PATCH accept, amend, condition, release, dispute
│       ├── trades/[id]/verify/route.ts # POST Tatum RPC transaction receipt verification
│       ├── memory/remember/route.ts    # POST write memory via @mysten-incubation/memwal
│       ├── memory/recall/route.ts      # GET/POST semantic & metadata recall
│       ├── memory/seed/route.ts        # GET/POST verify & sync 12+ trade memories
│       ├── assistant/route.ts          # POST grounded context assistant Q&A
│       └── tatum/diagnose/route.ts     # GET RPC telemetry / POST receipt inspector
├── contracts/
│   └── AccordEscrow.sol                # EVM Escrow smart contract (Solidity ^0.8.20)
├── lib/
│   ├── contracts/AccordEscrow.ts       # Contract ABI, state enum, and network addresses
│   ├── tatum/client.ts                 # Tatum RPC Gateway verification client
│   ├── tatum/ai-builder.ts             # Tatum AI Builder (ai.tatum.io) manifest client
│   ├── walrus/memory.ts                # Walrus Memory Mainnet SDK (@mysten-incubation/memwal)
│   ├── trades/store.ts                 # Audited trade state machine & versioned store
│   └── assistant/accord-ai.ts          # Grounded Context Assistant engine
├── scripts/
│   └── verify-mainnet-memories.ts      # CLI verification for Tatum RPC & 12+ Walrus Memories
└── test/
    └── accord.test.ts                  # Automated test suite (node:test)
```

---

## Getting Started

### 1. Prerequisites
- **Node.js** `>= 22.23.4`
- **pnpm** `>= 10.x` (or `npm`)

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables (`.env.local`)
Copy `.env.example` to `.env.local` and supply your credentials:

```env
# 1. Tatum API Key (Server-side only — https://dashboard.tatum.io)
TATUM_API_KEY=your_tatum_api_key_here

# 2. Walrus Memory Mainnet Credentials (https://memory.walrus.xyz)
# Register a MemWalAccount on Sui Mainnet and paste your delegate Ed25519 private key & account object ID:
MEMWAL_PRIVATE_KEY=your_ed25519_delegate_private_key_hex_or_suiprivkey
MEMWAL_ACCOUNT_ID=0x_your_sui_memwal_account_object_id
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
MEMWAL_NAMESPACE=accord-trades

# 3. Optional Web3 WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

### 4. Run Tests, Verification Script & Development Server

```bash
# Run the automated security & integration test suite (6 test suites)
pnpm test

# Run the live Tatum RPC & Walrus Memory verification CLI
pnpm run verify-memories

# Start the Next.js development server
pnpm run dev

# Build for production
pnpm run build
```

---

## Supported Networks & Tatum RPC Verification

| Network | Slug | Chain ID | Tatum Gateway Endpoint |
| :--- | :--- | :--- | :--- |
| **Base Mainnet** | `base-mainnet` | `8453` | `https://base-mainnet.gateway.tatum.io` |
| **Base Sepolia** | `base-sepolia` | `84532` | `https://base-sepolia.gateway.tatum.io` |
| **Ethereum Mainnet** | `ethereum-mainnet` | `1` | `https://ethereum-mainnet.gateway.tatum.io` |
| **Polygon Mainnet** | `polygon-mainnet` | `137` | `https://polygon-mainnet.gateway.tatum.io` |

- Showcase trade **`ACC-2026-8812`** comes pre-configured with a real, verifiable Base Mainnet transaction (`0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c`, mined in Block `#53221342`, `0.000371 ETH`) so you can test live Tatum RPC verification immediately in the Shared Trade Room.

---

## Security Notes & Limitations

- **On-Chain vs. Off-Chain Verification**: Tatum RPC cryptographically proves on-chain events (`0x1` receipt status, block confirmation depth, sender/recipient, and value). A blockchain cannot independently prove off-chain events such as physical parcel delivery or external API key validity; Accord labels those conditions as **Off-Chain Participant Attestations** and anchors their SHA-256 evidence hashes for neutral arbiter review.
- **No Unilateral AI Authority**: Accord's Context Assistant retrieves persistent memories from Walrus Memory and live receipts from Tatum RPC to inform human participants, without retraining model weights or ever having authority to sign transactions, release escrow, or adjudicate disputes.
