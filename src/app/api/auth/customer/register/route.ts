import { NextRequest, NextResponse } from "next/server";

// Public self-registration is DISABLED.
// Accounts can only be created by administrators from the admin panel.

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { success: false, error: "Registration is disabled. Accounts are created by administrators only." },
    { status: 403 }
  );
}
