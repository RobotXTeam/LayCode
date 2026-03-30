import { GitHub, Google } from "arctic";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  process.env.GITHUB_REDIRECT_URI!
);

export const google = process.env.GOOGLE_CLIENT_ID
  ? new Google(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    )
  : null;

export interface SessionData {
  userId?: string;
  githubToken?: string;
  githubUsername?: string;
  displayName?: string;
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    password: process.env.SESSION_SECRET!,
    cookieName: "layrr_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  });
}
