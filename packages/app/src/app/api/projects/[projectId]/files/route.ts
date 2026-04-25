import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || `${process.env.HOME || '/tmp'}/.layrr/workspaces`;

type Node = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: Node[];
};

const IGNORE = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"]);

function readTree(root: string, rel = "", depth = 0): Node[] {
  if (depth > 3) return [];
  const abs = join(root, rel);
  const entries = readdirSync(abs, { withFileTypes: true })
    .filter((e) => !IGNORE.has(e.name) && !e.name.startsWith("."))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

  return entries.slice(0, 120).map((entry) => {
    const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path: nextRel,
        type: "dir" as const,
        children: readTree(root, nextRel, depth + 1),
      };
    }
    return { name: entry.name, path: nextRel, type: "file" as const };
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const root = project.sourceType === "local"
    ? project.localPath
    : join(WORKSPACE_DIR, projectId);

  if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
    return NextResponse.json({ files: [] });
  }

  return NextResponse.json({ files: readTree(root) });
}
