import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getWalletTransactions } from "@/lib/basescan";
import { runAllChecks } from "@/lib/rules";
import { getActiveApprovals, detectPermitTransactions } from "@/lib/approvals";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendTelegramAlert(chatId: number, address: string, newFlags: any[]) {
  const lines = newFlags
    .map((f) => `• <b>[${f.severity.toUpperCase()}]</b> ${f.message}`)
    .join("\n");

  const text = `🚨 <b>Sentinel Alert</b>\nWallet: <code>${address}</code>\n\n${lines}`;

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function GET(req: NextRequest) {
  try {
    // Vercel Cron passes the secret automatically — reject any other caller
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: watches, error } = await supabase
      .from("watched_wallets")
      .select("*");

    if (error) {
      console.error("Fetch watches error:", error);
      return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
    }

    const results = [];

    for (const watch of watches) {
      try {
        // Run transaction fetch and approval log scan in parallel
        const [transactions, approvalsData] = await Promise.all([
          getWalletTransactions(watch.address),
          getActiveApprovals(watch.address),
        ]);

        // Permit detection with real calldata (requires tx hashes)
        const permits = await detectPermitTransactions(watch.address, transactions);

        // Full detection suite: rules + approvals + permits
        const flags = await runAllChecks(
          transactions,
          watch.address,
          approvalsData.activeApprovals,
          permits
        );

        // Deduplicate on type + severity — catches severity escalations
        const previousFlagKeys = new Set(
          (watch.last_flags || []).map((f: any) => `${f.type}:${f.severity}`)
        );
        const newFlags = flags.filter(
          (f) => !previousFlagKeys.has(`${f.type}:${f.severity}`)
        );

        if (newFlags.length > 0) {
          if (watch.telegram_chat_id) {
            await sendTelegramAlert(watch.telegram_chat_id, watch.address, newFlags);
          }

          await supabase
            .from("watched_wallets")
            .update({
              last_flags: flags,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", watch.id);

          results.push({
            address: watch.address,
            alerted: !!watch.telegram_chat_id,
            newFlags: newFlags.length,
          });
        } else {
          await supabase
            .from("watched_wallets")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", watch.id);

          results.push({ address: watch.address, alerted: false, newFlags: 0 });
        }
      } catch (walletError) {
        // One failing wallet should not abort the entire check cycle
        console.error(`Error checking wallet ${watch.address}:`, walletError);
        results.push({ address: watch.address, error: true });
      }
    }

    return NextResponse.json({ checked: watches.length, results });
  } catch (error) {
    console.error("Monitor-check error:", error);
    return NextResponse.json({ error: "Monitor check failed" }, { status: 500 });
  }
}