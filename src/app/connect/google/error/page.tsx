const REASON_MESSAGES: Record<string, string> = {
  missing_token: "This link is missing its connection token.",
  missing_params: "Google did not return the expected response.",
  invalid_or_expired_token: "This connection link has expired or was already used. Ask the assistant for a new one.",
  account_not_found: "We couldn't find your account. Please contact the administrator.",
  connection_failed: "We couldn't complete the connection to Google. Please try again.",
  not_configured: "Google connection is not available right now. Please contact the administrator.",
  access_denied: "Google sign-in was cancelled.",
};

export default async function GoogleConnectErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && REASON_MESSAGES[reason]) || "Something went wrong connecting your Google account.";

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm text-center flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Couldn&apos;t connect Google</h1>
        <p className="text-sm text-neutral-600">{message}</p>
      </div>
    </main>
  );
}
