import { createContext, useCallback, useContext, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getScrapeProgress, cancelScrapeDocumentation } from "../api/data";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import type { ScrapeProgressResponse, ScrapeProgressStatus } from "../api/types";

// ── Friendly labels for each backend status ──────────────────────────
const STATUS_LABELS: Record<ScrapeProgressStatus, string> = {
  starting: "Starting…",
  discovering: "Discovering pages…",
  scraping: "Scraping pages…",
  indexing: "Indexing into vector DB…",
  completed: "Completed!",
  cancelled: "Cancelled",
  error: "Error",
};

const TERMINAL_STATUSES: ScrapeProgressStatus[] = ["completed", "cancelled", "error"];

// ── Per-job state ──────────────────────────────────────────────────────
interface JobState {
  progress: ScrapeProgressResponse | null;
}

// ── Context shape ─────────────────────────────────────────────────────
interface ScrapeProgressContextValue {
  startPolling: (url: string) => void;
}

const ScrapeProgressContext = createContext<ScrapeProgressContextValue | null>(null);

export function useScrapeProgress() {
  const ctx = useContext(ScrapeProgressContext);
  if (!ctx) throw new Error("useScrapeProgress must be used inside ScrapeProgressProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────
export function ScrapeProgressProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // Map of url -> JobState for all active/finished scraping jobs
  const [jobs, setJobs] = useState<Map<string, JobState>>(new Map());
  // Map of url -> interval id
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  // Whether the panel is minimized
  const [isMinimized, setIsMinimized] = useState(false);

  const stopPollingUrl = useCallback((url: string) => {
    const id = pollRefs.current.get(url);
    if (id !== undefined) {
      clearInterval(id);
      pollRefs.current.delete(url);
    }
  }, []);

  const startPolling = useCallback(
    (url: string) => {
      // If already polling this url, restart it
      stopPollingUrl(url);

      // Add / reset the job entry
      setJobs((prev) => {
        const next = new Map(prev);
        next.set(url, { progress: null });
        return next;
      });

      const poll = async () => {
        try {
          const data = await getScrapeProgress(url);
          setJobs((prev) => {
            const next = new Map(prev);
            next.set(url, { progress: data });
            return next;
          });
          if (TERMINAL_STATUSES.includes(data.status)) {
            stopPollingUrl(url);
            if (data.status === "completed") {
              queryClient.invalidateQueries({ queryKey: ["libraries"] });
            }
          }
        } catch {
          // Backend may not have the entry yet — keep polling
        }
      };

      poll();
      const id = setInterval(poll, 2000);
      pollRefs.current.set(url, id);
    },
    [stopPollingUrl, queryClient]
  );

  // ------------------------------------------------------------------
  // NEW: LocalStorage Persistence Logic
  // ------------------------------------------------------------------
  const hasRestored = useRef(false);

  // 1. Restore active jobs and panel state on mount
  useEffect(() => {
    if (!hasRestored.current) {
      // Restore the urls we were scraping
      const storedJobs = localStorage.getItem("active_scrape_urls");
      if (storedJobs) {
        try {
          const urls: string[] = JSON.parse(storedJobs);
          urls.forEach((url) => startPolling(url));
        } catch (e) {
          console.error("Failed to restore scrape jobs", e);
        }
      }

      // Restore if the panel was minimized or expanded
      const storedMinimized = localStorage.getItem("scrape_panel_minimized");
      if (storedMinimized !== null) {
        setIsMinimized(storedMinimized === "true");
      }
      
      hasRestored.current = true;
    }
  }, [startPolling]);

  // 2. Save job URLs to localStorage whenever a job is added or removed
  useEffect(() => {
    const urls = Array.from(jobs.keys());
    localStorage.setItem("active_scrape_urls", JSON.stringify(urls));
  }, [jobs]);

  // 3. Save minimized state to localStorage when toggled
  useEffect(() => {
    localStorage.setItem("scrape_panel_minimized", String(isMinimized));
  }, [isMinimized]);
  // ------------------------------------------------------------------

  const handleCancel = async (url: string) => {
    try {
      await cancelScrapeDocumentation();
    } catch {
      // ignore
    }
    // Optimistically mark as cancelled locally
    setJobs((prev) => {
      const next = new Map(prev);
      const job = next.get(url);
      if (job?.progress) {
        next.set(url, { progress: { ...job.progress, status: "cancelled" } });
      }
      return next;
    });
    stopPollingUrl(url);
  };

  const handleDismiss = (url: string) => {
    stopPollingUrl(url);
    setJobs((prev) => {
      const next = new Map(prev);
      next.delete(url);
      return next;
    });
  };

  const jobEntries = Array.from(jobs.entries());
  const hasJobs = jobEntries.length > 0;

  return (
    <ScrapeProgressContext.Provider value={{ startPolling }}>
      {children}

      {/* ── Global floating scrape-progress panel ──────────────────── */}
      {hasJobs && (
        <div className="fixed bottom-4 right-4 w-[calc(100vw-2rem)] sm:w-96 bg-bg-primary border border-border shadow-xl rounded-xl z-50 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Scraping Jobs ({jobEntries.length})
            </p>
            <button
              onClick={() => setIsMinimized((v) => !v)}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Job list — hidden when minimized, scrollable if many */}
          {!isMinimized && (
            <div className="max-h-[60vh] sm:max-h-[70vh] overflow-y-auto divide-y divide-border">
            {jobEntries.map(([url, { progress }]) => {
              const isTerminal = progress ? TERMINAL_STATUSES.includes(progress.status) : false;
              const pct =
                progress && progress.pages_total > 0
                  ? Math.round((progress.pages_done / progress.pages_total) * 100)
                  : 0;

              return (
                <div key={url} className="px-4 pt-3 pb-3">
                  {/* Job header */}
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-text-primary truncate pr-2">
                      {progress?.library_name ?? "Scraping…"}
                    </p>
                    {isTerminal ? (
                      <button
                        onClick={() => handleDismiss(url)}
                        className="text-text-muted hover:text-text-primary flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCancel(url)}
                        className="text-xs text-error hover:underline flex-shrink-0"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Status label */}
                  <p className="text-xs text-text-secondary mb-2">
                    {progress ? STATUS_LABELS[progress.status] : "Queued…"}
                    {progress && progress.pages_total > 0 && !isTerminal && (
                      <span className="ml-1 tabular-nums">
                        ({progress.pages_done}/{progress.pages_total})
                      </span>
                    )}
                  </p>

                  {/* Progress bar */}
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        progress?.status === "completed"
                          ? "bg-success"
                          : progress?.status === "error"
                          ? "bg-error"
                          : progress?.status === "cancelled"
                          ? "bg-warning"
                          : "bg-primary-500"
                      }`}
                      style={{
                        width:
                          progress?.status === "completed"
                            ? "100%"
                            : progress?.status === "starting" || progress?.status === "discovering"
                            ? "5%"
                            : `${Math.max(pct, 3)}%`,
                      }}
                    />
                  </div>

                  {/* Error message */}
                  {progress?.error && (
                    <p className="mt-2 text-xs text-error break-words">{progress.error}</p>
                  )}

                  {/* Completed message */}
                  {progress?.status === "completed" && (
                    <p className="mt-2 text-xs text-success">
                      Done! {progress.pages_done} pages scraped and indexed — ready to chat.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}
    </ScrapeProgressContext.Provider>
  );
}
