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
        className="mb-4 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
      />
      <div className="grid gap-2">
        {filtered.map((repo) => (
          <button
            key={repo.id}
            onClick={() => selectRepo(repo)}
            disabled={loading !== null}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition hover:border-zinc-700 disabled:opacity-50"
          >
            <div>
              <span className="font-medium">{repo.full_name}</span>
              <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                {repo.language && <span>{repo.language}</span>}
                {repo.private && <span>Private</span>}
                <span>{repo.default_branch}</span>
              </div>
            </div>
            {loading === repo.full_name ? (
              <span className="text-xs text-zinc-400">Creating...</span>
            ) : (
              <span className="text-xs text-zinc-600">Select</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-600">No repositories found</p>
        )}
      </div>
    </div>
  );
}
