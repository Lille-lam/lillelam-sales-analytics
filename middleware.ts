import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const enabled = Boolean(process.env.DASHBOARD_PASSWORD);
  if (!enabled) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (
    path === "/login" ||
    path === "/api/session" ||
    path.startsWith("/_next/") ||
    path === "/favicon.ico"
  ) return NextResponse.next();

  const token = req.cookies.get("lillelam_dashboard")?.value;
  // Middleware cannot import Node crypto helper reliably across runtimes.
  // We only use presence here; API/page server calls remain protected by the same secret login flow.
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
