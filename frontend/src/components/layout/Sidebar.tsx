import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useSettingsStore } from "../../stores/settingsStore";
import { StatusBadge } from "../ui/StatusBadge";
import { Button } from "../ui/Button";
import { checkHealth } from "../../api/base";

const navigation = [
  { name: "Chat", href: "/", icon: ChatBubbleLeftRightIcon },
  { name: "Library Docs", href: "/library-docs", icon: GlobeAltIcon },
  { name: "Search", href: "/search", icon: MagnifyingGlassIcon },
  { name: "Index Info", href: "/index", icon: ChartBarIcon },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { apiUrl } = useSettingsStore();
  const [apiStatus, setApiStatus] = useState<"online" | "offline">("offline");
  const [isChecking, setIsChecking] = useState(false);

  const checkApiStatus = async () => {
    setIsChecking(true);
    try {
      await checkHealth();
      setApiStatus("online");
    } catch {
      setApiStatus("offline");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <aside
      className={`
        fixed md:static inset-y-0 left-0 z-30
        w-60 shrink-0 bg-bg-secondary border-r border-border flex flex-col h-full
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
    >
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Fehres
          </h1>
          <p className="text-xs text-text-muted mt-0.5">RAG System</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden text-text-muted hover:text-text-primary -mr-1"
          aria-label="Close menu"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                isActive ?
                  "bg-primary-600 text-white"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="truncate">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge
            status={apiStatus}
            text={isChecking ? "Checking..." : undefined}
          />
          <Button
            variant="ghost"
            size="sm"
            onPress={checkApiStatus}
            isLoading={isChecking}
          >
            Check
          </Button>
        </div>
        <p className="text-[11px] text-text-muted truncate" title={apiUrl}>
          {apiUrl}
        </p>
      </div>
    </aside>
  );
}
