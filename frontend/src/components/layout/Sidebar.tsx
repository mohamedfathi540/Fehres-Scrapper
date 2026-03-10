import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  BarChart3,
  Globe,
  Search,
  X,
  Workflow,
  LogOut,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAuthStore } from "../../stores/authStore";
import { StatusBadge } from "../ui/StatusBadge";
import { Button } from "../ui/Button";
import { checkHealth } from "../../api/base";

const navigation = [
  { name: "Chat", href: "/", icon: MessageSquare },
  { name: "Library Docs", href: "/library-docs", icon: Globe },
  { name: "Search", href: "/search", icon: Search },
  { name: "Index Info", href: "/index", icon: BarChart3 },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { apiUrl } = useSettingsStore();
  const logout = useAuthStore((s) => s.logout);
  const email = useAuthStore((s) => s.email);
  const navigate = useNavigate();
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
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary-600 rounded-lg">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Fehres
            </h1>
            <p className="text-xs text-text-muted mt-0.5">RAG System</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden text-text-muted hover:text-text-primary -mr-1"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
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
        {email && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-text-secondary truncate" title={email}>
              {email}
            </p>
            <button
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
              className="text-text-muted hover:text-error transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
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
