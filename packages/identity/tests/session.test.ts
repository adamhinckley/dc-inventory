import { OrganizationId, SessionId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  SESSION_TOUCH_DEBOUNCE_MS,
  shouldTouchSessionLastSeen,
  type Session,
} from "../src/domain/session.js";

const BASE = new Date("2026-08-23T02:00:00.000Z");

function session(lastSeenAt: Date): Session {
  return {
    id: SessionId.parse("550e8400-e29b-41d4-a716-446655440010"),
    audience: "staff",
    organizationId: OrganizationId.DEFAULT,
    staffUserId: StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001"),
    wholesaleUserId: null,
    opsUserId: null,
    customerId: null,
    createdAt: BASE,
    lastSeenAt,
  };
}

describe("shouldTouchSessionLastSeen", () => {
  it("does not touch at exactly five minutes", () => {
    const lastSeen = BASE;
    const now = new Date(BASE.getTime() + SESSION_TOUCH_DEBOUNCE_MS);
    expect(shouldTouchSessionLastSeen(session(lastSeen), now)).toBe(false);
  });

  it("touches when last seen is older than five minutes", () => {
    const lastSeen = BASE;
    const now = new Date(BASE.getTime() + SESSION_TOUCH_DEBOUNCE_MS + 1);
    expect(shouldTouchSessionLastSeen(session(lastSeen), now)).toBe(true);
  });
});
