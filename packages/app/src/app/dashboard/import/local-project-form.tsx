"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function normalizeNameFromPath(path: string) {
  const chunks = path.split("/").filter(Boolean);
  if (chunks.length === 0) return "local-project";
  return chunks[chunks.length - 1];
}

export function LocalProjectForm() {
  const [localPath, setLocalPath] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function createLocalProject() {
    const trimmedPath = localPath.trim();
    const trimmedName = name.trim() || normalizeNameFromPath(trimmedPath);
    if (!trimmedPath) {
      setError("请输入本地项目绝对路径");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "local",
          localPath: trimmedPath,
          name: trimmedName,
          branch: "main",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建本地项目失败");
      router.push(`/dashboard/project/${data.id}`);
    } catch (err: any) {
      setError(err.message || "创建本地项目失败");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="text-sm font-semibold">导入本地项目</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        输入本地目录绝对路径，例如 /home/steven/work/my-app。LayCode 会直接在本地目录内启动并编辑代码。
      </p>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={localPath}
          onChange={(e) => {
            setLocalPath(e.target.value);
            if (!name.trim()) setName(normalizeNameFromPath(e.target.value));
          }}
          placeholder="/absolute/path/to/project"
          className="w-full h-10 px-4 rounded-lg border border-input bg-secondary text-sm placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="项目名称（可选）"
          className="w-full h-10 px-4 rounded-lg border border-input bg-secondary text-sm placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={createLocalProject}
          disabled={loading}
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "创建中..." : "导入本地目录"}
        </button>
      </div>
    </div>
  );
}
