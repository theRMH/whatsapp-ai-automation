"use client";

import { useEffect } from "react";
import { signOutAction } from "./actions";

export default function AdminError({ error }: { error: Error & { digest?: string } }) {
  const isAuthError = error.name === "NotAuthenticatedError" || error.name === "NotAnAdminError";

  useEffect(() => {
    if (!isAuthError) {
      console.error(error);
    }
  }, [error, isAuthError]);

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col gap-4 items-center text-center max-w-sm">
        <h1 className="text-lg font-semibold">
          {isAuthError ? "Access denied" : "Something went wrong"}
        </h1>
        <p className="text-sm text-neutral-500">
          {isAuthError
            ? "Your account is not authorized to access the admin dashboard."
            : "An unexpected error occurred."}
        </p>
        <form action={signOutAction}>
          <button type="submit" className="text-sm underline">
            Back to sign in
          </button>
        </form>
      </div>
    </main>
  );
}
