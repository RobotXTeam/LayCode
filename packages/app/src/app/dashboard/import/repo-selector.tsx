"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GitHubRepo } from "@/lib/github";

export function RepoSelector({ repos }: { repos: GitHubRepo[] }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  async function selectRepo(repo: GitHubRepo) {
    setLoading(repo.full_name);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepo: repo.full_name,
          name: repo.name,
          branch: repo.default_branch,
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const project = await res.json();
      router.push(`/dashboard/project/${project.id}`);
    } catch {
      setLoading(null);
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search repositories..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full h-10 px-4 rounded-lg border border-input bg-secondary text-sm placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
      />
      <div className="grid gap-2">
        {filtered.map((repo) => (
          <button
            key={repo.id}
            onClick={() => selectRepo(repo)}
            disabled={loading !== null}
            className="flex items-center justify-between rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition hover:ring-foreground/20 disabled:opacity-50"
          >
            <div>
              <span className="text-[13px] font-medium">{repo.full_name}</span>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                {repo.language && <span>{repo.language}</span>}
                {repo.private && <span>Private</span>}
                <span>{repo.default_branch}</span>
              </div>
            </div>
            {loading === repo.full_name ? (
              <span className="text-xs text-muted-foreground">Creating...</span>
            ) : (
              <span className="text-xs text-muted-foreground">Select</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No repositories found</p>
        )}
      </div>
    </div>
  );
}
