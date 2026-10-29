# Building Accord: High-Conviction P2P Crypto Trading with Tatum RPC and Walrus Memory on Mainnet

*Published for the Tatum × Walrus Memory ("Total Recall") Hackathon*

---

## The Problem: Why Peer-to-Peer Crypto Trades Still Feel Fragile

Every day, traders, OTC desks, and Web3 builders coordinate peer-to-peer (P2P) transactions—swapping tokens for off-chain deliverables, settling domain transfers, or conducting bespoke cross-asset trades. Despite running on verifiable blockchains, the human coordination layer around P2P crypto remains fragmented and error-prone:

1. **Scattered Agreements**: Trade terms live in ephemeral Telegram or Discord messages where edits can silently alter what was agreed.
2. **Manual & Spoofable Verification**: Participants paste transaction hashes or screenshots in chat, leaving counterparties unsure whether a transaction is still pending in the mempool, reverted on-chain, sent on the wrong network, or genuinely confirmed.
3. **Stateless Counterparty Interactions**: Every trade starts from zero context. Even if you traded with the same wallet address last week—or stated an explicit safety rule like *"always require 12 confirmations for trades above 0.5 ETH"*—standard dApps forget everything the moment a session ends.

We built **Accord** (*"Trade on agreed terms"*) to solve all three problems in one cohesive product.

---

## How Accord Works: From Versioned Agreement to Verified Settlement

Accord replaces scattered chat threads with a **Shared Trade Room** backed by three technical pillars:

### 1. Transparent Agreement Versioning & Escrow Rules (`AccordEscrow.sol`)
When a user creates a trade in Accord, they specify the asset, amount, blockchain network, both participants' wallet addresses, an independent **Neutral Arbiter**, agreed terms, and a checklist of settlement conditions. Accord generates a shareable invitation link (`/trade/ACC-...`) for the counterparty.

Crucially, **Accord never allows silent overwrites of agreed terms**. Every edit before deposit creates a new numbered `TermsVersion` with its own SHA-256 `termsHash` and automatically resets the counterparty's acceptance flag back to `AwaitingAcceptance`.

On the smart contract side, `AccordEscrow.sol` enforces:
- **Strict Role Separation**: The neutral arbiter can never be the buyer or the seller (`arbiter != buyer && arbiter != seller`).
- **Two-Step Fulfillment & Release**: Sellers confirm deliverable fulfillment (`confirmFulfillment`), and buyers authorize settlement release (`approveRelease`).
- **Dispute Locking & Mutual Settlement**: Either participant can freeze the escrow (`raiseDispute`) and submit SHA-256 hashed evidence, which can be resolved either by a mutual split (`proposeMutualSettlement` + `acceptMutualSettlement`) or by the appointed neutral arbiter (`resolveDispute`).

---

### 2. Real-Time On-Chain Truth via Tatum RPC Gateway

In Accord, **a frontend button alone can never mark a trade as funded**.

When a buyer submits a deposit transaction hash in the Shared Trade Room, Accord's server-side verification engine (`lib/tatum/client.ts`) queries the **Tatum JSON-RPC Gateway** (`https://<network>.gateway.tatum.io`) across Base Mainnet, Base Sepolia, Ethereum Mainnet, or Polygon Mainnet:

1. Calls `eth_getTransactionByHash`, `eth_getTransactionReceipt`, and `eth_blockNumber` in parallel.
2. Rejects missing hashes (`not_found`), mempool-only transactions (`pending`), and failed executions (`status === "0x0"`, `reverted`).
3. Computes exact block confirmation depth (`currentBlock - receipt.blockNumber + 1`).
4. Verifies that the sender (`from`) matches the designated Buyer and the recipient (`to`) matches the trade's escrow or seller address.

