# Accord: A Testnet Prototype for Shared Trade Agreements

Accord is a prototype for coordinating peer-to-peer crypto trades with versioned terms, wallet-authorized actions, escrow events, and a shared record of trade activity.

> **Scope and safety:** Accord's escrow flow is limited to Base Sepolia ETH. The contract has not had an independent security audit. It is not approved for mainnet or real funds.

## What the prototype does

- Saves agreement terms and amendments as versions, requiring both participants to accept the current version before proceeding.
- Uses wallet signatures to authorize trade actions and binds those signatures to the application origin and trade state.
- Supports Base Sepolia ETH escrow interactions. The server checks contract version, trade terms, transaction events, and confirmations before updating the trade record.
- Uses Tatum RPC for network and transaction diagnostics. A successful RPC transaction check by itself is not proof of an Accord escrow deposit.
- Saves trade records in Supabase for hosted deployments. Walrus Memory writes are shown as confirmed only after the application verifies persistence; unconfirmed records remain marked pending.

## What it does not do

- Accord is not audited, and its contract is not deployed for Accord escrow on Base Mainnet.
- It does not independently verify physical delivery, external services, or other off-chain conditions.
- A recorded disagreement is not a legally binding arbitration service.
- The application no longer seeds fabricated showcase trades or historical memory records. Activity and record counts shown in the interface come from saved application data.

## Mainnet readiness

Do not use Accord with real funds. Mainnet support would require, at minimum, an independent contract and application security audit, a reviewed mainnet deployment, production incident and key-management procedures, and end-to-end testing against the intended production infrastructure. These steps have not been completed.

The current prototype is intended for demonstration and testing on Base Sepolia only.
