import { cn } from "../../utils/helpers";

interface StatusBadgeProps {
  status: "online" | "offline" | "processing" | "success" | "error" | "warning";
  text?: string;
  className?: string;
}

const statusConfig = {
  online: {
    bg: "bg-success/15",
    border: "border-success/30",
    text: "text-success",
    dot: "bg-success",
    label: "Online",
  },
  offline: {
    bg: "bg-error/15",
    border: "border-error/30",
    text: "text-error",
    dot: "bg-error",
    label: "Offline",
  },
  processing: {
    bg: "bg-warning/15",
    border: "border-warning/30",
    text: "text-warning",
    dot: "bg-warning",
    label: "Processing",
  },
  success: {
    bg: "bg-success/15",
    border: "border-success/30",
    text: "text-success",
    dot: "bg-success",
    label: "Success",
  },
  error: {
    bg: "bg-error/15",
    border: "border-error/30",
    text: "text-error",
    dot: "bg-error",
    label: "Error",
  },
  warning: {
    bg: "bg-warning/15",
    border: "border-warning/30",
    text: "text-warning",
    dot: "bg-warning",
    label: "Warning",
  },
};

export function StatusBadge({ status, text, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border",
        config.bg,
        config.border,
        config.text,
        className,
      )}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          config.dot,
          status === "processing" && "animate-pulse",
        )}
      />
      {text || config.label}
    </span>
  );
}
