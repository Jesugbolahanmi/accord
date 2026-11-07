import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { tradeService } from "@/lib/trades/store";
import { walrusMemory } from "@/lib/walrus/memory";

export const dynamic = "force-dynamic";

const faqItems = [
  {
    question: "What is Accord?",
    answer:
      "Accord helps two people make a crypto trade with clear shared terms and a record of what happened. Both sides can review the amount, network, responsibilities, and deadlines before moving forward.",
  },
  {
    question: "Who holds the money?",
    answer:
      "Accord does not custody funds. For a new Base Sepolia ETH trade, the buyer deposits into the Accord escrow contract, and the buyer can release funds after seller fulfillment is confirmed. This is testnet-only; never use real funds.",
  },
  {
    question: "How does Accord help protect a trade?",
    answer:
      "Participants sign trade actions with their wallets, and Base Sepolia escrow transactions are checked against the configured v2 contract and trade terms. Off-chain delivery still relies on participant evidence. This prototype is unaudited and does not guarantee a dispute outcome.",
  },
  {
    question: "How do I know if payment was received?",
    answer:
      "For supported Base Sepolia ETH escrow trades, the buyer deposits through the trade room. Accord checks the escrow transaction, contract event, trade terms, and confirmations before updating the record. A transaction ID alone is not proof of an escrow deposit.",
  },
  {
    question: "What if the other person does not complete their part?",
    answer:
      "You can record a disagreement and evidence in Accord. The current app does not enforce an on-chain arbitration decision. A seller can initiate a contract refund where the escrow state permits it; read the contract and trade status carefully. Outcomes are not guaranteed.",
  },
  {
    question: "Can we change the terms after creating a trade?",
    answer:
      "Either person can propose updated terms while the trade is still eligible for changes. The update is saved as a new version, and both people must review and accept it before the trade proceeds on those terms.",
  },
  {
    question: "Can I find my trade history later?",
    answer:
      "Yes. The Memory Box collects saved agreements, payment checks, delivery updates, dispute history, and trade outcomes. A record is only described as confirmed on Walrus when the app has verified that save; other records may be marked as pending.",
  },
  {
    question: "Do I need to understand blockchain to use Accord?",
    answer:
      "No. Follow the steps and status messages in the trade room. Accord explains what is expected next, while showing the selected network and payment status when those details matter.",
  },
  {
    question: "Is Accord live?",
    answer:
      "Accord is an unaudited prototype. Wallet-authorized escrow is limited to Base Sepolia ETH and is not for real funds. Mainnet escrow is not currently available.",
  },
];

const tradeSteps = [
  {
    number: "01",
    title: "Create a trade",
    description:
      "Choose whether you are buying or selling, then enter the amount and the other person’s wallet address.",
  },
  {
    number: "02",
    title: "Agree on the terms",
    description:
      "Write down what each person will do and by when. Both people must accept the same terms before moving forward.",
  },
  {
    number: "03",
    title: "Create escrow and deposit",
    description:
      "For a new Base Sepolia ETH trade, the buyer creates the contract escrow and deposits the agreed test ETH. Accord verifies the event before recording the deposit. Never use real funds.",
  },
  {
    number: "04",
    title: "Complete the agreed exchange",
    description:
      "The person responsible for delivery completes their part. The other person reviews it and records the required confirmation. Accord does not independently verify off-network goods or services.",
  },
  {
    number: "05",
    title: "Finish and keep the record",
    description:
      "The seller confirms fulfillment and the buyer approves release from escrow. Accord checks the transaction and keeps a record in the trade room.",
  },
];

