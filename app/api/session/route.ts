import { NextResponse } from "next/server";
import { COOKIE_NAME, makeViewerToken } from "@/lib/session";

export async function POST(req: Request) {
  const { password } = await req.json();
  const expected = process.env.DASHBOARD_PASSWORD || "";
  if (expected && password !== expected) {
    return NextResponse.json({error:"Wrong password"}, {status:401});
  }
  const res = NextResponse.json({ok:true});
  res.cookies.set(COOKIE_NAME, makeViewerToken(), {
    httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production",
    path:"/", maxAge:60*60*24*30
  });
  return res;
}
