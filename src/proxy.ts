import { type NextRequest } from "next/server";
import { updateSessionAndProtectAdmin } from "@/lib/db/supabase-middleware";

export async function proxy(request: NextRequest) {
  return updateSessionAndProtectAdmin(request);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
