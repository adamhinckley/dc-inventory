import type { ReactNode } from "react";
import { company } from "../lib/company";

export type LegalCopy = {
  title: string;
  body: ReactNode;
};

export const privacyCopy: LegalCopy = {
  title: "Privacy Policy",
  body: (
    <>
      <p>
        It is the policy of David Christopher’s that personal information, such
        as your name, personal postal and email address, or personal telephone
        number is private and confidential.
      </p>
      <h2>Website Privacy Policy</h2>
      <p>
        By using this site, you consent to the terms of our privacy policy for
        the collection, use and disclosure of your personal information for the
        purposes set out below. We do not collect, use or disclose your personal
        information for any purpose other than those identified below, except
        with your consent or as required by law.
      </p>
      <h2>The Information We Collect</h2>
      <h3>1. Site Activity Data</h3>
      <p>
        Each time a visitor comes to this website, our web server collects and
        logs certain information. These access logs are kept for a reasonable
        period of time. These logs include, but are not restricted to your
        machine’s TCP/IP address, your username (if applicable), date, time and
        files accessed. These logs also contain information about “referrer”
        information if you clicked on an external link to a David Christopher’s
        webpage. These logs are used solely for performance, site administration
        and security reviews. They are not sold or shared in any way to third
        party organizations.
      </p>
      <h3>2. Cookies</h3>
      <p>
        Portions of the David Christopher’s website may use cookies only for
        security and authentication purposes. This information is used solely to
        maintain your computer’s session to the David Christopher’s server. This
        information is not shared or sold to third party organizations for any
        purpose.
      </p>
      <h3>3. Personal Information</h3>
      <p>
        Personal information, such as your name, personal postal and email
        address, or personal telephone number is collected only when you
        voluntarily provide it. Such information is received when you request a
        catalog or place an order.
      </p>
      <p>
        Personal information will not be sold to any third parties, nor will
        such information be added to bulk email lists.
      </p>
      <h2>Policy Revisions</h2>
      <p>
        Any changes to this privacy policy will be promptly communicated on this
        website. Policy changes will not alter how we handle previously
        submitted personal information.
      </p>
      <p>
        If you have any questions about our privacy policies or wish to update
        any of the personal information you have provided to us, contact us at{" "}
        <a href={`mailto:${company.email}`}>{company.email}</a>.
      </p>
    </>
  ),
};

export const paymentTermsCopy: LegalCopy = {
  title: "Payment Terms",
  body: (
    <>
      <p>
        <strong>David Christopher’s, Inc.</strong>
      </p>
      <h2>Available Credit Terms</h2>
      <p>
        Customer may elect cash on delivery (COD) terms or prepayment on credit
        card (VISA, MasterCard, Discover, and American Express). Open Account
        billing is subject to credit approval, and execution of applicable
        Seller Open Account agreements.
      </p>
      <h2>Finance Charge</h2>
      <p>
        A finance charge of 1.5% per month (18% APR) will be added to all past
        due balances on the last day of the billing cycle.
      </p>
      <h2>Payments</h2>
      <p>
        All payments received on Open Accounts will be posted first to interest
        and fees that may be due; the remaining amount if any will be posted to
        invoices due, paying the oldest invoices first.
      </p>
      <h2>Errors</h2>
      <p>
        Please report any errors on a billing statement to the billing
        department within 15 days of the statement date.
      </p>
      <h2>Sales Order Cancellation / Modification</h2>
      <p>
        A sales order once confirmed with and accepted by Seller can be
        cancelled only with Seller’s consent and upon terms that will indemnify
        Seller against loss. Approved Customer cancellations or modifications
        may be subject to a 15% cancellation fee. All sales orders are
        considered confirmed after 15 days or the order placement date, unless
        otherwise stated.
      </p>
      <h2>Credits</h2>
      <p>
        All claims for credit must be reported to the Sales Department within
        five (5) days of the invoice date by fax or email only via the claims
        form link. No claims will be accepted via phone. Each claim must include
        the invoice number, date of purchase, item, quantity and problem
        encountered. Merchandise must not be disposed of or destroyed until the
        sales department approves the credit. It may be requested that
        merchandise be sent back to the warehouse and must be in original
        condition and inner packaging as shipped to customer. Approved credits
        will be issued to the customer’s account. The Sales Department reserves
        the right to deny the claim request.
      </p>
      <h2>Fees</h2>
      <p>
        A $30.00 fee will be charged for each dishonored check. A cancellation
        fee equal to 15% of the invoice total may be assessed for returns caused
        by failure to meet COD terms.
      </p>
      <h2>Dishonored Checks</h2>
      <p>
        If there are two (2) returned checks on account within a twelve (12)
        month period, the account will be placed on COD, cash or money order
        only, and the entire account balance will be declared immediately due
        and payable; reinstatement of open account or check writing privileges
        will require review and approval of the credit department.
      </p>
      <h2>Past Due / Over Limit Account</h2>
      <p>
        Any account in default 60 days or more, or over the established credit
        limit, will be reviewed by the credit department. The company may then
        require the customer to pay for all subsequent purchases on delivery
        (COD), until all over line and/or past due balances are paid in full;
        the approval of the credit department will be required to increase or
        reinstate a credit line. If it becomes necessary to place this account
        for collection, David Christopher’s, Inc. “Seller” will be entitled to
        payment in full for purchases, finance charges, restocking charges,
        returned check charges, and all reasonable attorney and/or collection
        fees and court costs.
      </p>
      <h2>Other Conditions</h2>
      <p>
        A consumer credit report may be requested in connection with Open
        Account requests, or in connection with updates, renewals or extensions
        of any credit granted as a result of this account. Customer agrees to
        immediately notify Seller in the event that any Customer Account or
        business information needs to be corrected or brought current, and
        agrees to provide Seller any such information that may be requested by
        them from time to time.
      </p>
      <h2>Promotion Disclaimer</h2>
      <p>
        Promotions and discount codes are subject to change or discontinuation
        at David Christopher’s discretion and without prior notice.
      </p>
      <h2>Claims</h2>
      <p>
        Claims for defective merchandise, shortages or delays, or failures in
        shipment or delivery, or for any other cause, shall be deemed waived and
        released by Customer, unless made in writing within five (5) days after
        receipt of the merchandise. In the event that you receive an item or
        items in your shipment that are damaged, those damaged items must be
        claimed with David Christopher’s Inc, within 5 days of receiving that
        order. Each carrier has strict guidelines that David Christopher’s Inc.
        must follow to file claims. It is your responsibility to fill out the
        claims form by contacting our customer service team for the claims form
        link. Claims that are reported outside of that time frame may be subject
        to claim denial. Partial credit: If you file a claim where only a small
        portion of the item is damaged such as a berry has popped, missing a
        small portion of glitter, etc, you will only be credited a percentage of
        the item.
      </p>
      <h2>Warranties</h2>
      <p>
        NO EXPRESS WARRANTIES OR IMPLIED WARRANTIES, WHETHER OF MERCHANTIABLITY
        OR FITNESS FOR ANY PARTICULAR USE, OR OTHERWISE, OTHER THAN THOSE
        EXPRESSLY SET FORTH BY SELLER WHICH ARE MADE EXPRESSLY INLIEU OF ALL
        OTHER WARRANTIES, SHALL APPLY TO PRODUCTS SOLD BY SELLER, AND NO WAIVER,
        ALTERATIONS, OR MODIFICATIONS OF THE FOREGOING CONDITIONS SHAL BE VALID
        UNLESS MADE IN WRITING AND SIGNED BY AN EXECUTIVE OFFICER OF SELLER’S
        CORPORATION.
      </p>
      <h2>Shipment</h2>
      <p>
        All prices are F.O.B Seller’s warehouse; Sheffield, AL. Methods and
        route of shipment are at Seller’s discretion, unless Customer supplies
        explicit instructions with placement of their order. All shipments are
        insured at the Customer’s expense and made at the Customer’s risk.
        Identification of the goods for sale shall occur as each shipment is
        placed in the hands of the carrier.
      </p>
      <h2>Governing Law</h2>
      <p>
        This sales transaction and the acceptance of goods by Customer shall be
        a contract made in the State of Alabama, and governed by the laws
        thereof.
      </p>
      <p>
        Prices are subject to change and current price may not be reflected in
        the catalog. We as a wholesaler do not accept returns or exchanges, as
        all sales are final. 11/17/2025
      </p>
    </>
  ),
};

