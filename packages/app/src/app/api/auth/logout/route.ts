import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/", req.url));
}
