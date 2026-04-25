"use client";

import { useEffect, useState } from "react";

type Node = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: Node[];
};

function TreeNode({ node, level = 0 }: { node: Node; level?: number }) {
  const [open, setOpen] = useState(level < 1);
  const isDir = node.type === "dir";

  return (
    <div>
      <button
        type="button"
        onClick={() => isDir && setOpen(!open)}
        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-secondary text-xs text-muted-foreground"
        style={{ paddingLeft: `${8 + level * 10}px` }}
      >
        {isDir ? (open ? "▾" : "▸") : "·"} {node.name}
      </button>
      {isDir && open && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} level={level + 1} />
      ))}
    </div>
  );
}

export function FileTree({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/files`);
        const data = await res.json();
        if (active) setFiles(data.files || []);
      } catch {
        if (active) setFiles([]);
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project Files</h2>
      </div>
      <div className="p-3 max-h-80 overflow-auto">
        {loading && <p className="text-xs text-muted-foreground px-2">Loading files...</p>}
        {!loading && files.length === 0 && <p className="text-xs text-muted-foreground px-2">No files available yet. Start editor first.</p>}
        {!loading && files.map((node) => <TreeNode key={node.path} node={node} />)}
      </div>
    </div>
  );
}
