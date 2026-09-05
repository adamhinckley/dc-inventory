# Customer account surfaces (v1)

Locked UI/IA for **customer account surfaces** on the staff dashboard and wholesale shop. Domain shape and CRUD gates live in [`customers.md`](../customers.md); this doc is the implementation handoff for pages, tables, and buyer-visible chrome.

Wayfinding map: [Customer account surfaces map](https://linear.app/adamhinckley/issue/ADA-295/customer-account-surfaces-map) (all decisions closed).

Related: [`customers.md`](../customers.md) §11 (domain matrix) · [`work-dashboard-design-spec.md`](../work-dashboard-design-spec.md) §12–13 (internal controls) · [`wholesale.md`](./wholesale.md) (shop chrome) · [`api-contract.md`](../api-contract.md) · [`invariants.md`](../invariants.md) G8 + U5–U14

Language: say **ship-to** and **bill-to**; **customer number** (not customer ID in UI copy); **Customer** (buyer account), not wholesale user.

---

## Routes

| App | Route | Purpose |
| --- | --- | --- |
| Internal | `/customers` | List all customers; create (G8) |
| Internal | `/customers/:id` | Live master detail + composed order history |
| Internal | `/sales` | Customer column links to `/customers/:customerId` |
| Wholesale | `/account` | Buyer-visible account (buyer session only) |

Wholesale order history stays on `/orders`. Do not build SoloView three-step registration on this map.

---

## Authorization (G8)

| Role | Customers list/detail |
| --- | --- |
| Admin, purchasing | Read + create + edit (manage customers) |
| Warehouse, sales support | Read only — hide Edit and Add controls |

Wholesale `/account` is **buyer-only**. Staff manage customers on internal `/customers/:id`; see [Wholesale `/account`](#wholesale-account).

---

## HTTP ground

From [What customer HTTP and Orval already exist?](https://linear.app/adamhinckley/issue/ADA-298/what-customer-http-and-orval-already-exist):

| Exists today | Missing for this spec (implementation packets) |
| --- | --- |
| Internal header/children CRUD + Orval | Wire pages (placeholders today) |
| Sales list with `customerId` + `customerName` | Customer column link UI |
| Wholesale `GET/PATCH /wholesale/account`, `GET /wholesale/ship-tos` | Wholesale `/account` page; ship-to write; contacts, bill-to, cert list/upload on wholesale API |
| `listInternalCustomers` `x-table` meta | Update meta to match list spec below |

Research branch: `docs/research/customer-http-orval.md` on `research/customer-http-orval`.

---

## Internal: `/customers` list

Decision: [Internal customer list: columns, search, and create](https://linear.app/adamhinckley/issue/ADA-296/internal-customer-list-columns-search-and-create).

**Table:** all customers. Row opens `/customers/:id`.

| Column | Notes |
| --- | --- |
| Name | Business name |
| Customer # | Human-readable number |
| Status | `active` / `on hold` / `inactive` |
| Terms | Payment clock (free text v1) |

No credit limit column on the list (detail only). No currency column (USD).

**Search:** `q` matches name and customer number. Placeholder: "Search name or customer #". Compact `w-52` search field.

**Filters:** account status select only.

**Create:** **Create Customer** button (leading icon) on the list — same pattern as suppliers (`ExplorerView` dialog). Hide unless G8 manage-customers. After `201`, navigate to `/customers/:id`.

**Create dialog fields:**

| Field | Required |
| --- | --- |
| Name | Yes |
| Terms | Yes |
| Credit limit | Yes |
| Customer number | No (blank → `CUST-#####`) |

Omit Tax ID, status (defaults `active`), both notes, currency. Do not resemble SoloView registration.

**Empty state:** "No customers yet." Create is the entry for roles that can manage customers. No onboarding/register copy.

**OpenAPI:** update `listInternalCustomers` `x-table` to match (today: cents/currency columns, name-only search, no status filter).

---

## Internal: `/customers/:id` detail

Decision: [Internal customer detail: sections and staff edit](https://linear.app/adamhinckley/issue/ADA-300/internal-customer-detail-sections-and-staff-edit).

**Shell:** `DetailView` of the **live** master. Edits here do not touch frozen ship-to snapshots on past sales orders. No child routes under `/customers/:id/...`.

**Header:** title = business name; subtitle = customer number + status.

**Summary (read on page):** terms, formatted credit limit, Tax ID, status, **customer note** (read), **staff note**.

**Tabs (in order):** Ship-tos → Bill-to → Contacts → Certificates → Orders.

| Tab | Layout | Writes (G8) |
| --- | --- | --- |
| Ship-tos | Table + Add/Edit dialogs | Add, edit, set default |
| Bill-to | Single card (not a table) | Add, edit; **Copy From Default Ship-To** when default exists |
| Contacts | Table + Add/Edit dialogs | Add, edit |
| Certificates | Metadata list + create/edit | Metadata only until upload HTTP exists |
| Orders | Composed sales table — see below | Read only |

**Header edit:** **Edit Customer** dialog — name, terms, credit limit, Tax ID, status, staff note. Customer number immutable. Do **not** PATCH customer note from staff (wholesale buyer owns that field).

**Empty states:** page loads even with missing children. Ship-tos / bill-to tabs show empty copy. Bill-to empty explains ship will refuse until one exists.

**Certificates:** missing/expired visible only — not a gate (U13). No upload chrome until HTTP exists.

**Delete:** none on this map. No DELETE endpoints in UI.

---

## Internal: Orders tab (composed history)

Decision: [Order history on customer detail](https://linear.app/adamhinckley/issue/ADA-299/order-history-on-customer-detail).

Composes `useListInternalSalesOrders` with `customerId` **pinned**. Customers still do not own order history.

| Aspect | Spec |
| --- | --- |
| Columns | SO #, Status only (drop Customer — already on this customer) |
| Status chips | Same as `/sales` |
| Statuses shown | draft, confirmed, shipped, cancelled — default: all (no filter) |
| Filters | Hide customer-id filter; keep status select |
| Search | SO number only |
| Sort | Newest first — default `documentNumber` desc |
| Row link | SO # → `/sales/:id` |
| Empty | "No sales orders yet." No Create Order on this tab |
| URL state | Table params on customer detail URL or in-memory — do **not** share/clobber `/sales` query params |

---

## Internal: `/sales` Customer cell

Decision: [How the sales Customer cell links](https://linear.app/adamhinckley/issue/ADA-302/how-the-sales-customer-cell-links).

**No `DataTable` API change for v1.** Use `renderColumns.customerName` in `sales-orders-table.tsx`:

- Render `<Link href={/customers/${row.customerId}}>` with `text-link hover:text-link-hover` (same as SO #).
- Keep `linkField="documentNumber"` → `/sales/:id` for SO # only.

| Data | Cell |
| --- | --- |
| `customerName` present | Name as link |
| Name absent, `customerId` present | **Unknown customer** as link |
| `customerId` absent (defensive) | Em dash, no link |

Standard in-cell links — separate tab stops; no row-level click wrapper.

**Customer filter:** keep existing `customerId` text filter (UUID paste) for v1. Customer name/number picker is a follow-up after `/customers` list is wired.

---

## Wholesale: `/account`

Decision: [Wholesale Account page: sections and buyer writes](https://linear.app/adamhinckley/issue/ADA-297/wholesale-account-page-sections-and-buyer-writes).

**Audience:** buyer session only. Staff note never appears. Do not edit terms, credit limit, account status, bill-to, business name, or contacts from the shop.

**Nav:** signed-in buyers see **Account** → `/account` (beside Products, Orders, Cart). **Hidden** when `session.mode === "staff_acting"`.

**Layout:** single scroll page (`ShopPage` + stacked cards) — not internal `DetailView` tabs.

**Section order:**

1. Header summary (read-only)
2. Customer note (editable)
3. Ship-tos (editable)
4. Bill-to (read-only)
5. Contacts (read-only)
6. Exemption certificates (read + upload)

No Orders section — history stays on `/orders`.

### Header summary

Read-only: business name (page title), customer number, terms, credit limit (formatted money), Tax ID (or em dash).

**On hold only:** alert banner — *"Your account is on hold. You can browse and edit your cart, but new orders cannot be confirmed."*

`inactive` buyers never reach this page (Identity login gate). No status control.

### Customer note

Inline textarea + **Save** (`PATCH /wholesale/account`). Empty allowed.

### Ship-tos

Card list (visual family of checkout ship-to radios).

| Element | Behavior |
| --- | --- |
| Each card | Formatted address + **Default** badge when `isDefault` |
| Add Ship-To / Edit | Dialog with six address fields |
| Set As Default | On non-default rows |
| Delete | **Not in v1** |
| Empty | **Add Ship-To** CTA (self-service) |

### Bill-to

Read-only formatted address. Empty: *"No bill-to on file. Contact customer service to add one before your order ships."*

### Contacts

Read-only stacked cards: name (bold), email, phone if present. Empty: *"No contacts on file. Contact customer service."* No buyer edit in v1.

### Exemption certificates

Read-only list: jurisdiction, entity-use code (if any), expiry, filename/link when present. Expired rows: visible warning badge (informational only, U13).

**Upload Certificate** dialog: jurisdiction (required), optional entity-use code, optional expiry, file picker. No edit/delete of existing rows in v1.

### Staff acting

Wholesale account management is buyer-only. Staff use internal `/customers/:id`.

| Condition | Behavior |
| --- | --- |
| `staff_acting` | No **Account** nav link |
| Staff visits `/account` directly | Card: *"Manage this customer on the staff dashboard"* with link to `{NEXT_PUBLIC_INTERNAL_APP_URL}/customers/:customerId` when customer selected, else `/customers`. Opens new tab. No buyer account UI. |

### Tests (required)

| Case | Expect |
| --- | --- |
| `session.mode === "buyer"` | Nav includes Account; `/account` renders full buyer page; no staff redirect card |
| `session.mode === "staff_acting"` | Nav omits Account; `/account` shows staff-dashboard card with correct internal href |
| Mutual exclusion | Staff behavior must not leak into buyer sessions |

---

## Domain matrix (reference)

Authoritative CRUD gates: [`customers.md`](../customers.md) §11. UI detail is this doc.

| Data | Internal | Wholesale |
| --- | --- | --- |
| Header + customer number | CRUD (staff) | Read own |
| Terms, credit limit | Read/write (staff) | Read own |
| Staff note | Read/write | Hidden |
| Customer note | Read | Read + edit own |
| Contacts | CRUD | Read own |
| Ship-tos | CRUD | CRUD own |
| Bill-to | CRUD | Read own |
| Exemption certs | CRUD + upload | Read + upload own |
| Account status | Read/write (staff) | Effect only |

---

## Out of scope (this spec)

- SoloView account request, staff approve queue, PandaDoc / wholesale agreement ([`customers.md`](../customers.md) §15)
- Customer picker on `/sales` filter (follow-up)
- Ship-to or cert delete on wholesale
- Buyer edit of contacts, bill-to, terms, credit limit, status
- Invoices, payments, statements, AR on customer pages
- Credit-limit formula (G6)
- Binding wholesale user from create-customer
- Editing frozen ship-to snapshots on past orders

---

## Implementation packets

Parent: [Customer account surfaces — implementation map](https://linear.app/adamhinckley/issue/ADA-304/customer-account-surfaces-implementation-map).

| Order | Packet | Notes |
| --- | --- | --- |
| 1 (parallel) | [ADA-307](https://linear.app/adamhinckley/issue/ADA-307/internal-customersid-detail-tabs-except-orders) | Detail + `RouterTabs`; `ready-for-agent` |
| 1 (parallel) | [ADA-308](https://linear.app/adamhinckley/issue/ADA-308/sales-customer-cell-links-to-customersid) | `/sales` Customer cell; `ready-for-agent` |
| 1 (parallel) | [ADA-305](https://linear.app/adamhinckley/issue/ADA-305/wholesale-http-ship-to-writes-contacts-bill-to-certs) | Wholesale child HTTP; `ready-for-agent` |
| 2 | [ADA-306](https://linear.app/adamhinckley/issue/ADA-306/internal-customers-list-status-filter-create-dialog) | After ADA-307 |
| 2 | [ADA-310](https://linear.app/adamhinckley/issue/ADA-310/customer-detail-orders-tab-composes-sales-list) | After ADA-307 |
| 2 | [ADA-309](https://linear.app/adamhinckley/issue/ADA-309/wholesale-account-page-and-staff-acting-guard) | After ADA-305 |

Each packet: Context `customers` (or the named frontend), named Given from this doc + existing HTTP, tests green before the next blocked slice.
