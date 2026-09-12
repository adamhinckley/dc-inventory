import type { CreateCustomerUseCase } from "@dc-inventory/customers";
import {
  canStaffPerform,
  type CreateWholesaleUserUseCase,
  type StaffRole,
} from "@dc-inventory/identity";
import type { RollbackCustomerStaffForThemUseCase } from "./rollback-customer-staff-for-them.js";

type CreateCustomerRequest = Parameters<CreateCustomerUseCase["execute"]>[0];
type CreateCustomerResult = Awaited<ReturnType<CreateCustomerUseCase["execute"]>>;

export const STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS = 1_000_000;

export type CreateCustomerWithWholesaleUserRequest = CreateCustomerRequest & {
  staffRoles: readonly StaffRole[];
  wholesaleEmail?: string;
  wholesaleDisplayName?: string;
};

export type CreateCustomerWithWholesaleUserResult =
  | CreateCustomerResult
  | { ok: false; reason: "duplicate_email" | "invite_failed" };

export class CreateCustomerWithWholesaleUserUseCase {
  constructor(
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly createWholesaleUser: CreateWholesaleUserUseCase,
    private readonly rollbackCustomerStaffForThem: RollbackCustomerStaffForThemUseCase,
  ) {}

  async execute(
    input: CreateCustomerWithWholesaleUserRequest,
  ): Promise<CreateCustomerWithWholesaleUserResult> {
    const { staffRoles, wholesaleEmail, wholesaleDisplayName, ...customerInput } = input;
    const isAdmin = canStaffPerform(staffRoles, "staff_manage");

    if (
      !isAdmin &&
      (wholesaleEmail !== undefined || wholesaleDisplayName !== undefined)
    ) {
      return { ok: false, reason: "invalid" };
    }

    if (isAdmin) {
      const email = wholesaleEmail?.trim() ?? "";
      if (email.length === 0) {
        return { ok: false, reason: "invalid" };
      }
    }

    const resolvedCustomerInput =
      isAdmin && customerInput.creditLimitCents === undefined
        ? {
            ...customerInput,
            creditLimitCents: STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS,
          }
        : customerInput;

    const customerResult = await this.createCustomer.execute(resolvedCustomerInput);
    if (!customerResult.ok) {
      return customerResult;
    }

    if (!isAdmin) {
      return customerResult;
    }

    const normalizedWholesaleEmail = wholesaleEmail!.trim();
    const displayName =
      wholesaleDisplayName !== undefined && wholesaleDisplayName.trim().length > 0
        ? wholesaleDisplayName.trim()
        : customerResult.customer.name;

    const wholesaleResult = await this.createWholesaleUser.execute({
      organizationId: customerInput.organizationId,
      customerId: customerResult.customer.id,
      email: normalizedWholesaleEmail,
      displayName,
    });

    if (!wholesaleResult.ok) {
      if (
        wholesaleResult.reason === "duplicate_email" ||
        wholesaleResult.reason === "invalid" ||
        wholesaleResult.reason === "invite_failed"
      ) {
        await this.rollbackCustomerStaffForThem.execute({
          organizationId: customerInput.organizationId,
          customerId: customerResult.customer.id,
          wholesaleEmail: normalizedWholesaleEmail,
        });
      }
      if (wholesaleResult.reason === "invalid") {
        return { ok: false, reason: "invalid" };
      }
      return { ok: false, reason: wholesaleResult.reason };
    }

    return customerResult;
  }
}
