import type {
  CustomerId,
  InvoiceId,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import type {
  Invoice,
  InvoiceAdjustment,
  Payment,
  PaymentApplication,
  PaymentPlan,
} from "../invoice.js";
import type { PaymentId, PaymentPlanId } from "../ids.js";

export type UnnumberedInvoice = Omit<Invoice, "documentNumber">;

export type PaymentApplicationSpec = {
  readonly invoiceId: InvoiceId;
  readonly amountCents: number;
};

export type PaymentIdempotencyRecord = {
  readonly payment: Payment;
  readonly applications?: readonly PaymentApplicationSpec[];
  readonly holdRemainderAsCredit?: boolean;
  readonly invoiceId?: InvoiceId;
  readonly applicationAmountCents?: number;
};

export type IInvoiceRepository = {
  findById(organizationId: OrganizationId, id: InvoiceId): Promise<Invoice | null>;
  findByIdForPayment(
    organizationId: OrganizationId,
    id: InvoiceId,
  ): Promise<Invoice | null>;
  findByOrderId(organizationId: OrganizationId, orderId: OrderId): Promise<Invoice | null>;
  list(organizationId: OrganizationId): Promise<readonly Invoice[]>;
  save(invoice: Invoice): Promise<void>;
  insertWithNextDocumentNumber(invoice: UnnumberedInvoice): Promise<Invoice>;
  listApplications(invoiceId: InvoiceId): Promise<readonly PaymentApplication[]>;
  findPaymentByIdempotencyKey(
    organizationId: OrganizationId,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null>;
  insertPaymentWithApplication(
    payment: Payment,
    invoiceId: InvoiceId,
    applicationAmountCents: number,
  ): Promise<void>;
  insertApplication(application: PaymentApplication): Promise<void>;
};

export type IAccountingRepository = IInvoiceRepository & {
  findPaymentById(organizationId: OrganizationId, paymentId: PaymentId): Promise<Payment | null>;
  listApplicationsByPayment(paymentId: PaymentId): Promise<readonly PaymentApplication[]>;
  insertPaymentWithApplications(
    payment: Payment,
    applications: readonly PaymentApplicationSpec[],
    holdRemainderAsCredit: boolean,
  ): Promise<void>;
  updatePayment(payment: Payment): Promise<void>;
  listAdjustments(invoiceId: InvoiceId): Promise<readonly InvoiceAdjustment[]>;
  insertAdjustment(adjustment: InvoiceAdjustment): Promise<void>;
  findActivePaymentPlan(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<PaymentPlan | null>;
  findPaymentPlanById(
    organizationId: OrganizationId,
    planId: PaymentPlanId,
  ): Promise<PaymentPlan | null>;
  insertPaymentPlan(plan: PaymentPlan): Promise<void>;
  endPaymentPlan(planId: PaymentPlanId, endedAt: Date): Promise<void>;
  listPaymentsByCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<readonly Payment[]>;
};

export type IAccountingUnitOfWork = {
  readonly invoices: IInvoiceRepository;
  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T>;
};

export type AccountingUnitOfWorkWithCustomerPayments = IAccountingUnitOfWork & {
  readonly invoices: IAccountingRepository;
};

export function supportsAccountingRepository(
  repository: IInvoiceRepository,
): repository is IAccountingRepository {
  return (
    typeof (repository as IAccountingRepository).insertPaymentWithApplications === "function"
  );
}

export type CreateInvoiceRequest = {
  staffUserId: StaffUserId;
  organizationId: OrganizationId;
  orderId: OrderId;
  customerId: CustomerId;
  subtotalCents: number;
  currency: string;
};

export type RecordPaymentRequest = {
  staffUserId: StaffUserId;
  organizationId: OrganizationId;
  invoiceId: InvoiceId;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
};

export type CorrectPaymentRequest = {
  staffUserId: StaffUserId;
  organizationId: OrganizationId;
  invoiceId: InvoiceId;
  paymentId: PaymentId;
  correctionAmountCents: number;
  currency: string;
};
