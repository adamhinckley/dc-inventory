import { ShopPage } from "../../../components/shop-page";
import { company } from "../../../lib/company";

export default function AboutPage() {
  return (
    <ShopPage>
      <article className="mx-auto max-w-3xl py-8">
        <p className="section-title">About</p>
        <h1 className="page-title mt-2">{company.name}</h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-muted">
          {company.about}
        </p>
        <p className="mt-6 text-ink-muted">
          {company.street}
          <br />
          {company.cityLine}
        </p>
      </article>
    </ShopPage>
  );
}
