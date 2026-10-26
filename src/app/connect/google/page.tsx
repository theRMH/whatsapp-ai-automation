import { redirect } from "next/navigation";

/**
 * Entry point for the "Connect Google" link sent to the user (PRD 19.1).
 * Immediately redirects to the OAuth start route with the token intact;
 * kept as a separate page (rather than pointing the WhatsApp link directly
 * at /api/auth/google/start) so a future version can show interstitial
 * copy before redirecting without changing the link already sent to users.
 */
export default async function ConnectGooglePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  if (!t) {
    redirect("/connect/google/error?reason=missing_token");
  }

  redirect(`/api/auth/google/start?t=${encodeURIComponent(t)}`);
}
