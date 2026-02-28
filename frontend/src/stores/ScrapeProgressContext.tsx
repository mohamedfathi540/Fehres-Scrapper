import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getScrapeProgress, cancelScrapeDocumentation } from "../api/data";
import { XMarkIcon } from "@heroicons/react/24/outline";
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

  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScrapeProgressResponse | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (url: string) => {
      stopPolling();
      setActiveUrl(url);
      setProgress(null);

      const poll = async () => {
        try {
          const data = await getScrapeProgress(url);
          setProgress(data);
          if (TERMINAL_STATUSES.includes(data.status)) {
            stopPolling();
            if (data.status === "completed") {
              queryClient.invalidateQueries({ queryKey: ["libraries"] });
            }
          }
        } catch {
          // Backend may not have the entry yet — keep polling
        }
      };

      poll();
      pollRef.current = setInterval(poll, 2000);
    },
    [stopPolling, queryClient]
  );

  const handleCancel = async () => {
    try {
      await cancelScrapeDocumentation();
    } catch {
      // ignore
    }
  };

  const handleDismiss = () => {
    stopPolling();
    setActiveUrl(null);
    setProgress(null);
  };

  const isPolling = activeUrl !== null;
  const pct =
    progress && progress.pages_total > 0
      ? Math.round((progress.pages_done / progress.pages_total) * 100)
      : 0;
  const isTerminal = progress ? TERMINAL_STATUSES.includes(progress.status) : false;

  return (
    <ScrapeProgressContext.Provider value={{ startPolling }}>
      {children}

      {/* ── Global floating scrape-progress panel ──────────────────── */}
      {isPolling && (
        <div className="fixed bottom-4 right-4 w-96 bg-bg-primary border border-border shadow-xl rounded-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-sm font-semibold text-text-primary truncate">
              {progress?.library_name ?? "Scraping"}
            </p>
            {isTerminal ? (
              <button onClick={handleDismiss} className="text-text-muted hover:text-text-primary">
                <XMarkIcon className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleCancel} className="text-xs text-error hover:underline">
                Cancel
              </button>
            )}
          </div>

          {/* Status label */}
          <p className="px-4 text-xs text-text-secondary">
            {progress ? STATUS_LABELS[progress.status] : "Queued…"}
            {progress && progress.pages_total > 0 && !isTerminal && (
              <span className="ml-1 tabular-nums">
                ({progress.pages_done}/{progress.pages_total})
              </span>
            )}
          </p>

          {/* Progress bar */}
          <div className="px-4 py-3">
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
          </div>

          {/* Error message */}
          {progress?.error && (
            <div className="px-4 pb-3">
              <p className="text-xs text-error break-words">{progress.error}</p>
            </div>
          )}

          {/* Completed message */}
          {progress?.status === "completed" && (
            <div className="px-4 pb-3">
              <p className="text-xs text-success">
                Done! {progress.pages_done} pages scraped and indexed — ready to chat.
              </p>
            </div>
          )}
        </div>
      )}
    </ScrapeProgressContext.Provider>
  );
}
