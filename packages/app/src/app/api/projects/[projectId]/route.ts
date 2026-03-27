import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { stopContainer, freshCloneProject } from "@/lib/server-api";
import { NextResponse } from "next/server";

export async function DELETE(
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

  // Stop container and clean up workspace
  try {
    await stopContainer(projectId);
    await freshCloneProject(projectId);
  } catch {
    // Server may be down or project never started — continue with DB delete
  }

  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)));

  return NextResponse.json({ success: true });
}
