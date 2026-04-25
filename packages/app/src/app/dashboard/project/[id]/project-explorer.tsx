"use client";

import { useEffect, useMemo, useState } from "react";

type Node = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: Node[];
};

type CssHints = {
  color?: string;
  backgroundColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  width?: string;
  height?: string;
};

function flattenFiles(nodes: Node[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "file") acc.push(n.path);
    if (n.type === "dir" && n.children) flattenFiles(n.children, acc);
  }
  return acc;
}

function extractHints(path: string, content: string): CssHints {
  const hints: CssHints = {};
  const lowerPath = path.toLowerCase();

  const colorMatch = content.match(/color\s*:\s*([^;\n]+)/i);
  if (colorMatch) hints.color = colorMatch[1].trim();

  const bgMatch = content.match(/background(?:-color)?\s*:\s*([^;\n]+)/i);
  if (bgMatch) hints.backgroundColor = bgMatch[1].trim();

  const radiusMatch = content.match(/border-radius\s*:\s*([^;\n]+)/i);
  if (radiusMatch) hints.borderRadius = radiusMatch[1].trim();

  const sizeMatch = content.match(/font-size\s*:\s*([^;\n]+)/i);
  if (sizeMatch) hints.fontSize = sizeMatch[1].trim();

  const weightMatch = content.match(/font-weight\s*:\s*([^;\n]+)/i);
  if (weightMatch) hints.fontWeight = weightMatch[1].trim();

  const widthMatch = content.match(/width\s*:\s*([^;\n]+)/i);
  if (widthMatch) hints.width = widthMatch[1].trim();

  const heightMatch = content.match(/height\s*:\s*([^;\n]+)/i);
  if (heightMatch) hints.height = heightMatch[1].trim();

  if ((lowerPath.endsWith(".tsx") || lowerPath.endsWith(".jsx") || lowerPath.endsWith(".vue")) && !hints.backgroundColor) {
    const classNameMatch = content.match(/class(Name)?=\"([^\"]+)\"/i);
    if (classNameMatch) hints.backgroundColor = `class: ${classNameMatch[2].split(" ").slice(0, 3).join(" ")}`;
  }

  return hints;
}

function TreeNode({
  node,
  level,
  selected,
  onSelect,
}: {
  node: Node;
  level: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(level < 1);
  const isDir = node.type === "dir";

  return (
    <div>
      <button
        type="button"
        onClick={() => (isDir ? setOpen(!open) : onSelect(node.path))}
        className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
          selected === node.path ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary"
        }`}
        style={{ paddingLeft: `${8 + level * 10}px` }}
      >
        {isDir ? (open ? "▾" : "▸") : "·"} {node.name}
      </button>
      {isDir && open && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} level={level + 1} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function detectFramework(path: string) {
  const p = path.toLowerCase();
  if (p.endsWith(".tsx") || p.endsWith(".jsx")) return "React";
  if (p.endsWith(".vue")) return "Vue";
  if (p.endsWith(".svelte")) return "Svelte";
  if (p.endsWith(".html")) return "HTML";
  if (p.endsWith(".css") || p.endsWith(".scss")) return "CSS";
  return "Unknown";
}

export function ProjectExplorer({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<Node[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadTree() {
      try {
        const res = await fetch(`/api/projects/${projectId}/files`);
        const data = await res.json();
        if (!active) return;
        const loaded = data.files || [];
        setFiles(loaded);
        const first = flattenFiles(loaded)[0];
        if (first) setSelectedPath(first);
      } catch {
        if (active) setFiles([]);
      }
      if (active) setLoadingTree(false);
    }
    loadTree();
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!selectedPath) return;
    const selectedPathSafe = selectedPath;
    let active = true;
    async function loadContent() {
      setLoadingContent(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/file-content?path=${encodeURIComponent(selectedPathSafe)}`);
        const data = await res.json();
        if (!active) return;
        setContent(data.content || "");
        setTruncated(!!data.truncated);
      } catch {
        if (active) {
          setContent("");
          setTruncated(false);
        }
      }
      if (active) setLoadingContent(false);
    }
    loadContent();
    return () => { active = false; };
  }, [projectId, selectedPath]);

  const framework = useMemo(() => (selectedPath ? detectFramework(selectedPath) : "Unknown"), [selectedPath]);
  const hints = useMemo(() => extractHints(selectedPath || "", content), [selectedPath, content]);

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project Explorer</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
        <div className="lg:col-span-3 border-r border-border p-3 max-h-[520px] overflow-auto">
          {loadingTree && <p className="text-xs text-muted-foreground px-2">Loading files...</p>}
          {!loadingTree && files.length === 0 && <p className="text-xs text-muted-foreground px-2">No files available yet.</p>}
          {!loadingTree && files.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              level={0}
              selected={selectedPath}
              onSelect={setSelectedPath}
            />
          ))}
        </div>

        <div className="lg:col-span-6 border-r border-border p-4 max-h-[520px] overflow-auto">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{selectedPath || "No file selected"}</p>
            {truncated && <p className="text-[10px] text-muted-foreground">content truncated</p>}
          </div>
          {loadingContent ? (
            <p className="text-xs text-muted-foreground">Loading source...</p>
          ) : (
            <pre className="text-[11px] leading-5 whitespace-pre-wrap break-words bg-secondary/50 rounded-lg p-3 border border-border">
{content || "Select a file from the left panel"}
            </pre>
          )}
        </div>

        <div className="lg:col-span-3 p-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property Mapping</p>
            <p className="mt-2 text-xs text-muted-foreground">Framework: {framework}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Detected editable hints</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>color: {hints.color || "-"}</p>
              <p>background: {hints.backgroundColor || "-"}</p>
              <p>border-radius: {hints.borderRadius || "-"}</p>
              <p>font-size: {hints.fontSize || "-"}</p>
              <p>font-weight: {hints.fontWeight || "-"}</p>
              <p>width: {hints.width || "-"}</p>
              <p>height: {hints.height || "-"}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 bg-secondary/40">
            <p className="text-xs font-medium mb-2">Prompt template</p>
            <p className="text-[11px] text-muted-foreground leading-5">
              请在 {selectedPath || "当前文件"} 中，把目标元素的背景色改为 #1a1a2e，圆角改为 12px，并保持现有结构不变。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
