import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { startContainer } from "@/lib/server-api";
import { NextResponse } from "next/server";

export async function POST(
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

  const [user] = await db.select().from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user?.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  try {
    await db.update(projects).set({
      containerStatus: "STARTING" as any,
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId));

    const result = await startContainer(projectId, project.githubRepo, project.branch, user.githubToken);

    await db.update(projects).set({
      containerStatus: result.status === 'running' ? 'RUNNING' as any : 'STARTING' as any,
      framework: result.framework,
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId));

    return NextResponse.json({
      status: result.status === 'running' ? 'RUNNING' : 'STARTING',
      proxyPort: result.proxyPort,
      framework: result.framework,
    });
  } catch (error: any) {
    await db.update(projects).set({
      containerStatus: "ERROR" as any,
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
