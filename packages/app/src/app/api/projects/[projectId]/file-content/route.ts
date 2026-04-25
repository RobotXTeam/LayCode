import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "fs";
import { join, normalize } from "path";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || `${process.env.HOME || '/tmp'}/.layrr/workspaces`;
const MAX_BYTES = 200 * 1024;

function getProjectRoot(project: { id: string; sourceType: string; localPath: string | null }) {
  if (project.sourceType === "local") return project.localPath;
  return join(WORKSPACE_DIR, project.id);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const url = new URL(req.url);
  const filePath = url.searchParams.get("path") || "";
  if (!filePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const root = getProjectRoot(project);
  if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
    return NextResponse.json({ error: "Project workspace not ready" }, { status: 400 });
  }

  const cleanRel = normalize(filePath).replace(/^\/+/, "");
  const abs = join(root, cleanRel);
  if (!abs.startsWith(root)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buf = readFileSync(abs);
  const sliced = buf.byteLength > MAX_BYTES ? buf.subarray(0, MAX_BYTES) : buf;
  const content = sliced.toString("utf-8");

  return NextResponse.json({
    path: cleanRel,
    truncated: buf.byteLength > MAX_BYTES,
    content,
  });
}