export default async function HomePage() {
  const trades = await tradeService.listTrades();
  const relayerHealth = await walrusMemory.checkRelayerHealth();
  const latestTrade = trades[0];

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
              <span>Clear terms for crypto trades</span>
            </div>

            <div className="space-y-5">
              <h1 className="font-editorial text-[42px] sm:text-[56px] lg:text-[64px] leading-[1.03] tracking-[-0.025em] font-normal text-[#F4F2ED]">
                Trade on{" "}
                <span className="italic font-normal text-[#D6B882]">
                  agreed terms.
                </span>
              </h1>

              <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#A6A39B] max-w-[54ch]">
                Agree on the details before you trade. Accord gives both people one place to review
                the terms, check payment progress, record delivery, and see what needs to happen
                next.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/trades/new"
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-[3px] bg-[#C5A46D] hover:bg-[#D6B882] text-[#090A0C] text-[13px] font-medium tracking-[-0.01em] transition-colors"
              >
                <span>Start a trade</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/trades"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-[3px] bg-[#0E1014] hover:bg-[#13161C] text-[#F4F2ED] border border-white/[0.12] text-[13px] transition-colors"
              >
                <span>Browse trades</span>
                <span className="font-mono-tabular text-[11px] text-[#C5A46D]">
                  {trades.length} saved
                </span>
              </Link>
            </div>

            {/* Trade status at a glance */}
            <dl className="pt-8 border-t border-white/[0.07] grid grid-cols-3 gap-6">
              <div>
                <dt className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                  Payment checks
                </dt>
                <dd className="mt-1 text-[13px] font-mono-tabular text-[#F4F2ED]">
                  Network status
                </dd>
                <dd className="text-[11px] text-[#6E6C65] mt-0.5">
                  Transaction details are checked
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                  Saved trade records
                </dt>
                <dd className="mt-1 text-[13px] font-mono-tabular text-[#F4F2ED]">
                  {relayerHealth.mainnetWritesEnabled
                    ? "Online record storage"
                    : "Accord Memory Box"}
                </dd>
                <dd
                  className={`text-[11px] mt-0.5 ${
                    relayerHealth.mainnetWritesEnabled
                      ? "text-[#5CE0A8]"
                      : "text-[#C5A46D]"
                  }`}
                >
                  {relayerHealth.mainnetWritesEnabled
                    ? `${relayerHealth.writesConfirmedCount} records confirmed online`
                    : relayerHealth.relayerReachable
                    ? "Online storage needs setup"
                    : "Saved locally · online save pending"}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                  Clear agreement history
                </dt>
                <dd className="mt-1 text-[13px] font-mono-tabular text-[#F4F2ED]">
                  Changes are recorded
                </dd>
                <dd className="text-[11px] text-[#6E6C65] mt-0.5">
                  Both people review new terms
                </dd>
              </div>
            </dl>
          </div>

          {/* Right Column: Latest saved trade */}
          <div className="lg:col-span-6">
            <div className="surface-instrument rounded-[4px] overflow-hidden">
              <div className="px-5 py-3.5 bg-[#11141B] border-b border-white/[0.08] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono-tabular text-[12px] font-medium text-[#F4F2ED]">
                    {latestTrade?.reference || "Trade activity"}
                  </span>
                  <span className="text-white/20">/</span>
                  <span className="font-mono-tabular text-[11px] text-[#A6A39B]">
                    {latestTrade ? latestTrade.network : "Live records"}
                  </span>
                </div>
                {latestTrade && <span className="status-pill">{latestTrade.status}</span>}
              </div>
              <div className="p-6 min-h-56 flex flex-col justify-between gap-8">
                {latestTrade ? (
                  <>
                    <div>
                      <p className="text-[11px] font-mono-tabular uppercase tracking-[0.08em] text-[#6E6C65]">
                        Latest saved trade
                      </p>
                      <p className="mt-3 font-mono-tabular text-[28px] leading-none text-[#F4F2ED]">
                        {latestTrade.amount}{" "}
                        <span className="text-[16px] text-[#A6A39B]">{latestTrade.asset}</span>
                      </p>
                      <p className="mt-3 text-[13px] text-[#A6A39B]">
                        Updated {new Date(latestTrade.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Link
                      href={`/trade/${latestTrade.reference}`}
                      className="inline-flex items-center gap-1 text-[#C5A46D] hover:text-[#D6B882] text-[12px]"
                    >
                      <span>Open trade record</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </>
                ) : (
                  <div>
                    <p className="text-[16px] text-[#F4F2ED]">No trade records yet</p>
                    <p className="mt-2 text-[13px] text-[#A6A39B]">
                      Trades created in Accord will appear here.
                    </p>
                  </div>
                )}
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
              <span>How Accord helps</span>
            </div>
            <h2 className="font-editorial text-[30px] sm:text-[36px] leading-[1.12] tracking-[-0.02em] text-[#F4F2ED]">
              See the agreed terms, payment progress, and next step in one place.
            </h2>
            <p className="text-[14px] leading-[1.7] text-[#A6A39B]">
              Accord keeps trade details and updates together. It checks crypto payments against
              the selected network, while delivery of goods or services is confirmed by the people
              involved.
            </p>
          </div>

          <div className="lg:col-span-7 divide-y divide-white/[0.08] border-t border-b border-white/[0.08]">
            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                I / Agreement
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Shared terms everyone can review
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  If someone suggests a change, Accord keeps the earlier version and asks both
                  people to review and accept the updated terms before proceeding.
                </p>
              </div>
            </div>

            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                II / Verification
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Check payment before marking it received
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  A transaction ID alone does not confirm a payment. Accord checks the payment on
                  the selected network and compares it with the trade details before showing it as
                  confirmed.
                </p>
              </div>
            </div>

            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                III / Settlement
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Payment checks and delivery confirmations are different
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  Accord can check a crypto payment on its network. The people trading must confirm
                  delivery of anything outside the network, such as a service or physical item.
                  Accord records what each person reports; it cannot independently inspect those
                  items.
                </p>
              </div>
            </div>

            <div className="py-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3 font-mono-tabular text-[12px] text-[#C5A46D]">
                IV / Memory
              </div>
              <div className="sm:col-span-9 space-y-2">
                <h3 className="text-[16px] font-medium text-[#F4F2ED] tracking-[-0.01em]">
                  Keep a record of the trade
                </h3>
                <p className="text-[14px] leading-[1.65] text-[#A6A39B]">
                  Important details—agreements, payment checks, delivery updates, and outcomes—can
                  be found later in the Memory Box. Records are clearly marked when an online save
                  has not yet been confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 / TRADE GUIDE */}
      <section id="how-it-works" className="py-20 lg:py-24 border-t border-white/[0.07]">
        <div className="max-w-3xl space-y-3 pb-10">
          <div className="flex items-center gap-3 text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#A6A39B]">
            <span className="text-[#C5A46D]">03</span>
            <span className="w-6 h-px bg-white/[0.15]" />
            <span>How to use Accord</span>
          </div>
          <h2 className="font-editorial text-[32px] sm:text-[40px] leading-[1.1] tracking-[-0.02em] text-[#F4F2ED]">
            Your first trade, made simple.
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-[1.7] text-[#A6A39B]">
            From agreeing on the terms to completing the trade, here’s how Accord works.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-5 border-t border-white/[0.1]">
          {tradeSteps.map((step) => (
            <li
              key={step.number}
              className="py-6 md:py-5 md:pr-5 md:pl-4 md:first:pl-0 border-b md:border-b-0 md:border-r border-white/[0.1] last:border-r-0"
            >
              <span className="font-mono-tabular text-[11px] text-[#C5A46D]">
                STEP {step.number}
              </span>
              <h3 className="mt-3 text-[16px] font-medium text-[#F4F2ED]">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.7] text-[#A6A39B]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl text-[12px] leading-[1.7] text-[#6E6C65]">
          Base Sepolia ETH trades can use wallet-authorized v2 escrow. This prototype is unaudited,
          testnet-only, and must not be used to coordinate a real-money trade.
        </p>
      </section>

      {/* 04 / FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-20 lg:py-24 border-t border-white/[0.07]">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#A6A39B]">
              <span className="text-[#C5A46D]">04</span>
              <span className="w-6 h-px bg-white/[0.15]" />
              <span>Good to know</span>
            </div>
            <h2 className="font-editorial text-[32px] sm:text-[40px] leading-[1.1] tracking-[-0.02em] text-[#F4F2ED]">
              Questions people ask first.
            </h2>
            <p className="text-[14px] leading-[1.7] text-[#A6A39B]">
              Straight answers about payments, trade terms, and what Accord can—and cannot—do.
            </p>
          </div>

          <div className="lg:col-span-3 border-t border-white/[0.1]">
            {faqItems.map((item) => (
              <details key={item.question} className="group border-b border-white/[0.1]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[15px] sm:text-[16px] font-medium text-[#F4F2ED] [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="font-mono-tabular text-[22px] font-normal text-[#C5A46D] transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[68ch] pb-5 pr-8 text-[13px] sm:text-[14px] leading-[1.75] text-[#A6A39B]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 05 / LIVE AGREEMENTS REGISTER */}
      <section className="py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/[0.1]">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#A6A39B] mb-2">
              <span className="text-[#C5A46D]">05</span>
              <span className="w-6 h-px bg-white/[0.15]" />
              <span>Trade list</span>
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
