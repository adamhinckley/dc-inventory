import { randomUUID } from "node:crypto";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { composeAppServices } from "../infrastructure/composition.js";
import { createDatabaseConnection } from "../infrastructure/db.js";
import {
  flagOverrides,
  softwarePayments,
  subscriptions,
} from "../infrastructure/schema.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "persistent-licensing.integration.test.ts requires DATABASE_URL; run via scripts/ci-compose-migrate-ready.sh",
  );
}

describe("persistent licensing composition", () => {
  it("shares reads and feature state across two instances and a restart", async () => {
    const tenantId = OrganizationId.parse(randomUUID());
    const subscriptionId = randomUUID();
    const paymentId = randomUUID();
    const overrideId = randomUUID();
    const writer = createDatabaseConnection(databaseUrl!);
    const periodStart = new Date("2026-08-01T00:00:00.000Z");
    const periodEnd = new Date("2026-09-01T00:00:00.000Z");
    let first: ReturnType<typeof composeAppServices> | undefined;
    let second: ReturnType<typeof composeAppServices> | undefined;
    let restarted: ReturnType<typeof composeAppServices> | undefined;

    try {
      await writer.db.insert(subscriptions).values({
        id: subscriptionId,
        tenantId,
        plan: "core",
        status: "active",
        periodStart,
        periodEnd,
      });
      await writer.db.insert(softwarePayments).values({
        id: paymentId,
        tenantId,
        subscriptionId,
        amountCents: 2500,
        currency: "USD",
        status: "succeeded",
        kind: "manual",
        occurredAt: periodStart,
        provider: "manual",
        providerRef: `manual-${paymentId}`,
      });
      await writer.db.insert(flagOverrides).values({
        id: overrideId,
        subscriptionId,
        featureName: "catalog",
        direction: "force_off",
      });

      first = composeAppServices();
      second = composeAppServices();

      await expect(
        first.licensing.listSubscriptions.execute({
          organizationId: tenantId,
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({ items: [{ id: subscriptionId, status: "active" }], total: 1 });
      await expect(
        second.licensing.listPayments.execute({
          organizationId: tenantId,
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({
        items: [{ id: paymentId, amountCents: 2500, status: "succeeded" }],
        total: 1,
      });
      await expect(first.features.isEnabled(tenantId, "catalog")).resolves.toBe(false);
      await expect(second.features.isEnabled(tenantId, "sales")).resolves.toBe(true);

      await first.database.close();
      first = undefined;
      restarted = composeAppServices();

      await expect(
        restarted.licensing.listPayments.execute({
          organizationId: tenantId,
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({ items: [{ id: paymentId }], total: 1 });
      await expect(restarted.features.isEnabled(tenantId, "catalog")).resolves.toBe(false);
    } finally {
      await first?.database.close();
      await second?.database.close();
      await restarted?.database.close();
      await writer.db
        .delete(flagOverrides)
        .where(eq(flagOverrides.subscriptionId, subscriptionId));
      await writer.db
        .delete(softwarePayments)
        .where(
          and(
            eq(softwarePayments.tenantId, tenantId),
            eq(softwarePayments.subscriptionId, subscriptionId),
          ),
        );
      await writer.db
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            eq(subscriptions.id, subscriptionId),
          ),
        );
      await writer.sql.end({ timeout: 5 });
    }
  });
});
