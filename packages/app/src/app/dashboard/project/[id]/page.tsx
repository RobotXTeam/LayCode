import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, editEvents } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { ContainerControls } from "./controls";
import { ArrowLeft, GitBranch, ExternalLink, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  const { id } = await params;

  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.userId)))
    .limit(1);

  if (!project) notFound();

  const edits = await db.select().from(editEvents)
    .where(eq(editEvents.projectId, id))
    .orderBy(desc(editEvents.createdAt))
    .limit(20);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3 w-3" />
          Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <a
                href={`https://github.com/${project.githubRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <GithubIcon className="h-3 w-3" />
                {project.githubRepo}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {project.branch}
              </span>
              {project.framework && (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                  {project.framework}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        {/* Editor — hero card */}
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <ContainerControls
            projectId={project.id}
            status={project.containerStatus}
            framework={project.framework}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status</p>
            <StatusPill status={project.containerStatus} />
          </div>
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Edits</p>
            <p className="text-lg font-bold">{edits.length}</p>
          </div>
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Last Active</p>
            <p className="text-xs font-medium mt-1">
              {project.lastActiveAt ? timeAgo(project.lastActiveAt) : "—"}
            </p>
          </div>
        </div>

        {/* Edit history */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Edit History
            </h2>
            {edits.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{edits.length} edits</span>
            )}
          </div>
          {edits.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Clock className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No edits yet</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Start the editor to make your first edit</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {edits.map((edit: any) => (
                <div key={edit.id} className="px-5 py-3 flex items-center gap-3">
                  {edit.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                  )}
                  <span className="text-xs flex-1 min-w-0 truncate">{edit.instruction}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {timeAgo(edit.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; dot: string }> = {
    RUNNING: { bg: "bg-success/10 text-success", dot: "bg-success" },
    STARTING: { bg: "bg-yellow-400/10 text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
    CREATING: { bg: "bg-yellow-400/10 text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
    STOPPED: { bg: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" },
    ERROR: { bg: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
    STOPPING: { bg: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" },
  };
  const s = styles[status] || styles.STOPPED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status.toLowerCase()}
    </span>
  );
}
