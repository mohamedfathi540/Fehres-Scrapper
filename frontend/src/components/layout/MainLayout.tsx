import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Workflow } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-border bg-bg-secondary shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-secondary hover:text-text-primary"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="p-1 bg-primary-600 rounded-lg">
            <Workflow className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-white">Fehres</h1>
          <span className="text-xs text-text-muted">RAG System</span>
        </header>

        <main className="flex-1 overflow-auto min-w-0">
          <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
