import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeletedNotice } from "@/components/auth/deleted-notice";
import { AuthForm } from "@/components/auth/auth-form";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { login } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Suspense>
        <DeletedNotice />
      </Suspense>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Welcome back to your Command Center.</p>
      <AuthForm mode="login" action={login} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
