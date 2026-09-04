import Link from "next/link";
import { RegisterForm } from "../../../components/register-form";
import { ShopPage } from "../../../components/shop-page";

export default function RegisterPage() {
  return (
    <ShopPage>
      <section className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
        <p className="section-title">Account</p>
        <h1 className="page-title mt-2">Register</h1>
        <p className="mt-3 mb-8 text-sm text-ink-muted">
          Already have web access?{" "}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
        <RegisterForm />
      </section>
    </ShopPage>
  );
}
