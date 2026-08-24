import type {
  CustomerId,
  InvoiceId,
  OrderId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { Payment, PaymentApplication } from "../invoice.js";
import type { PaymentId } from "../ids.js";
import type { Invoice } from "../invoice.js";

export type PaymentIdempotencyRecord = {
  readonly payment: Payment;
  readonly invoiceId: InvoiceId;
  readonly applicationAmountCents: number;
};

export type IInvoiceRepository = {
  findById(id: InvoiceId): Promise<Invoice | null>;
  findByOrderId(orderId: OrderId): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
  nextDocumentNumber(): Promise<string>;
  listApplications(invoiceId: InvoiceId): Promise<readonly PaymentApplication[]>;
  findPaymentByIdempotencyKey(key: string): Promise<PaymentIdempotencyRecord | null>;
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
  orderId: OrderId;
  customerId: CustomerId;
  subtotalCents: number;
  currency: string;
};

export type RecordPaymentRequest = {
  staffUserId: StaffUserId;
  invoiceId: InvoiceId;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
};

export type CorrectPaymentRequest = {
  staffUserId: StaffUserId;
  invoiceId: InvoiceId;
  paymentId: PaymentId;
  correctionAmountCents: number;
  currency: string;
};
