import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getEditHistory } from "@/lib/server-api";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const result = await getEditHistory(projectId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ edits: [] });
  }
}
