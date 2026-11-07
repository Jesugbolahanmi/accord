import assert from "node:assert/strict";
import test from "node:test";

type StoredRow = {
  id: string;
  reference: string;
  trade: Record<string, unknown>;
  revision: number;
  created_at: string;
  updated_at: string;
};

test("Supabase trade storage is shared across service instances and rejects stale writes", async () => {
  const rows: StoredRow[] = [];
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousTestMode = process.env.ACCORD_TEST_MODE;
  process.env.SUPABASE_URL = "https://accord-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  delete process.env.ACCORD_TEST_MODE;

  let concurrentReads = false;
  let readCount = 0;
  let releaseReads!: () => void;
  let readBarrier = new Promise<void>((resolve) => {
    releaseReads = resolve;
  });

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method || "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const idFilter = url.searchParams.get("id")?.replace(/^eq\./, "");
    const referenceFilter = url.searchParams.get("reference")?.replace(/^eq\./, "");
    const revisionFilter = Number(url.searchParams.get("revision")?.replace(/^eq\./, ""));

    if (method === "GET") {
      if (concurrentReads && idFilter) {
        readCount += 1;
        if (readCount === 2) {
          concurrentReads = false;
          releaseReads();
        }
        await readBarrier;
      }
      const found = rows.filter(
        (row) =>
          (!idFilter || row.id === idFilter) &&
          (!referenceFilter || row.reference === referenceFilter)
      );
      if (headers.get("accept")?.includes("vnd.pgrst.object")) {
        return found.length === 1
          ? Response.json(found[0])
          : Response.json(
              { code: "PGRST116", message: "No rows found", details: "The result contains 0 rows" },
              { status: 406 }
            );
      }
      return Response.json(found);
    }

    const body = JSON.parse(String(init?.body || "{}")) as
      | Partial<StoredRow>
      | Partial<StoredRow>[];
    if (method === "POST") {
      const inserts = Array.isArray(body) ? body : [body];
      for (const item of inserts) {
        if (rows.some((row) => row.id === item.id || row.reference === item.reference)) {
          return Response.json({ code: "23505", message: "duplicate key" }, { status: 409 });
        }
        rows.push(item as StoredRow);
      }
      const responseBody = headers.get("accept")?.includes("vnd.pgrst.object")
        ? inserts[0]
        : inserts;
      return Response.json(responseBody, { status: 201 });
    }

    if (method === "PATCH") {
      const row = rows.find(
        (item) => item.id === idFilter && item.revision === revisionFilter
      );
      if (!row) return Response.json([]);
      Object.assign(row, body);
      return Response.json([row]);
    }

    return Response.json({ message: `Unexpected method ${method}` }, { status: 405 });
  };

  try {
    const { TradeService } = await import("../lib/trades/store");
    const firstInstance = new TradeService();
    const secondInstance = new TradeService();
    const buyer = "0xf5bdce6674389d937df8ad3363c10fc3fa060b75";
    const seller = "0x0729e2a4716d9f7dd17858d5d504426d228697f7";
    const trade = await firstInstance.createTrade({
      creator: buyer,
      creatorRole: "buyer",
      buyer,
      seller,
      arbiter: "0x12c4E5496F5bAbE7F9159958742D2635B1a084c7",
      asset: "ETH",
      amount: "0.001",
      network: "base-sepolia",
      agreedTerms: "Shared storage test trade",
      conditions: [],
    });

    assert.equal((await secondInstance.getTrade(trade.reference))?.id, trade.id);
    assert.equal((await secondInstance.listTrades(buyer)).length, 1);
    await secondInstance.acceptTerms(trade.id, seller);
    assert.equal((await firstInstance.getTrade(trade.id))?.status, "AwaitingDeposit");

    readCount = 0;
    concurrentReads = true;
    readBarrier = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const results = await Promise.allSettled([
      firstInstance.submitPaymentReference(trade.id, buyer, `0x${"11".repeat(32)}`),
      secondInstance.submitPaymentReference(trade.id, buyer, `0x${"22".repeat(32)}`),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.match(String(rejected.reason), /changed in another session/);
    assert.equal(rows[0].revision, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    if (previousTestMode === undefined) delete process.env.ACCORD_TEST_MODE;
    else process.env.ACCORD_TEST_MODE = previousTestMode;
  }
});
