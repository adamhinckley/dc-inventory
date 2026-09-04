import { HeroCarousel } from "../../components/hero-carousel";
import { HomeCta } from "../../components/home-cta";
import { ShopPage } from "../../components/shop-page";
import { company } from "../../lib/company";

export default function ShopHomePage() {
  return (
    <>
      <HeroCarousel />
      <ShopPage>
        <section id="about" className="mx-auto max-w-3xl py-8 text-center">
          <p className="section-title">About</p>
          <h1 className="page-title mt-3">{company.name}</h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">
            {company.about}
          </p>
          <div className="mt-10 flex justify-center">
            <HomeCta />
          </div>
        </section>
      </ShopPage>
    </>
  );
}
