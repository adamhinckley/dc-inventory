# Wholesale onboarding and resale / “wholesale license” validation

Research and owner grill only. Do not implement a tax engine, flip [U13](./invariants.md), or invent SoloView API behavior from this note.

Related: [Wholesale resale license — onboarding](https://linear.app/adamhinckley/project/wholesale-resale-license-onboarding-620f6bb53aa7) · [`tax.md`](./tax.md) (v1 calculates no sales tax) · [`customers.md`](./customers.md) §9 (certs are evidence) · [`customers.md`](./customers.md) §15 (SoloView new-account form) · [`invariants.md`](./invariants.md) U12–U13, TX1–TX3 · [2026-09-07 transcript](./transcripts/2026-09-07/transcript.md) (resale certificates, Virginia).

Header **Tax ID** is an optional reseller identifier on the account. It is **not** an exemption certificate.

---

## Front-and-center unknowns

Answer these before changing gates, adding vendors, or treating a typed number as “verified.”

### 1. “Wholesale license” is not one national license

There is no single U.S. wholesale license that proves a florist may buy tax-free. What people call that is usually **state sales-tax registration**: a resale certificate, seller’s permit, or sales-tax license. The name changes by state.

In Alabama, ADOR says a buyer’s “resale certificate” is their **Sales Tax License**. Print it from My Alabama Taxes (MAT): [ADOR resale-certificate FAQ](https://www.revenue.alabama.gov/faq-categories/resale-certificate/).

Separately, Form **STE-1** is a **Sales Tax Certificate of Exemption** for product-based or statutory exemptions. ADOR issues it to firms that are **not** required to hold a Sales Tax License and that have an Alabama place of business. It is different paperwork. See [how to apply](https://www.revenue.alabama.gov/faqs/how-do-i-obtain-a-certificate-of-exemption/) and [Ala. Admin. Code r. 810-6-5-.02](https://www.law.cornell.edu/regulations/alabama/Ala-Admin-Code-r-810-6-5-.02).

SoloView’s new-account step asks for an “official resale number certificate” and says authorization will be verified ([`customers.md`](./customers.md) §15). Ask David what that field actually collects today: Sales Tax License number, STE-1, MTC, SST, out-of-state permit, or a photo of whatever the buyer has.

### 2. Seller liability vs product v1

Without a valid certificate on file, an audit can treat the sale as taxable and look to the **seller**. That is a compliance posture, not a UX nicety.

This product has **no tax lines** ([`tax.md`](./tax.md)) and certificates are **not** a confirm/ship gate (U13). Keeping that shape means we store evidence and still ship. Closing the gap is an owner decision: collect and verify harder, start charging tax (out of v1), or accept the audit risk David already lives with.

Do not invent penalty amounts. Cite ADOR or the Code if you need a legal claim.

### 3. Which jurisdictions matter

Jurisdictions follow **David’s nexus** and **ship-to states**, not only the buyer’s HQ. A multi-state florist often needs **more than one** certificate, or an MTC / SST multistate form where the destination state accepts it. We have not mapped David’s nexus. Do not assume he has it outside Alabama.

### 4. Gate vs evidence

SoloView’s signup copy says resale authorization “will be verified.” U13 does not block create, confirm, or ship when certs are missing or expired. Missing/expired is visible only.

The owner must pick one:

| Stance | What happens |
|---|---|
| **Evidence-only** (current U13) | Customer exists, confirms, ships. Staff see missing/expired. |
| **Soft gate** | Staff set `on hold` until someone verifies. Hold already blocks confirm ([`customers.md`](./customers.md) §8). |
| **Hard gate** | Confirm/ship refuse without a valid cert. **Conflicts with U13.** Grill David. Do not flip in a packet. |

### 5. Confusion with other “licenses”

City privilege licenses, municipal business licenses, florist occupational licenses, and EIN / federal Tax ID are **not** a sales-tax resale certificate. Capture the document type. A pretty PDF of the wrong license does not help in an Alabama audit.

### 6. Drop-ship and out-of-state

Destination-state rules can differ from origin. An out-of-state certificate is not always enough for an Alabama-sourced sale. ADOR will not issue STE-1 to a firm with no Alabama place of business ([r. 810-6-5-.02](https://www.law.cornell.edu/regulations/alabama/Ala-Admin-Code-r-810-6-5-.02)). SST drop-ship notes: [Streamlined exemptions](https://www.streamlinedsalestax.org/Shared-Pages/exemptions-). Ask David whether anyone drop-ships for him or buys for a store in another state.

### 7. Who verifies, and how often?

On the [2026-09-07 call](./transcripts/2026-09-07/transcript.md), **Virginia** is the person who weekly-checks that SoloView’s **Shopify** integration is still talking. That is not a statement that she verifies resale licenses. Ask David who checks certificates today (if anyone) and what the cadence is.

David’s own words on the same call: they pretty much **trust** the numbers; Alabama is where they have been burned; they try to refresh certificates yearly; they are supposed to keep a file image (email, fax, or mail); SoloView taking a number would “technically be sufficient.”

---

## What David already said (do not overwrite with blogs)

From [2026-09-07, Resale certificates / sales tax](./transcripts/2026-09-07/transcript.md):

- They collect certificates for everybody because Tennessee could theoretically audit. He has not heard of another company in the industry audited that way.
- **Alabama audited them.** Some customers had **relinquished their sales tax number** and did not tell DC.
- They try to get new certificates every year if they can.
- They are supposed to have a file image.
- Some buyers stop remitting, dissolve the LLC, and still buy. Then Alabama holds the wholesaler responsible.

Adam used “wholesale license” on that call and immediately said he was not sure it was the right name. This doc uses **resale certificate / sales-tax license** for the tax document and keeps “wholesale license” only as the phrase people say out loud.

---

## Locked product law (do not contradict)

| Rule | Source |
|---|---|
| v1 does not quote, commit, or store sales tax. No AvaTax, Stripe Tax, or `ITaxCalculator`. | [`tax.md`](./tax.md), TX1–TX2 |
| Every customer is a reseller. No tax status on the header. | U12 |
| `exemption_certificates` are child rows. Jurisdiction required. Entity-use, expiry, file optional. | U13, [`customers.md`](./customers.md) §9 |
| Zero or expired certs do **not** block create, confirm, or ship. Visible missing/expired only. | U13 |
| Optional header Tax ID ≠ exemption certificate. | [`customers.md`](./customers.md) §2, [`tax.md`](./tax.md) |
| Account request + PandaDoc wholesale **agreement** are not modeled. Separate from tax paperwork. | [`customers.md`](./customers.md) §15 |

Many cert rows per customer, each with a `jurisdiction`, is the right shape. Do not collapse to one “license number” on the header.

---

## Multi-state

Yes: a customer can need **more than one** certificate when they sell or receive goods across states, or when the seller has nexus in more than one state.

| Form | What it is | Limit |
|---|---|---|
| [MTC Uniform Sales & Use Tax Resale Certificate – Multijurisdiction](https://www.mtc.gov/resources/uniform-sales-use-tax-exemption-certificate/) | One form. MTC says **36 states** have indicated it can be used as a resale certificate. | Read the form’s state list and limits. Not blanket immunity. Still need state registration numbers where the state requires them. Confirm with that state’s revenue department. |
| [SST Exemption Certificate](https://www.streamlinedsalestax.org/Shared-Pages/exemptions-) | Accepted by all **24** Streamlined member states. | Not every exemption on the form is valid in every member state. A state may still require its own ID. Drop-shippers must check the destination state. SST says the seller is generally **not** required to verify the purchaser’s ID (Georgia is called out as an exception). |

These forms do not replace Alabama’s own documents when Alabama is the taxing state. They sit beside them.

The product already allows many `exemption_certificates` rows per customer. Keep that. Do not invent a second table.

---

## Validation layers (cheapest → expensive)

Format-valid is **not** legally verified. A regex that matches an Alabama account number does not prove the account is active.

| Layer | What it does | Cost | Fit here |
|---|---|---|---|
| **Form / format validation** | Required fields present. Permit number matches a state pattern. Reject blank numbers. | Free DIY | High. Catches typos only. |
| **State portal lookup (manual)** | Staff paste the number into MAT or another state’s tool. Save a screenshot. | Free + staff time | High for an Alabama-heavy book. |
| **State portal (semi-auto)** | Scripted check of the same portals. | Fragile. Terms-of-use risk. No unified free API. | Low for v1. |
| **Avalara CertExpress** | Buyer self-serve form / upload. | Free for **buyers**. Seller still needs ECM. | Only if buying Avalara. |
| **Avalara ECM Essentials / Pro / Premium** | Storage, campaigns, tax-ID checks, OCR/validation on higher tiers. | Quote-based. **No public fixed dollar price.** | Overkill until multi-state audit risk or cert volume makes staff time the expensive part. |

Sources for the paid row:

- Avalara [ECM product page](https://www.avalara.com/us/en/products/sales-and-use-tax/compliance-document-management.html): Essentials stores certificate images **up to 1,000**; Pro/Premium list unlimited storage, automated validation, enhanced state tax-ID checks. [ECM Essentials](https://www.avalara.com/us/en/products/exemption-certificate-management-essentials.html) lists OCR-assisted validation and collection campaigns on Pro, not Essentials.
- Avalara [CertExpress](https://www.avalara.com/us/en/products/sales-and-use-tax/certexpress.html): buyer-facing, free, meant to feed ECM.
- [Galvix on Avalara ECM / CertCapture pricing](https://www.galvix.com/article/avalara-certcapture-pricing/): no verified public annual figure; custom quote. Treat Galvix as a competitor write-up, not a price list.

State-by-state verify links and number-format libraries (secondary; prefer the state’s own portal):

- [TaxJar: how to verify a resale certificate](https://www.taxjar.com/blog/resale-certificate) — Alabama listed as login required. Their click path (Start Over → Business → Verify an Exemption Certificate) may not match today’s MAT UI. Use ADOR’s path below.
- [Numeral: verify resale certificates by state](https://www.numeral.com/blog/how-to-verify-resale-certificates-state-by-state)
- [Sales Tax Institute, State-by-State Exemption Certificate Guide (2025-08 PDF)](https://www.salestaxinstitute.com/wp-content/uploads/2025/08/State-by-State-Exemption-Certificate-Guide.pdf) — forms, typical number formats (`N` = digit), validity notes. Formats vary by issuance date and taxpayer type. Do not hard-code one pattern as law.

Avalara treats **format** and **verification** as separate features. So should we.

---

## Alabama (home state)

Verify every operational claim against ADOR. Secondary blogs (LegalClarity and the like) can mis-state login requirements. Prefer ADOR. Still say the audit risk plainly.

### Resale document = Sales Tax License

[ADOR FAQ](https://www.revenue.alabama.gov/faq-categories/resale-certificate/): in Alabama a resale certificate is officially a **Sales Tax License**. The buyer logs into MAT, opens the tax account, and uses **Print tax account license**.

### STE-1 is a different document

[ADOR: how to apply](https://www.revenue.alabama.gov/faqs/how-do-i-obtain-a-certificate-of-exemption/): a certificate of exemption is for persons **not required to have a Sales Tax License**. Applications are ST: EX-A1 (wholesalers, manufacturers, product-based) or ST: EX-A1-SE (statutorily exempt).

[ADOR: how long is it valid?](https://www.revenue.alabama.gov/faqs/how-long-is-the-certificate-of-exemption-valid/): many non-government certificates of exemption are valid **one year** from issuance and must be renewed before month-end of expiry. After expiry the holder may not make tax-exempt purchases on that certificate. This annual clock is **STE-1 / exemption certificate**, not a blanket rule for every Sales Tax License.

[r. 810-6-5-.02](https://www.law.cornell.edu/regulations/alabama/Ala-Admin-Code-r-810-6-5-.02): sale to someone not required to hold a license is taxable until the contrary is shown. Burden is on the seller unless they take a properly executed STE-1. A seller who takes STE-1 in good faith and with reasonable care is relieved of later-assessed tax on that claimed exemption (with listed exceptions in the rule).

Do not quote blog penalty math. If you need a number, find it on revenue.alabama.gov or in the Code.

### Verify account numbers in MAT

ADOR’s e-filing page documents a **Tax Account Status Check** for wholesale and other exempt sales: log into [My Alabama Taxes](https://www.revenue.alabama.gov/sales-use/e-filing-payments-assistance/), **Other Actions…**, Search, **Verify account numbers**. That is the path to cite. TaxJar and the STI PDF describe MAT verification too; their menus may be stale.

### What to store for an Alabama row

Reuse `exemption_certificates`. Do not add a tax engine.

Recommended metadata (office process now; schema later only if a packet asks):

| Field | Why |
|---|---|
| `jurisdiction` | Already required. `AL` or a clearer label. |
| Account / license number | The MAT number, not a city privilege license. |
| Document type | Sales Tax License vs STE-1 vs MTC vs out-of-state. Not in schema today. |
| Expiry | Optional today. Warn if past. Required-looking for STE-1 annual renewals. |
| File (`object_key`) | The license image David said they are supposed to keep. |
| `verified_at` / `verified_by` | Staff checklist. Not in schema today. |
| Verification evidence | Screenshot or PDF from MAT. Optional object. |

### Office process (free)

1. Buyer sends Sales Tax License printout or STE-1 (or staff pull the number from signup).
2. Staff verify in MAT. Screenshot into the customer file.
3. Calendar STE-1 renewals if that is the document on file.
4. Re-check when a gut feeling says the LLC died. David already described that failure mode.

---

## Form validation when the state is known

Yes. Cheap, and it belongs on the onboarding form if we build one.

Validate:

- Required fields present (buyer name, seller, number, description / reason, signature, date, as the chosen form requires).
- Number matches a **state pattern library** (STI guide as a starting list; confirm odd formats against the state).
- Jurisdiction on the row matches the selected state.
- Expiry in the past → **warn**, do not silently accept as current.
- File MIME and size if a file is attached.
- Reject a blank number.

Do **not** treat format-valid as legally verified. Do not call the row “verified” until a human (or a paid service) has checked the portal.

---

## Recommended path for Pullclear / David

Solo Alabama wholesale florist, owner-operated buyers, already burned once by lapsed AL numbers. Volume is not “Avalara ECM” volume until someone counts certs and ship-to states.

1. **v1 product.** Keep many certs + metadata. Add staff “verified” checklist fields when a packet exists (`verified_at`, `verified_by`, optional screenshot). Optional soft status: staff put the account **on hold** until they check MAT. **Grill David before** making a cert a hard confirm/ship gate. That fight is U13 vs SoloView copy.
2. **Office process.** Free MAT (and top ship-to state portals) lookup. Screenshot into the file. Calendar for annual AL STE-1 renewals when that form is what they hold.
3. **Skip Avalara ECM** until cert count or multi-state nexus makes staff time the expensive part. CertExpress is useless without ECM. AvaTax is still out of v1.
4. **DIY format validation** by state on whatever onboarding form we eventually ship. Cheap win. Not a substitute for MAT.
5. **Onboarding product** (account request + PandaDoc agreement) stays a separate grill ([`customers.md`](./customers.md) §15). Tax paperwork is one step of that form, not the whole flow.

Do not implement any of this from this note. Lock the gate decision, then write a work packet.

---

## Open questions for David

- What document does SoloView require today? Sales Tax License number, STE-1, MTC, SST, out-of-state permit, or “anything that looks official”?
- Does anyone ever get charged sales tax today? (Product v1 says no. Live practice may differ.)
- Which states do you ship into, and where do you have **nexus**? Alabama is known. Tennessee was mentioned as theoretical. Do not invent the rest.
- Must someone verify before the first order, or collect now and verify later?
- Who is Virginia, and what does the weekly check include besides Shopify ↔ SoloView?
- Soft hold vs hard block vs evidence-only (keep U13)?
- How many certificate images do you actually have, and how many states appear on them?

---

## What agents must not do

- Add `ITaxCalculator`, tax lines, AvaTax, or Stripe Tax.
- Flip U13 without an owner decision written into [`customers.md`](./customers.md) and [`invariants.md`](./invariants.md).
- Treat header Tax ID as a certificate.
- Invent SoloView verification APIs, Avalara dollar prices, or that David has nexus in a named state beyond what he said.
- Confuse city / florist / privilege licenses with a sales-tax resale document.
- Write an implementation packet that “just makes certs required at confirm.”
