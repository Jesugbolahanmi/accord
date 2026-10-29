import Link from "next/link";
import { ArrowUpRight, ArrowRight, Check } from "lucide-react";
import { tradeService } from "@/lib/trades/store";
import { walrusMemory } from "@/lib/walrus/memory";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await tradeService.seedInitialShowcaseTrades();
  await walrusMemory.seedDemonstrationMemories();

  const trades = tradeService.listTrades();
  const relayerHealth = await walrusMemory.checkRelayerHealth();
  const specimenTrade =
    trades.find((t) => t.reference === "ACC-2026-8812") || trades[0];

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8">
      {/* 01 / ART-DIRECTED HERO */}
      <section className="pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-white/[0.07]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-start">
          {/* Left Column: Editorial Headline & Narrative */}
          <div className="lg:col-span-6 lg:pr-6 space-y-8">
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#A6A39B]">
              <span className="text-[#C5A46D]">01</span>
              <span className="w-6 h-px bg-white/[0.15]" />
              <span>Peer-to-Peer Crypto Settlement Infrastructure</span>
            </div>

            <div className="space-y-5">
              <h1 className="font-editorial text-[42px] sm:text-[56px] lg:text-[64px] leading-[1.03] tracking-[-0.025em] font-normal text-[#F4F2ED]">
                Trade on{" "}
                <span className="italic font-normal text-[#D6B882]">
                  agreed terms.
                </span>
              </h1>

              <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#A6A39B] max-w-[54ch]">
                Peer-to-peer crypto trades usually happen across scattered chat threads,
                unverified transaction hashes, and manual guesswork. Accord binds the written
                agreement, live on-chain verification, and persistent counterparty memory into a
                single settlement instrument.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/trades/new"
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[13px] font-medium tracking-[-0.01em] transition-colors"
              >
                <span>Draft a Trade Agreement</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/trade/ACC-2026-8812"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-[3px] bg-[#0E1014] hover:bg-[#13161C] text-[#F4F2ED] border border-white/[0.12] text-[13px] transition-colors"
              >
                <span>Inspect Live Room</span>
                <span className="font-mono-tabular text-[11px] text-[#C5A46D]">
                  ACC-2026-8812
                </span>
              </Link>
            </div>

            {/* Quiet Technical Ledger Strip */}
            <dl className="pt-8 border-t border-white/[0.07] grid grid-cols-3 gap-6">
              <div>
                <dt className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                  On-Chain Truth
                </dt>
                <dd className="mt-1 text-[13px] font-mono-tabular text-[#F4F2ED]">
                  Tatum JSON-RPC
                </dd>
                <dd className="text-[11px] text-[#6E6C65] mt-0.5">
                  Receipt &amp; block depth proof
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                  Memory Layer
                </dt>
                <dd className="mt-1 text-[13px] font-mono-tabular text-[#F4F2ED]">
                  Walrus Mainnet
                </dd>
                <dd className="text-[11px] text-[#6E6C65] mt-0.5">
                  Relayer{" "}
                  {relayerHealth.status === "ok" ? "online (200 OK)" : "configured"}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                  Term Integrity
                </dt>
                <dd className="mt-1 text-[13px] font-mono-tabular text-[#F4F2ED]">
                  SHA-256 Versioned
                </dd>
                <dd className="text-[11px] text-[#6E6C65] mt-0.5">
                  Edits reset prior sign-off
                </dd>
              </div>
            </dl>
          </div>

          {/* Right Column: Authentic Trade Agreement Specimen Sheet */}
          <div className="lg:col-span-6">
            <div className="surface-instrument rounded-[4px] overflow-hidden">
              {/* Instrument Header Bar */}
              <div className="px-5 py-3.5 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono-tabular text-[12px] font-medium text-[#F4F2ED]">
                    {specimenTrade?.reference || "ACC-2026-8812"}
                  </span>
                  <span className="text-white/20">/</span>
                  <span className="font-mono-tabular text-[11px] text-[#A6A39B]">
                    Base Mainnet (Chain 8453)
                  </span>
                </div>
                <span className="status-pill status-pill-brass">
                  {specimenTrade?.status || "AwaitingDeposit"}
                </span>
              </div>

              {/* Principal Value & Counterparties */}
              <div className="p-6 border-b border-white/[0.07] grid grid-cols-1 sm:grid-cols-12 gap-6 items-baseline">
                <div className="sm:col-span-5">
                  <div className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                    Settlement Principal
                  </div>
                  <div className="mt-1.5 font-mono-tabular text-[28px] leading-none font-medium text-[#F4F2ED] tracking-[-0.02em]">
                    0.000371 <span className="text-[16px] text-[#A6A39B]">ETH</span>
                  </div>
                  <div className="mt-2 text-[11px] font-mono-tabular text-[#6E6C65]">
                    Version 1 · Bilateral Sign-Off Complete
                  </div>
                </div>

                <div className="sm:col-span-7 grid grid-cols-2 gap-4 pt-3 sm:pt-0 sm:border-l sm:border-white/[0.07] sm:pl-6">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#6E6C65]">
                      <span>BUYER</span>
                      <span className="text-[#5CE0A8]">Signed</span>
                    </div>
                    <div className="mt-1 font-mono-tabular text-[12px] text-[#F4F2ED]">
                      0xf5bdce…60b75
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#6E6C65]">
                      <span>SELLER</span>
                      <span className="text-[#5CE0A8]">Signed</span>
                    </div>
                    <div className="mt-1 font-mono-tabular text-[12px] text-[#F4F2ED]">
                      0x0729e2…697f7
                    </div>
                  </div>
                </div>
              </div>

              {/* Agreed Terms Clause */}
              <div className="px-6 py-4 border-b border-white/[0.07] bg-[#0A0C0F]">
                <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#6E6C65] mb-1.5">
                  <span>AGREED TERMS — CLAUSE V1</span>
                  <span>
                    SHA-256: {specimenTrade?.termsHash?.slice(0, 14) || "0x9d4e2a81c4"}…
                  </span>
                </div>
                <p className="text-[13px] leading-[1.6] text-[#D8D5CE]">
                  {specimenTrade?.agreedTerms}
                </p>
              </div>

              {/* Conditions Matrix */}
              <div className="divide-y divide-white/[0.06]">
                <div className="px-6 py-3 flex items-center justify-between gap-4 text-[12px]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular text-[11px] text-[#6E6C65]">01</span>
                    <span className="text-[#F4F2ED]">Base Mainnet Deposit Receipt</span>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-[#5CE0A8]">
                    On-Chain · Tatum RPC
                  </span>
                </div>

                <div className="px-6 py-3 flex items-center justify-between gap-4 text-[12px]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular text-[11px] text-[#6E6C65]">02</span>
                    <span className="text-[#F4F2ED]">Signed API Bundle Delivery</span>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-[#A6A39B]">
                    Off-Chain · SHA-256 Attestation
                  </span>
                </div>

                <div className="px-6 py-3 flex items-center justify-between gap-4 text-[12px]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular text-[11px] text-[#6E6C65]">03</span>
                    <span className="text-[#F4F2ED]">Buyer Key Validation &amp; Release Sign-Off</span>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-[#A6A39B]">
                    Participant Sign-Off
                  </span>
                </div>
              </div>

              {/* Verifiable Base Mainnet Transaction Footer */}
              <div className="px-6 py-3.5 bg-[#11141B] border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono-tabular">
                <div className="text-[#A6A39B] truncate">
                  Verifiable Base Tx:{" "}
                  <span className="text-[#F4F2ED]">0x5e628c371187d00fc4be94…87b6c</span> (Block
                  #53221342)
                </div>
                <Link
                  href="/trade/ACC-2026-8812"
                  className="inline-flex items-center gap-1 text-[#C5A46D] hover:text-[#D6B882] shrink-0"
                >
                  <span>Open Room &amp; Verify</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 / ARCHITECTURAL NARRATIVE — ASYMMETRICAL EDITORIAL LEDGER */}
      <section className="py-20 lg:py-24 border-b border-white/[0.07]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24 self-start">
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#A6A39B]">
              <span className="text-[#C5A46D]">02</span>
              <span className="w-6 h-px bg-white/[0.15]" />
              <span>Operational Architecture</span>
            </div>
            <h2 className="font-editorial text-[30px] sm:text-[36px] leading-[1.12] tracking-[-0.02em] text-[#F4F2ED]">
              Designed around what can be proved, and honest about what cannot.
            </h2>
            <p className="text-[14px] leading-[1.7] text-[#A6A39B]">
              A serious settlement tool never pretends a button click equals a blockchain
              confirmation, and never claims a smart contract can independently see an off-chain
              delivery. Accord separates every step by its exact evidentiary standard.
            </p>
          </div>

          <div className="lg:col-span-7 divide-y divide-white/[0.08] border-t border-b border-white/[0.08]">
            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                I / Agreement
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Versioned terms that cannot be silently overwritten
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  When a participant proposes a change to the trade terms, Accord increments the
                  version number, computes a new SHA-256 digest, preserves the prior wording in the
                  audit trail, and resets counterparty acceptance until the new version is reviewed
                  and signed.
                </p>
              </div>
            </div>

            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                II / Verification
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Server-side Tatum RPC receipt verification
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  A trade room can never be marked funded by a UI toggle alone. Accord queries the
                  Tatum JSON-RPC Gateway (<code className="font-mono-tabular text-[12px] text-[#F4F2ED]">eth_getTransactionReceipt</code>,{" "}
                  <code className="font-mono-tabular text-[12px] text-[#F4F2ED]">eth_getTransactionByHash</code>, and{" "}
                  <code className="font-mono-tabular text-[12px] text-[#F4F2ED]">eth_blockNumber</code>) to verify execution status (<code className="font-mono-tabular text-[12px] text-[#5CE0A8]">0x1</code>), block confirmation depth, sender, recipient, and exact wei transferred.
                </p>
              </div>
            </div>

            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                III / Settlement
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Explicit separation of on-chain proofs and off-chain attestations
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  On-chain deposit conditions unlock only when Tatum RPC confirms a mined receipt.
                  Off-chain deliverables (such as API credentials, domain handovers, or physical
                  shipments) require signed participant attestations with SHA-256 evidence hashes
                  and neutral third-party arbitration (<code className="font-mono-tabular text-[12px] text-[#F4F2ED]">arbiter != buyer &amp;&amp; arbiter != seller</code>) if disputed.
                </p>
              </div>
            </div>

            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                IV / Memory
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Persistent counterparty context via Walrus Memory
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  Accord integrates <code className="font-mono-tabular text-[12px] text-[#F4F2ED]">@mysten-incubation/memwal</code> to store and recall agreed terms, verified transaction outcomes, dispute rulings, and explicit user safety preferences across sessions—answering practical settlement questions without ever allowing AI to authorize releases or decide disputes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 / LIVE AGREEMENTS REGISTER */}
      <section className="py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/[0.1]">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#A6A39B] mb-2">
              <span className="text-[#C5A46D]">03</span>
              <span className="w-6 h-px bg-white/[0.15]" />
              <span>Active Settlement Register</span>
            </div>
            <h2 className="font-editorial text-[28px] sm:text-[32px] leading-tight text-[#F4F2ED]">
              Open Trade Agreements
            </h2>
          </div>

          <div className="flex items-center gap-4 text-[12px] font-mono-tabular">
            <Link
              href="/trades"
              className="text-[#A6A39B] hover:text-[#F4F2ED] transition-colors"
            >
              View Full Register ({trades.length})
            </Link>
            <Link
              href="/trades/new"
              className="inline-flex items-center gap-1.5 text-[#C5A46D] hover:text-[#D6B882] transition-colors"
            >
              <span>+ Draft New Agreement</span>
            </Link>
          </div>
        </div>

        <div className="divide-y divide-white/[0.07] border-b border-white/[0.07]">
          {trades.map((trade) => {
            const completedCount = trade.conditions.filter((c) => c.completed).length;
            const totalCount = trade.conditions.length;
            const versionCount = trade.termsVersions?.length || 1;

            return (
              <Link
                key={trade.id}
                href={`/trade/${trade.reference}`}
                className="group py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center hover:bg-white/[0.015] transition-colors px-2 -mx-2"
              >
                <div className="lg:col-span-3 flex items-center gap-3">
                  <span className="font-mono-tabular text-[13px] font-medium text-[#F4F2ED] group-hover:text-[#D6B882] transition-colors">
                    {trade.reference}
                  </span>
                  <span
                    className={`status-pill ${
                      trade.status === "Completed" || trade.status === "Funded"
                        ? "status-pill-verified"
                        : trade.status === "Disputed"
                        ? "status-pill-danger"
                        : "status-pill-brass"
                    }`}
                  >
                    {trade.status}
                  </span>
                </div>

                <div className="lg:col-span-2 font-mono-tabular text-[14px] text-[#F4F2ED]">
                  {trade.amount} <span className="text-[#A6A39B] text-[12px]">{trade.asset}</span>
                  <div className="text-[11px] text-[#6E6C65]">{trade.network}</div>
                </div>

                <div className="lg:col-span-4 text-[13px] text-[#A6A39B] line-clamp-1">
                  {trade.agreedTerms}
                </div>

                <div className="lg:col-span-2 font-mono-tabular text-[11px] text-[#A6A39B] flex lg:flex-col justify-between gap-1">
                  <span>
                    Clauses: {completedCount}/{totalCount} fulfilled
                  </span>
                  <span className="text-[#6E6C65]">
                    Terms v{versionCount} ·{" "}
                    {trade.buyerAccepted && trade.sellerAccepted ? (
                      <span className="text-[#5CE0A8]">Bilateral ✓</span>
                    ) : (
                      "Awaiting Counterparty"
                    )}
                  </span>
                </div>

                <div className="lg:col-span-1 flex justify-end">
                  <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#A6A39B] group-hover:text-[#F4F2ED]">
                    <span>Open</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
