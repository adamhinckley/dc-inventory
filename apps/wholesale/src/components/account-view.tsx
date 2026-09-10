"use client";

import {
  getGetWholesaleAccountDetailQueryKey,
  getGetWholesaleSessionQueryKey,
  useCreateWholesaleExemptionCertificate,
  useCreateWholesaleShipTo,
  useGetWholesaleAccountDetail,
  useGetWholesaleSession,
  useUpdateWholesaleAccountCustomerNote,
  useUpdateWholesaleShipTo,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  exemptionCertificateFilename,
  isExemptionCertificateExpired,
  staffActingAccountDashboardHref,
} from "../lib/account-nav";
import { formatMoneyMinorUnits } from "../lib/format-money";

const INTERNAL_APP_URL =
  process.env.NEXT_PUBLIC_INTERNAL_APP_URL ?? "http://localhost:3000";

type ShipToRow = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
  isDefault: boolean;
};

type ShipToFields = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

const EMPTY_SHIP_TO_FIELDS: ShipToFields = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "",
};

function shipToFieldsFromRow(shipTo: ShipToRow): ShipToFields {
  return {
    line1: shipTo.line1,
    line2: shipTo.line2 ?? "",
    city: shipTo.city,
    region: shipTo.region,
    postal: shipTo.postal,
    country: shipTo.country,
  };
}

function toShipToBody(fields: ShipToFields) {
  return {
    line1: fields.line1.trim(),
    line2: fields.line2.trim() === "" ? null : fields.line2.trim(),
    city: fields.city.trim(),
    region: fields.region.trim(),
    postal: fields.postal.trim(),
    country: fields.country.trim(),
  };
}

