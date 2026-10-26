"use client";

import { useState } from "react";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";

export function AdminShell({
  adminEmail,
  signOutAction,
  children,
}: {
  adminEmail: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3 md:hidden">
        <Link href="/admin" className="text-sm font-semibold text-text-primary">
          Assistant Admin
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-expanded={mobileNavOpen}
          aria-controls="admin-mobile-nav"
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
            {mobileNavOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            )}
          </svg>
        </button>
      </div>

      {mobileNavOpen ? (
        <div id="admin-mobile-nav" className="border-b border-border-subtle bg-surface px-4 py-4 md:hidden">
          <SidebarNav />
          <div className="mt-4 border-t border-border-subtle pt-4">
            <SignOutRow adminEmail={adminEmail} signOutAction={signOutAction} />
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border-subtle bg-surface md:flex">
        <div className="px-5 py-5 border-b border-border-subtle">
          <span className="text-sm font-semibold text-text-primary">Assistant Admin</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav />
        </div>
        <div className="border-t border-border-subtle px-3 py-4">
          <SignOutRow adminEmail={adminEmail} signOutAction={signOutAction} />
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function SignOutRow({
  adminEmail,
  signOutAction,
}: {
  adminEmail: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
          {adminEmail.slice(0, 1).toUpperCase()}
        </div>
        <span className="truncate text-xs text-text-secondary" title={adminEmail}>
          {adminEmail}
        </span>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
