import type {
  CustomerId,
  InvoiceId,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { Payment, PaymentApplication } from "../invoice.js";
import type { PaymentId } from "../ids.js";
import type { Invoice } from "../invoice.js";

export type UnnumberedInvoice = Omit<Invoice, "documentNumber">;

export type PaymentIdempotencyRecord = {
  readonly payment: Payment;
  readonly invoiceId: InvoiceId;
  readonly applicationAmountCents: number;
};

export type IInvoiceRepository = {
  findById(organizationId: OrganizationId, id: InvoiceId): Promise<Invoice | null>;
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

export type IAccountingUnitOfWork = {
  readonly invoices: IInvoiceRepository;
  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T>;
};

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
