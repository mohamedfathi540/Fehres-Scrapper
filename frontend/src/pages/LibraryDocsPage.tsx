import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GlobeAltIcon, PlusIcon, BookOpenIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { scrapeDocumentation, getLibraries, getScrapeProgress, cancelScrapeDocumentation } from "../api/data";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import type { Library, ScrapeProgressResponse, ScrapeProgressStatus } from "../api/types";

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

export function LibraryDocsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [doReset, setDoReset] = useState(false);

  // ── Progress‑polling state ─────────────────────────────────────────
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScrapeProgressResponse | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Libraries
  const { data: librariesData, refetch: refetchLibraries } = useQuery({
    queryKey: ["libraries"],
    queryFn: getLibraries,
  });

  // ── Polling logic ──────────────────────────────────────────────────
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
              refetchLibraries();
            }
          }
        } catch {
          // Backend may not have the entry yet – that's fine, keep polling
        }
      };

      // First poll right away, then every 2 s
      poll();
      pollRef.current = setInterval(poll, 2000);
    },
    [stopPolling, refetchLibraries]
  );

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Scrape mutation ────────────────────────────────────────────────
  const scrapeMutation = useMutation({
    mutationFn: () =>
      scrapeDocumentation({
        base_url: baseUrl,
        library_name: newLibraryName,
        Do_reset: doReset ? 1 : 0,
      }),
    onSuccess: () => {
      // The backend accepted the job (202). Start polling progress.
      const url = baseUrl.trim();
      setIsModalOpen(false);
      setNewLibraryName("");
      setBaseUrl("");
      startPolling(url);
    },
  });

  const handleScrape = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrl.trim() || !newLibraryName.trim()) return;
    scrapeMutation.mutate();
  };

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

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // ── Derived progress values ────────────────────────────────────────
  const isPolling = activeUrl !== null;
  const pct =
    progress && progress.pages_total > 0
      ? Math.round((progress.pages_done / progress.pages_total) * 100)
      : 0;
  const isTerminal = progress ? TERMINAL_STATUSES.includes(progress.status) : false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
            Libraries
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Manage your documentation libraries.
          </p>
        </div>
        <Button onPress={() => setIsModalOpen(true)}>
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Library
        </Button>
      </div>

      {/* Library List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {librariesData?.libraries?.map((lib: Library) => (
          <Card key={lib.id} title={lib.name} className="hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <BookOpenIcon className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-text-secondary">Project ID: {lib.id}</p>
              </div>
            </div>
            <div className="text-sm text-text-muted">
              Ready to chat.
            </div>
          </Card>
        ))}
        {librariesData?.libraries?.length === 0 && (
          <div className="col-span-full text-center py-10 text-text-muted">
            No libraries found. Add one to get started.
          </div>
        )}
      </div>


      {/* Add Library Modal (Simple Overlay) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-primary rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Add New Library</h3>

            <form onSubmit={handleScrape} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Library Name
                </label>
                <input
                  type="text"
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  placeholder="e.g. FastAPI, React"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Documentation URL
                </label>
                <div className="relative">
                  <GlobeAltIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="doReset"
                  checked={doReset}
                  onChange={(e) => setDoReset(e.target.checked)}
                />
                <label htmlFor="doReset" className="text-sm text-text-secondary">
                  Reset content if exists
                </label>
              </div>

              {scrapeMutation.isError && (
                <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
                  {scrapeMutation.error instanceof Error ? scrapeMutation.error.message : "Failed to start scraping"}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="secondary" onPress={() => setIsModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={scrapeMutation.isPending}
                  isDisabled={!baseUrl.trim() || !newLibraryName.trim() || !isValidUrl(baseUrl)}
                >
                  Start Scraping
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Scraping Progress Panel ─────────────────────────────────── */}
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
              <button
                onClick={handleCancel}
                className="text-xs text-error hover:underline"
              >
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

    </div>
  );
}
