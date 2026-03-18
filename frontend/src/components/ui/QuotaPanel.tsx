import { useEffect } from "react";
import { useQuotaStore } from "../../stores/quotaStore";
import { useAuthStore } from "../../stores/authStore";

interface BarProps {
  label: string;
  used: number;
  limit: number;
}

function Bar({ label, used, limit }: BarProps) {
  const isUnlimited = limit <= 0;
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isHigh = pct >= 80;
  const isExhausted = pct >= 100;

  const barColor = isExhausted
    ? "bg-red-500"
    : isHigh
    ? "bg-yellow-400"
    : "bg-primary-500";

  const textColor = isExhausted
    ? "text-red-400"
    : isHigh
    ? "text-yellow-400"
    : "text-text-muted";

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className={textColor}>
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function QuotaPanel() {
  const { quota, fetchQuota } = useQuotaStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchQuota();
    const id = setInterval(fetchQuota, 60_000);
    return () => clearInterval(id);
  }, [fetchQuota, isAuthenticated]);

  if (!quota) return null;

  return (
    <div className="px-3 py-2.5 rounded-md bg-bg-primary border border-border space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Daily Usage
      </p>
      <Bar
        label="Queries"
        used={quota.queries.used}
        limit={quota.queries.limit}
      />
      <Bar
        label="Scrapes"
        used={quota.scrapes.used}
        limit={quota.scrapes.limit}
      />
    </div>
  );
}
