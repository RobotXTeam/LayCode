import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listRepos } from "@/lib/github";
import { RepoSelector } from "./repo-selector";
import { LocalProjectForm } from "./local-project-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");
  let repos: Awaited<ReturnType<typeof listRepos>> | null = null;
  if (session.githubToken) {
    try {
      repos = await listRepos(session.githubToken);
    } catch {
      repos = null;
    }
  }

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-3 w-3" />
        Projects
      </Link>

      <h1 className="mb-2 text-xl font-bold">Import Project</h1>
      <p className="mb-6 text-sm text-muted-foreground">导入本地目录或 GitHub 仓库，开始可视化编辑。</p>

      <div className="grid gap-5">
        <LocalProjectForm />

        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">Import from GitHub</h2>
          <p className="mt-1 text-xs text-muted-foreground">选择 GitHub 仓库进行导入。</p>

          {!session.githubToken && (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-xs text-muted-foreground">尚未连接 GitHub 账号</p>
              <a
                href="/api/auth/github"
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <GithubIcon className="h-3.5 w-3.5" />
                Connect GitHub
              </a>
            </div>
          )}

          {session.githubToken && repos && <div className="mt-4"><RepoSelector repos={repos} /></div>}
          {session.githubToken && !repos && (
            <p className="mt-4 text-xs text-muted-foreground">仓库加载失败，请稍后重试或重新连接 GitHub。</p>
          )}
        </div>
      </div>
    </div>
  );
}
