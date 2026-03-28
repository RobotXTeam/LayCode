import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getSession();
  session.destroy();
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return NextResponse.redirect(new URL("/", `${proto}://${host}`));
}
