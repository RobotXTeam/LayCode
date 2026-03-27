"use client";

import { useState, useEffect } from "react";
import { Play, Square, ExternalLink, Loader2 } from "lucide-react";

export function ContainerControls({
  projectId,
  status,
  framework,
}: {
  projectId: string;
  status: string;
  framework: string | null;
}) {
  const [containerStatus, setContainerStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [proxyPort, setProxyPort] = useState<number | null>(null);

  const editorUrl = proxyPort ? `http://localhost:${proxyPort}` : null;
  const isRunning = containerStatus === "RUNNING";
  const isStarting = containerStatus === "STARTING" || containerStatus === "CREATING";

  // Poll status on mount and while starting
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const res = await fetch(`/api/containers/${projectId}/status`);
        const data = await res.json();
        if (!active) return;
        setContainerStatus(data.status);
        if (data.proxyPort) setProxyPort(data.proxyPort);
      } catch {}
    }
    check();
    const interval = setInterval(check, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [projectId]);

  async function startContainer() {
    setLoading(true);
    setContainerStatus("STARTING");
    try {
      const res = await fetch(`/api/containers/${projectId}/start`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.proxyPort) setProxyPort(data.proxyPort);
        if (data.status === "RUNNING") {
          setContainerStatus("RUNNING");
          setLoading(false);
        } else {
          pollStatus();
        }
      } else {
        setContainerStatus("ERROR");
        setLoading(false);
      }
    } catch {
      setContainerStatus("ERROR");
      setLoading(false);
    }
  }

  async function stopContainer() {
    setLoading(true);
    setContainerStatus("STOPPING");
    try {
      await fetch(`/api/containers/${projectId}/stop`, { method: "POST" });
      setContainerStatus("STOPPED");
      setProxyPort(null);
    } catch {
      setContainerStatus("ERROR");
    }
    setLoading(false);
  }

  async function pollStatus() {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/containers/${projectId}/status`);
        const data = await res.json();
        setContainerStatus(data.status);
        if (data.proxyPort) setProxyPort(data.proxyPort);
        if (data.status === "RUNNING" || data.status === "ERROR") {
          setLoading(false);
          return;
        }
      } catch {
        break;
      }
    }
    setLoading(false);
  }

  if (isRunning && editorUrl) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-success" />
          </div>
          <div>
            <p className="text-xs font-medium">Editor is running</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{editorUrl}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={editorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="h-3 w-3" />
            Open Editor
          </a>
          <button
            onClick={stopContainer}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        </div>
      </div>
    );
  }

  if (isStarting) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 text-yellow-400 animate-spin" />
          </div>
          <div>
            <p className="text-xs font-medium">Starting editor...</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cloning repo and installing dependencies</p>
          </div>
        </div>
      </div>
    );
  }

  if (containerStatus === "ERROR") {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-destructive" />
          </div>
          <div>
            <p className="text-xs font-medium">Something went wrong</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Try starting the editor again</p>
          </div>
        </div>
        <button
          onClick={startContainer}
          disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Play className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  // Stopped
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        </div>
        <div>
          <p className="text-xs font-medium">Editor is stopped</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Start the editor to begin making changes</p>
        </div>
      </div>
      <button
        onClick={startContainer}
        disabled={loading}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Play className="h-3 w-3" />
        Start Editor
      </button>
    </div>
  );
}
