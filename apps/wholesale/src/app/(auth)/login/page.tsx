import { Suspense } from "react";
import { LoginForm } from "../../../components/login-form";
import { ShopPage } from "../../../components/shop-page";

export default function LoginPage() {
  return (
    <ShopPage>
      <Suspense fallback={<p className="text-ink-muted">Loading sign in…</p>}>
        <LoginForm />
      </Suspense>
    </ShopPage>
  );
}
