import type { CreateCustomerUseCase, Customer } from "@dc-inventory/customers";
import {
  canStaffPerform,
  type CreateWholesaleUserUseCase,
  type StaffRole,
} from "@dc-inventory/identity";

type CreateCustomerRequest = Parameters<CreateCustomerUseCase["execute"]>[0];
type CreateCustomerResult = Awaited<ReturnType<CreateCustomerUseCase["execute"]>>;

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

    const customerResult = await this.createCustomer.execute(customerInput);
    if (!customerResult.ok) {
      return customerResult;
    }

    if (!isAdmin) {
      return customerResult;
    }

    const displayName =
      wholesaleDisplayName !== undefined && wholesaleDisplayName.trim().length > 0
        ? wholesaleDisplayName.trim()
        : customerResult.customer.name;

    const wholesaleResult = await this.createWholesaleUser.execute({
      organizationId: customerInput.organizationId,
      customerId: customerResult.customer.id,
      email: wholesaleEmail!.trim(),
      displayName,
    });

    if (!wholesaleResult.ok) {
      return { ok: false, reason: wholesaleResult.reason };
    }

    return customerResult;
  }
}
