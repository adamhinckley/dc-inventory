import { describe, expect, it } from "vitest";
import {
  ACME_SLUG,
  CUSTOMER_ID,
  WHOLESALE_ID,
  seedWholesaleLoginFixture,
  wholesaleLoginHarness,
} from "./support/wholesale-login-harness.js";

describe("Wholesale login vs account status (ADA-264, U10 login rows)", () => {
  const ownerIt = it;

  describe("on hold", () => {
    ownerIt("allows wholesale login", async () => {
      const h = wholesaleLoginHarness({ getAccountStatus: () => "on_hold" });
      await seedWholesaleLoginFixture(h);

      const result = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.wholesaleUserId).toBe(WHOLESALE_ID);
      expect(result.customerId).toBe(CUSTOMER_ID);

      const session = await h.resolveWholesale.execute(result.sessionId);
      expect(session).toMatchObject({
        ok: true,
        wholesaleUserId: WHOLESALE_ID,
        customerId: CUSTOMER_ID,
      });
    });
  });

  describe("inactive", () => {
    ownerIt("blocks wholesale login without leaking account status vs wrong password", async () => {
      const h = wholesaleLoginHarness({ getAccountStatus: () => "inactive" });
      await seedWholesaleLoginFixture(h);

      const inactive = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      });
      const wrongPassword = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "nope",
      });

      expect(inactive.ok).toBe(false);
      expect(wrongPassword).toEqual({ ok: false });
      expect(inactive).toEqual({ ok: false });
    });
  });

  describe("missing status", () => {
    ownerIt("blocks wholesale login when account status is null vs wrong password", async () => {
      const h = wholesaleLoginHarness({ getAccountStatus: () => null });
      await seedWholesaleLoginFixture(h);

      const missingStatus = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      });
      const wrongPassword = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "nope",
      });

      expect(missingStatus.ok).toBe(false);
      expect(wrongPassword).toEqual({ ok: false });
      expect(missingStatus).toEqual({ ok: false });
    });
  });

  describe("active", () => {
    ownerIt("allows wholesale login", async () => {
      const h = wholesaleLoginHarness({ getAccountStatus: () => "active" });
      await seedWholesaleLoginFixture(h);

      const result = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.wholesaleUserId).toBe(WHOLESALE_ID);
      expect(result.customerId).toBe(CUSTOMER_ID);

      const session = await h.resolveWholesale.execute(result.sessionId);
      expect(session).toMatchObject({
        ok: true,
        wholesaleUserId: WHOLESALE_ID,
        customerId: CUSTOMER_ID,
      });
    });
  });
});
