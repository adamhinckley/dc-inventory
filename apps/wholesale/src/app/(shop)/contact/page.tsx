import { ConnectWithUs } from "../../../components/connect-with-us";
import { ContactFeedbackForm } from "../../../components/contact-feedback-form";
import { ShopPage } from "../../../components/shop-page";

export default function ContactPage() {
  return (
    <ShopPage>
      <div className="grid gap-12 py-4 lg:grid-cols-2">
        <section>
          <p className="section-title">Contact</p>
          <h1 className="page-title mt-2">Feedback</h1>
          <p className="mt-3 mb-6 text-ink-muted">
            Send a note and we will follow up. This form opens your email app —
            it does not post to the shop API.
          </p>
          <ContactFeedbackForm />
        </section>
        <section>
          <p className="section-title">Connect With Us</p>
          <h2 className="page-title mt-2 text-3xl">Visit or call</h2>
          <div className="mt-6">
            <ConnectWithUs />
          </div>
        </section>
      </div>
    </ShopPage>
  );
}
