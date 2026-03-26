import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  const userProjects = await db.select().from(projects)
    .where(eq(projects.userId, session.userId))
    .orderBy(desc(projects.updatedAt));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Projects</h1>
      {userProjects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          {userProjects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/project/${project.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700"
            >
              <div>
                <h2 className="font-semibold">{project.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{project.githubRepo}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={project.containerStatus} />
                <span className="text-xs text-zinc-600">
                  {project.updatedAt.toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
      <p className="mb-4 text-zinc-500">No projects yet</p>
      <Link
        href="/dashboard/new"
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white"
      >
        Connect a GitHub repo
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    RUNNING: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    STARTING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    CREATING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    STOPPED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    ERROR: "bg-red-500/10 text-red-400 border-red-500/20",
    STOPPING: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.STOPPED}`}>
      {status.toLowerCase()}
    </span>
  );
}
