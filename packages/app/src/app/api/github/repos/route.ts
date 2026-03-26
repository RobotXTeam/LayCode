import { getSession } from "@/lib/auth";
import { listRepos } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.githubToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await listRepos(session.githubToken);
    return NextResponse.json(repos);
  } catch {
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}
