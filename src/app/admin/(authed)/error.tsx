"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

export default function AdminError({ error }: { error: Error & { digest?: string } }) {
  const isAuthError = error.name === "NotAuthenticatedError" || error.name === "NotAnAdminError";

  useEffect(() => {
    if (!isAuthError) {
      console.error(error);
    }
  }, [error, isAuthError]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div
          className={
            "flex h-12 w-12 items-center justify-center rounded-full " +
            (isAuthError ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger")
          }
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-text-primary">
          {isAuthError ? "Access denied" : "Something went wrong"}
        </h1>
        <p className="text-sm text-text-secondary">
          {isAuthError
            ? "Your account is not authorized to access the admin dashboard."
            : "An unexpected error occurred. Please try again."}
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Back to sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
