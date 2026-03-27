"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Lock, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GitHubRepo } from "@/lib/github";

const PAGE_SIZE = 5;

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(0); // -1 prev, 1 next
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRepos(data);
        else setError("Failed to load repositories");
      })
      .catch(() => setError("Failed to load repositories"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page and selection on search
  useEffect(() => {
    setPage(0);
    setSelectedIndex(0);
  }, [search]);

  function goPage(newPage: number) {
    setDirection(newPage > page ? 1 : -1);
    setPage(newPage);
    setSelectedIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedIndex < pageItems.length - 1) {
        setSelectedIndex((i) => i + 1);
      } else if (page < totalPages - 1) {
        goPage(page + 1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (selectedIndex > 0) {
        setSelectedIndex((i) => i - 1);
      } else if (page > 0) {
        goPage(page - 1);
        setSelectedIndex(PAGE_SIZE - 1);
      }
    } else if (e.key === "ArrowRight" && totalPages > 1) {
      e.preventDefault();
      if (page < totalPages - 1) goPage(page + 1);
    } else if (e.key === "ArrowLeft" && totalPages > 1) {
      e.preventDefault();
      if (page > 0) goPage(page - 1);
    } else if (e.key === "Enter" && pageItems[selectedIndex]) {
      e.preventDefault();
      selectRepo(pageItems[selectedIndex]);
    }
  }

  async function selectRepo(repo: GitHubRepo) {
    setCreating(repo.full_name);
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
      if (!res.ok) throw new Error();
      const project = await res.json();
      router.push(`/dashboard/project/${project.id}`);
    } catch {
      setCreating(null);
    }
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 20 : -20, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -20 : 20, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        className="relative w-full max-w-md mx-4 rounded-xl bg-popover ring-1 ring-foreground/10 shadow-2xl overflow-hidden"
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            className="flex-1 h-12 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={onClose}
            className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* List */}
        <div className="min-h-[280px]">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground h-[280px]"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading repositories...
            </motion.div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center h-[280px] flex flex-col items-center justify-center"
            >
              <p className="text-xs text-muted-foreground">{error}</p>
              <a href="/api/auth/github" className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground transition-colors">
                Reconnect GitHub →
              </a>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center text-xs text-muted-foreground h-[280px] flex items-center justify-center"
            >
              {search ? `No repositories matching "${search}"` : "No repositories found"}
            </motion.div>
          ) : (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={page}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="p-1.5"
              >
                {pageItems.map((repo, i) => (
                  <motion.button
                    key={repo.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.15 }}
                    onClick={() => selectRepo(repo)}
                    disabled={creating !== null}
                    data-selected={i === selectedIndex}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                      i === selectedIndex ? "bg-secondary" : ""
                    }`}
                  >
                    <GithubIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">{repo.name}</span>
                        {repo.private && <Lock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="truncate">{repo.full_name}</span>
                        <span>·</span>
                        <span>{timeAgo(repo.updated_at)}</span>
                      </div>
                    </div>
                    {creating === repo.full_name ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
                    ) : (
                      repo.language && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{repo.language}</span>
                      )
                    )}
                  </motion.button>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="rounded bg-secondary px-1 py-0.5 text-[9px]">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="rounded bg-secondary px-1 py-0.5 text-[9px]">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="rounded bg-secondary px-1 py-0.5 text-[9px]">esc</kbd> close</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page === 0}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-[10px] text-muted-foreground min-w-[3ch] text-center">
                  {page + 1}/{totalPages}
                </span>
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
