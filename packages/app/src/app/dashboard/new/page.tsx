import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listRepos } from "@/lib/github";
import { RepoSelector } from "./repo-selector";

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  if (!session.githubToken) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-zinc-500">GitHub token expired. Please sign in again.</p>
        <a href="/api/auth/github" className="mt-4 text-sm text-zinc-400 hover:text-zinc-300">
          Reconnect GitHub
        </a>
      </div>
    );
  }

  let repos;
  try {
    repos = await listRepos(session.githubToken);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-zinc-500">Failed to load repositories. Please try again.</p>
        <a href="/api/auth/github" className="mt-4 text-sm text-zinc-400 hover:text-zinc-300">
          Reconnect GitHub
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">New Project</h1>
      <p className="mb-8 text-zinc-500">Select a repository to start editing visually.</p>
      <RepoSelector repos={repos} />
    </div>
  );
}