Only when Tatum RPC confirms a `0x1` receipt on the correct network does Accord transition the trade to `Funded` and check off the on-chain deposit condition. We also integrated **Tatum AI Builder (`https://ai.tatum.io`)** blueprints so developers and judges can inspect live multi-chain telemetry and verify real Base Mainnet transactions (such as Block `#53221342` Tx `0x5e628c371187d00fc4be945623e25acdac3464545512b9c03002259d95887b6c`) directly from the `/tatum-diagnostic` console.

---

### 3. Persistent Trade Context with Walrus Memory on Mainnet

To give every trade room durable institutional memory, Accord integrates **`@mysten-incubation/memwal`** targeting the **Walrus Memory Mainnet Relayer** (`https://relayer.memory.walrus.xyz`, Sui Mainnet Package `0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5`).

Throughout a trade's lifecycle, Accord writes structured memories (`sdk.remember`) and retrieves relevant historical context (`sdk.recall`) under the `accord-trades` namespace:
- `TRADE_TERMS` & `TERMS_AMENDMENT`: Every version of the agreed terms and its SHA-256 hash.
- `TRADE_ACCEPTANCE`: Counterparty sign-off timestamps.
- `ONCHAIN_VERIFICATION`: Verified Tatum RPC block numbers, confirmation counts, and transaction hashes.
- `CONDITION_UPDATE`: Off-chain deliverable attestations and SHA-256 evidence hashes.
- `DISPUTE_EVIDENCE` & `DISPUTE_RESOLUTION`: Cryptographic evidence references and neutral arbiter rulings.
- `SETTLEMENT_LESSON` & `USER_PREFERENCE`: Completed trade outcomes and explicit user safety preferences.

#### Concrete Example: How Persistent Memory Improves the User Experience

When Buyer `0xf5bd...0b75` opens `/trades/new` to set up a new trade with Seller `0x0729...97f7`, Accord automatically runs a semantic recall query against Walrus Memory before a single wei is locked. Instead of starting blind, Accord surfaces:
- That both participants previously completed Trade `ACC-2026-8812` (`0.000371 ETH` on Base Mainnet) in 28 minutes with zero disputes.
- That Buyer `0xf5bd...0b75` has a stored `USER_PREFERENCE` preferring Base Mainnet for low-latency settlement and requiring SHA-256 evidence hashes anchored before release.

Inside the Shared Trade Room, the **Accord Context Assistant** answers practical questions—such as *"Has the deposit actually been confirmed?"*, *"Which condition remains outstanding?"*, or *"What happened during our previous trade?"*—by combining live Tatum RPC receipts with retrieved Walrus Memory records.

Importantly, we describe this accurately: **Accord does not retrain an AI model or alter model weights**. Instead, it provides grounded, context-aware assistance by retrieving persistent memories from Walrus Memory and verified blockchain state from Tatum RPC.

---

## Epistemic Honesty & Security Boundaries

Building a trustworthy financial coordination tool required strict architectural boundaries:
- **Separating Verified On-Chain Facts from Participant Claims**: Blockchains can prove that `0.000371 ETH` was transferred in Base Block `#53221342`, but no blockchain can independently prove whether an off-chain parcel arrived or an API key worked. Accord labels every fact in the UI and Context Assistant with its exact epistemic source: `[Verified On-Chain via Tatum RPC]`, `[Walrus Memory Mainnet]`, or `[Participant Claim / Attestation]`.
- **AI Never Holds the Keys**: The AI assistant is strictly read-only and advisory. It can never authorize fund releases, sign transactions, or decide disputes.

---

## Lessons Learned & What's Next

Integrating **Tatum RPC** and **Walrus Memory** side by side showed how complementary real-time blockchain verification and decentralized persistent memory are:
- **Tatum RPC** answers *"What is cryptographically true on-chain right now?"*
- **Walrus Memory** answers *"What did both parties agree to, what happened in our previous trades, and what context matters for this decision?"*

Together, they transform P2P crypto trading from an anxious leap of faith into a structured, verifiable workflow where two people can truly **trade on agreed terms**.

