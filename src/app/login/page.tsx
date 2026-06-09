// Login page — sits in front of the entire internal workspace. The
// middleware redirects here whenever the session cookie is missing
// or expired (carries `?next=<original>` so we can bounce back to the
// page the user was trying to reach). The /(public-review)/... pages
// for clients are never gated, so this page exists exclusively for
// employees.

import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · Wonder Ads Workspace",
};

export default function LoginPage() {
  return (
    <PageShell transparentHeader hideFooter>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </PageShell>
  );
}
