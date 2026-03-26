import { generateState } from "arctic";
import { github } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const state = generateState();
  const url = github.createAuthorizationURL(state, ["repo", "read:user", "user:email"]);

  const cookieStore = await cookies();
  cookieStore.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return NextResponse.redirect(url);
}
