export const WHOLESALE_LOGIN_ACCOUNT_STATUSES = ["active", "on_hold", "inactive"] as const;

export type WholesaleLoginAccountStatus = (typeof WHOLESALE_LOGIN_ACCOUNT_STATUSES)[number];
