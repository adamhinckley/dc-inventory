import { describe, expect, it } from "vitest";
import { MissingDatabaseUrlError } from "./database-url.js";
import { createPostgresDatabase, PostgresDatabase } from "./db.js";
import { schema } from "./schema.js";

describe("PostgresDatabase", () => {
  it("registers catalog through operator-bridge tables", () => {
    expect(Object.keys(schema).sort()).toEqual(
      [
        "addOnGrants",
        "categories",
        "contacts",
        "customers",
        "exemptionCertificates",
        "flagOverrides",
        "invoiceTaxLines",
        "invoices",
        "issueReports",
        "locations",
        "operatorOutbox",
        "opsUsers",
        "orderLines",
        "orders",
        "organizations",
        "paymentApplications",
        "payments",
        "productCategories",
        "productIdentifiers",
        "productImages",
        "productPackaging",
        "products",
        "purchaseOrderLines",
        "purchaseOrders",
        "reorderPolicies",
        "sessions",
        "shipTos",
        "softwarePayments",
        "staffUsers",
        "stockMovements",
        "stockSnapshots",
        "subscriptions",
        "supplierProducts",
        "suppliers",
        "taxCommitLines",
        "taxCommits",
        "wholesaleUsers",
      ].sort(),
    );
  });

  it("fails clearly when DATABASE_URL is missing", () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => createPostgresDatabase()).toThrow(MissingDatabaseUrlError);
    } finally {
      if (previous === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previous;
      }
    }
  });

  it("pings with SELECT 1 and closes the client", async () => {
    const calls: string[] = [];
    let ended = false;
    const sql = Object.assign(
      async (strings: TemplateStringsArray) => {
        calls.push(strings.join("?"));
        return [{ "?column?": 1 }];
      },
      {
        end: async () => {
          ended = true;
        },
      },
    );

    const database = new PostgresDatabase(
      sql as unknown as ConstructorParameters<typeof PostgresDatabase>[0],
    );
    await database.ping();
    await database.close();

    expect(calls).toEqual(["SELECT 1"]);
    expect(ended).toBe(true);
  });
});

const liveUrl = process.env.DATABASE_URL?.trim();

describe.skipIf(!liveUrl)("createPostgresDatabase (live DATABASE_URL)", () => {
  it("connects and SELECT 1 when DATABASE_URL is set", async () => {
    const { createPostgresDatabase } = await import("./db.js");
    const database = createPostgresDatabase(liveUrl);
    try {
      await database.ping();
    } finally {
      await database.close();
    }
  });
});