function formatExpiryDate(expiresAt: string | null): string {
  if (expiresAt === null) {
    return "—";
  }
  return new Date(expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ShipToAddressText({ shipTo }: { shipTo: ShipToRow }) {
  return (
    <span className="text-sm text-ink">
      <span className="font-semibold">{shipTo.line1}</span>
      {shipTo.line2 ? `, ${shipTo.line2}` : ""}
      <br />
      {shipTo.city}, {shipTo.region} {shipTo.postal}
      <br />
      {shipTo.country}
    </span>
  );
}

function ShipToDialog({
  title,
  fields,
  pending,
  error,
  onFieldsChange,
  onCancel,
  onSubmit,
}: {
  title: string;
  fields: ShipToFields;
  pending: boolean;
  error: string | null;
  onFieldsChange: (fields: ShipToFields) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <header>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </header>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Line 1</span>
        <input
          type="text"
          required
          value={fields.line1}
          disabled={pending}
          onChange={(event) =>
            onFieldsChange({ ...fields, line1: event.target.value })
          }
          className="shop-input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Line 2</span>
        <input
          type="text"
          value={fields.line2}
          disabled={pending}
          onChange={(event) =>
            onFieldsChange({ ...fields, line2: event.target.value })
          }
          className="shop-input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">City</span>
        <input
          type="text"
          required
          value={fields.city}
          disabled={pending}
          onChange={(event) =>
            onFieldsChange({ ...fields, city: event.target.value })
          }
          className="shop-input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">State / Region</span>
        <input
          type="text"
          required
          value={fields.region}
          disabled={pending}
          onChange={(event) =>
            onFieldsChange({ ...fields, region: event.target.value })
          }
          className="shop-input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Postal Code</span>
        <input
          type="text"
          required
          value={fields.postal}
          disabled={pending}
          onChange={(event) =>
            onFieldsChange({ ...fields, postal: event.target.value })
          }
          className="shop-input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Country</span>
        <input
          type="text"
          required
          value={fields.country}
          disabled={pending}
          onChange={(event) =>
            onFieldsChange({ ...fields, country: event.target.value })
          }
          className="shop-input"
        />
      </label>
      {error !== null ? (
        <p className="text-sm text-sold-out" role="alert">{error}</p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="shop-button-secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </button>
        <button type="submit" className="shop-button-primary" disabled={pending}>
          Save
        </button>
      </div>
    </form>
  );
}

function StaffActingAccountCard({ customerId }: { customerId: string | null }) {
  const href = staffActingAccountDashboardHref(INTERNAL_APP_URL, customerId);
  return (
    <section className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <p className="section-title">Account</p>
        <h1 className="page-title mt-2">Customer Account</h1>
      </header>
      <div className="rounded-2xl border border-line bg-card p-8">
        <p className="text-ink">
          Manage this customer on the staff dashboard.
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Open Staff Dashboard
        </a>
      </div>
    </section>
  );
}

export function AccountView() {
  const queryClient = useQueryClient();
  const session = useGetWholesaleSession({
    query: {
      queryKey: getGetWholesaleSessionQueryKey(),
      retry: false,
    },
  });

  if (session.isPending) {
    return <p className="text-ink-muted">Loading account…</p>;
  }

  if (session.data?.status !== 200) {
    return (
      <p className="text-sold-out" role="alert">
        Account is unavailable. Sign in and try again.
      </p>
    );
  }

  const sessionBody = session.data.data;
  if (sessionBody.mode === "staff_acting") {
    return <StaffActingAccountCard customerId={sessionBody.customerId} />;
  }

  return <BuyerAccountView />;
}

function BuyerAccountView() {
  const queryClient = useQueryClient();
  const detail = useGetWholesaleAccountDetail();
  const updateNote = useUpdateWholesaleAccountCustomerNote();
  const createShipTo = useCreateWholesaleShipTo();
  const updateShipTo = useUpdateWholesaleShipTo();
  const createCertificate = useCreateWholesaleExemptionCertificate();

  const [customerNote, setCustomerNote] = useState("");
  const [noteInitialized, setNoteInitialized] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const shipToDialogRef = useRef<HTMLDialogElement>(null);
  const certDialogRef = useRef<HTMLDialogElement>(null);
  const [shipToDialogMode, setShipToDialogMode] = useState<"add" | "edit" | null>(
    null,
  );
  const [editingShipTo, setEditingShipTo] = useState<ShipToRow | null>(null);
  const [shipToFields, setShipToFields] = useState<ShipToFields>(EMPTY_SHIP_TO_FIELDS);
  const [shipToError, setShipToError] = useState<string | null>(null);

  const [certJurisdiction, setCertJurisdiction] = useState("");
  const [certEntityUseCode, setCertEntityUseCode] = useState("");
  const [certExpiresAt, setCertExpiresAt] = useState("");
  const [certError, setCertError] = useState<string | null>(null);
  const [certDialogOpen, setCertDialogOpen] = useState(false);

  const detailData = detail.data?.status === 200 ? detail.data.data : null;

  useEffect(() => {
    const account = detailData?.account;
    if (account !== undefined && !noteInitialized) {
      setCustomerNote(account.customerNote ?? "");
      setNoteInitialized(true);
    }
  }, [detailData, noteInitialized]);

  useEffect(() => {
    const dialog = shipToDialogRef.current;
    if (dialog === null) {
      return;
    }
    if (shipToDialogMode !== null) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }
    if (dialog.open) {
      dialog.close();
    }
  }, [shipToDialogMode]);

  useEffect(() => {
    const dialog = certDialogRef.current;
    if (dialog === null) {
      return;
    }
    if (certDialogOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }
    if (dialog.open) {
      dialog.close();
    }
  }, [certDialogOpen]);

  function openAddShipTo() {
    setShipToFields(EMPTY_SHIP_TO_FIELDS);
    setShipToError(null);
    setEditingShipTo(null);
    setShipToDialogMode("add");
  }

  function openEditShipTo(shipTo: ShipToRow) {
    setShipToFields(shipToFieldsFromRow(shipTo));
    setShipToError(null);
    setEditingShipTo(shipTo);
    setShipToDialogMode("edit");
  }

  function closeShipToDialog() {
    setShipToDialogMode(null);
    setEditingShipTo(null);
    setShipToError(null);
  }

  function saveShipTo() {
    const body = toShipToBody(shipToFields);
    setShipToError(null);
    if (shipToDialogMode === "add") {
      createShipTo.mutate(
        { data: body },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: getGetWholesaleAccountDetailQueryKey(),
            });
            closeShipToDialog();
          },
          onError: () => {
            setShipToError("Could not add ship-to address.");
          },
        },
      );
      return;
    }
    if (shipToDialogMode === "edit" && editingShipTo !== null) {
      updateShipTo.mutate(
        { shipToId: editingShipTo.id, data: body },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: getGetWholesaleAccountDetailQueryKey(),
            });
            closeShipToDialog();
          },
          onError: () => {
            setShipToError("Could not update ship-to address.");
          },
        },
      );
    }
  }

  function setDefaultShipTo(shipTo: ShipToRow) {
    if (shipTo.isDefault) {
      return;
    }
    updateShipTo.mutate(
      { shipToId: shipTo.id, data: { isDefault: true } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getGetWholesaleAccountDetailQueryKey(),
          });
        },
      },
    );
  }

  function saveCustomerNote() {
    setNoteError(null);
    updateNote.mutate(
      { data: { customerNote: customerNote.trim() === "" ? null : customerNote } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getGetWholesaleAccountDetailQueryKey(),
          });
        },
        onError: () => {
          setNoteError("Could not save note.");
        },
      },
    );
  }

  function openCertDialog() {
    setCertJurisdiction("");
    setCertEntityUseCode("");
    setCertExpiresAt("");
    setCertError(null);
    setCertDialogOpen(true);
  }

  function closeCertDialog() {
    setCertDialogOpen(false);
    setCertError(null);
  }

  function submitCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCertError(null);
    const jurisdiction = certJurisdiction.trim();
    if (jurisdiction === "") {
      setCertError("Jurisdiction is required.");
      return;
    }
    const expiresAt =
      certExpiresAt.trim() === ""
        ? null
        : new Date(`${certExpiresAt.trim()}T12:00:00.000Z`).toISOString();
    const entityUseCode =
      certEntityUseCode.trim() === "" ? null : certEntityUseCode.trim();

    createCertificate.mutate(
      {
        data: {
          jurisdiction,
          status: "active",
          entityUseCode,
          expiresAt,
        },
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getGetWholesaleAccountDetailQueryKey(),
          });
          closeCertDialog();
        },
        onError: () => {
          setCertError("Could not add certificate.");
        },
      },
    );
  }

  if (detail.isPending) {
    return <p className="text-ink-muted">Loading account…</p>;
  }

  if (detail.isError || detailData === null) {
    return (
      <p className="text-sold-out" role="alert">
        Account details are unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  const shipToItems = detailData.shipTos;
  const billToMissing = detailData.billTo === null;
  const billToData = detailData.billTo;
  const contactItems = detailData.contacts;
  const certificateItems = detailData.certificates;
  const accountData = detailData.account;

  const shipToPending = createShipTo.isPending || updateShipTo.isPending;

  return (
    <section className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <p className="section-title">Account</p>
        <h1 className="page-title mt-2">{accountData.name}</h1>
        <dl className="mt-4 grid gap-2 text-sm text-ink sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Customer Number</dt>
            <dd className="font-medium">{accountData.customerNumber}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Terms</dt>
            <dd className="font-medium">{accountData.terms}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Credit Limit</dt>
            <dd className="font-medium">
              {formatMoneyMinorUnits(
                accountData.creditLimitCents,
                accountData.currency,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Tax ID</dt>
            <dd className="font-medium">{accountData.taxId ?? "—"}</dd>
          </div>
        </dl>
      </header>

      {accountData.accountStatus === "on_hold" ? (
        <div
          className="rounded-2xl border border-line bg-canvas-muted px-5 py-4 text-sm text-ink"
          role="status"
        >
          Your account is on hold. You can browse and edit your cart, but new
          orders cannot be confirmed.
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-semibold text-ink">Customer Note</p>
        <p className="mt-1 text-sm text-ink-muted">
          Notes for your team about deliveries, billing, or ordering preferences.
        </p>
        <textarea
          value={customerNote}
          onChange={(event) => setCustomerNote(event.target.value)}
          rows={4}
          disabled={updateNote.isPending}
          className="shop-input mt-4 min-h-24 resize-y font-normal"
        />
        {noteError !== null ? (
          <p className="mt-2 text-sm text-sold-out" role="alert">{noteError}</p>
        ) : null}
        <div className="mt-4">
          <button
            type="button"
            className="shop-button-primary"
            onClick={saveCustomerNote}
            disabled={updateNote.isPending}
          >
            Save
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Ship-To Addresses</p>
          <button
            type="button"
            className="shop-button-secondary"
            onClick={openAddShipTo}
          >
            {shipToItems.length === 0 ? "Add Ship-To" : "Add"}
          </button>
        </div>
        {shipToItems.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No ship-to addresses on file.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {shipToItems.map((shipTo) => (
              <li
                key={shipTo.id}
                className="flex flex-col gap-3 rounded-xl border border-line px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <ShipToAddressText shipTo={shipTo} />
                  {shipTo.isDefault ? (
                    <span className="mt-2 inline-flex rounded-full bg-canvas-muted px-2.5 py-0.5 text-xs font-semibold text-ink">
                      Default
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="shop-button-secondary"
                    onClick={() => openEditShipTo(shipTo)}
                  >
                    Edit
                  </button>
                  {!shipTo.isDefault ? (
                    <button
                      type="button"
                      className="shop-button-secondary"
                      onClick={() => setDefaultShipTo(shipTo)}
                      disabled={updateShipTo.isPending}
                    >
                      Set As Default
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-semibold text-ink">Bill-To Address</p>
        {billToMissing ? (
          <p className="mt-3 text-sm text-ink-muted">
            No bill-to on file. Contact customer service to add one before your
            order ships.
          </p>
        ) : billToData !== null ? (
          <p className="mt-3 text-sm text-ink">
            <span className="font-semibold">{billToData.line1}</span>
            {billToData.line2 ? `, ${billToData.line2}` : ""}
            <br />
            {billToData.city}, {billToData.region} {billToData.postal}
            <br />
            {billToData.country}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-semibold text-ink">Contacts</p>
        {contactItems.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No contacts on file. Contact customer service.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {contactItems.map((contact) => (
              <li
                key={contact.id}
                className="rounded-xl border border-line px-4 py-3 text-sm text-ink"
              >
                <p className="font-semibold">{contact.name}</p>
                <p className="mt-1 text-ink-muted">{contact.email}</p>
                {contact.phone ? (
                  <p className="mt-1 text-ink-muted">{contact.phone}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Exemption Certificates</p>
          <button
            type="button"
            className="shop-button-secondary"
            onClick={openCertDialog}
          >
            Add Certificate
          </button>
        </div>
        {certificateItems.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No certificates on file.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {certificateItems.map((certificate) => {
              const filename = exemptionCertificateFilename(certificate.objectKey);
              const expired = isExemptionCertificateExpired(certificate.expiresAt);
              return (
                <li
                  key={certificate.id}
                  className="rounded-xl border border-line px-4 py-3 text-sm text-ink"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{certificate.jurisdiction}</p>
                    {expired ? (
                      <span className="inline-flex rounded-full bg-canvas-muted px-2.5 py-0.5 text-xs font-semibold text-sold-out">
                        Expired
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-ink-muted">
                    Entity use code: {certificate.entityUseCode ?? "—"}
                  </p>
                  <p className="mt-1 text-ink-muted">
                    Expires: {formatExpiryDate(certificate.expiresAt)}
                  </p>
                  {filename !== null ? (
                    <p className="mt-1">
                      <span className="text-ink-muted">File: </span>
                      <span className="font-medium text-accent">{filename}</span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <dialog
        ref={shipToDialogRef}
        className="shop-dialog w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-overlay p-6 text-ink shadow-sm"
        onClose={closeShipToDialog}
      >
        {shipToDialogMode !== null ? (
          <ShipToDialog
            title={shipToDialogMode === "add" ? "Add Ship-To" : "Edit Ship-To"}
            fields={shipToFields}
            pending={shipToPending}
            error={shipToError}
            onFieldsChange={setShipToFields}
            onCancel={closeShipToDialog}
            onSubmit={saveShipTo}
          />
        ) : null}
      </dialog>

      <dialog
        ref={certDialogRef}
        className="shop-dialog w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-overlay p-6 text-ink shadow-sm"
        onClose={closeCertDialog}
      >
        {certDialogOpen ? (
          <form className="flex flex-col gap-4" onSubmit={submitCertificate}>
            <header>
              <h2 className="text-lg font-semibold text-ink">Add Certificate</h2>
            </header>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Jurisdiction</span>
              <input
                type="text"
                required
                value={certJurisdiction}
                disabled={createCertificate.isPending}
                onChange={(event) => setCertJurisdiction(event.target.value)}
                className="shop-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Entity Use Code</span>
              <input
                type="text"
                value={certEntityUseCode}
                disabled={createCertificate.isPending}
                onChange={(event) => setCertEntityUseCode(event.target.value)}
                className="shop-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Expires</span>
              <input
                type="date"
                value={certExpiresAt}
                disabled={createCertificate.isPending}
                onChange={(event) => setCertExpiresAt(event.target.value)}
                className="shop-input"
              />
            </label>
            {certError !== null ? (
              <p className="text-sm text-sold-out" role="alert">{certError}</p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="shop-button-secondary"
                onClick={closeCertDialog}
                disabled={createCertificate.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="shop-button-primary"
                disabled={createCertificate.isPending}
              >
                Add Certificate
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </section>
  );
}
