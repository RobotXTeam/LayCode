import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db.select({
    containerStatus: projects.containerStatus,
    flyMachineId: projects.flyMachineId,
    framework: projects.framework,
  }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  return NextResponse.json({ status: project.containerStatus, framework: project.framework });
}
