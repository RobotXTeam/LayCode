import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth";
import { isLocalModeEnabled } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  if (isLocalModeEnabled()) {
    return res;
  }

  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const session = await getIronSession<SessionData>(req, res, {
      password: process.env.SESSION_SECRET!,
      cookieName: "laycode_session",
    });

    if (!session.userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
