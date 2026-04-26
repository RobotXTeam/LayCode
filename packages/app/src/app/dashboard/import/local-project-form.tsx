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
      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`服务器返回非 JSON 错误 (状态码: ${res.status})`);
      }
      if (!res.ok) throw new Error((data as any).error || "创建本地项目失败");
      router.push(`/dashboard/project/${(data as any).id}`);
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
        <div className="flex gap-2">
          <input
            type="text"
            value={localPath}
            onChange={(e) => {
              setLocalPath(e.target.value);
              if (!name.trim()) setName(normalizeNameFromPath(e.target.value));
            }}
            placeholder="/absolute/path/to/project"
            className="flex-1 h-10 px-4 rounded-lg border border-input bg-secondary text-sm placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
          />
          <button
            onClick={async () => {
              // @ts-ignore
              if (window.laycodeDesktop?.pickDirectory) {
                // @ts-ignore
                const result = await window.laycodeDesktop.pickDirectory();
                if (result && !result.canceled && result.filePaths?.length > 0) {
                  const path = result.filePaths[0];
                  setLocalPath(path);
                  if (!name.trim()) setName(normalizeNameFromPath(path));
                }
              } else {
                setError("当前非桌面应用环境，无法调出文件夹选择器，请手动输入。");
              }
            }}
            className="h-10 px-4 rounded-md bg-secondary border border-border text-xs font-semibold hover:bg-secondary/80 focus:ring-2 focus:ring-ring transition-colors shrink-0"
          >
            选择目录...
          </button>
        </div>
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
