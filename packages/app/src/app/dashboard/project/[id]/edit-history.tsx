"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Edit {
  hash: string;
  message: string;
  timeAgo: string;
}

export function EditHistory({ projectId }: { projectId: string }) {
  const [edits, setEdits] = useState<Edit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetch_edits() {
      try {
        const res = await fetch(`/api/containers/${projectId}/edits`);
        const data = await res.json();
        if (active && data.edits) setEdits(data.edits);
      } catch {}
      if (active) setLoading(false);
    }

    fetch_edits();
    const interval = setInterval(fetch_edits, 10000);
    return () => { active = false; clearInterval(interval); };
  }, [projectId]);

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Edit History
        </h2>
        {edits.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{edits.length} edit{edits.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <div className="px-5 py-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading...
        </div>
      ) : edits.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Clock className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No edits yet</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Your website is ready — open the editor to start customizing</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {edits.map((edit, i) => (
            <motion.div
              key={edit.hash}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className="px-5 py-3 flex items-center gap-3"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
              <span className="text-xs flex-1 min-w-0 truncate">{edit.message}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">{edit.timeAgo}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
