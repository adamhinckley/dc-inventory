import type { IWholesaleLoginAccountStatusReadPort } from "../domain/ports/wholesale-login-account-status-read.js";

export const ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS: IWholesaleLoginAccountStatusReadPort = {
  async getAccountStatus() {
    return "active";
  },
};