export const claimsCopy: LegalCopy = {
  title: "Claim Information",
  body: (
    <>
      <h2>What to do if I have a claim with my recent shipment?</h2>
      <p>
        Contact our customer service team at{" "}
        <a href={`mailto:${company.email}`}>{company.email}</a> or by text at{" "}
        {company.phoneDisplay}, and one of our wonderful staff memebers will
        send a link in which the claim must be filed.
      </p>
      <h2>FAQ Regarding Claims</h2>
      <dl>
        <dt>What constitutes as a claim with David Christopher’s, Inc.?</dt>
        <dd>
          Items that arrive damaged, defective, or missing. “Please note that
          simply not being able to sell an item, a better price found later, or
          simply because you do not like the item in person does not constitute
          a claim.”
        </dd>
        <dt>Will I be refunded for the items on my claim?</dt>
        <dd>
          Our claims department will review the claim. In most cases David
          Christopher’s, Inc. will always reship any damaged item if possible.
          If we feel that we will be unable to reship your items in perfect
          condition a credit will be provided back to you.
        </dd>
        <dt>Am I credited for the freight on claim items?</dt>
        <dd>No, we do not credit freight charges on claimed merchandise.</dd>
        <dt>How long do I have to make a claim?</dt>
        <dd>
          You have 5 days from the time your shipment is received in order to
          file a claim. It could take up to 7 business days to fully process
          your claim.
        </dd>
        <dt>Do I have to send photos of the items?</dt>
        <dd>
          Yes, all photos must be emailed to {company.email}. In order to file a
          claim on your behalf, photos are required.
        </dd>
        <dt>Do I have to return the merchandise that is claimed?</dt>
        <dd>
          Our claims department will advise if you will be required to return
          the product, or if it can be disposed.
        </dd>
        <dt>Are there instances where only partial credit is given?</dt>
        <dd>
          Yes, if your claim consists of only a small portion of the item being
          damaged such as a berry has popped, missing a small amount of glitter,
          etc., you will only be credited a percentage of the item cost.
        </dd>
        <dt>Can I call in my claim with David Christopher’s Inc.?</dt>
        <dd>
          No, the claim must be filed electronically per the claims form. It is
          important that we keep adequate records of claims. This helps us if
          there is an issue with damage or quality to investigate where the
          problem is to correct the issues.
        </dd>
      </dl>
    </>
  ),
};
