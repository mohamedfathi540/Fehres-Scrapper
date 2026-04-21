import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Send,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { MarkdownMessage } from "../components/ui/MarkdownMessage";
import { useSettingsStore } from "../stores/settingsStore";
import { runAgent } from "../api/agent";
import { getLibraries } from "../api/data";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { generateId, formatDate } from "../utils/helpers";
import type { ChatMessage } from "../api/types";
import type { AgentStep } from "../api/agent.types";

// ─── Reasoning Trace Sub-component ──────────────────────────────────────────

function ReasoningTrace({
  steps,
  sources,
}: {
  steps: AgentStep[];
  sources: string[];
}) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);

  const formatSource = (src: unknown) => {
    if (typeof src !== 'string') return String(src);
    let identity = src.split('\\n')[0].split('\n')[0].trim();
    if (identity.endsWith(']')) {
      identity = identity.slice(0, -1);
    }
    return identity;
  };

  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const renderToolTag = (toolName: string) => {
    const isSearch = toolName.includes("search");
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-semibold ${
          isSearch
            ? "bg-primary-500/10 text-primary-500 border border-primary-500/20"
            : "bg-purple-500/10 text-purple-500 border border-purple-500/20"
        }`}
      >
        {toolName}
      </span>
    );
  };

  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-3">
      {/* Collapsible trace header */}
      <button
        onClick={() => setIsTraceOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors"
      >
        {isTraceOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <BrainCircuit className="w-3.5 h-3.5 text-primary-500" />
        Reasoning Trace ({steps.length} step{steps.length !== 1 ? "s" : ""})
      </button>

      {isTraceOpen && (
        <div className="relative pl-3 border-l-2 border-border/40 space-y-2 ml-1 animate-fade-in">
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(index);
            return (
              <div
                key={index}
                className="rounded-lg border border-border/60 bg-bg-primary overflow-hidden"
              >
                {/* Step header */}
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-bg-tertiary/40 transition-colors"
                  onClick={() => toggleStep(index)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-bg-secondary border border-border text-[10px] font-medium text-text-secondary shrink-0">
                      {step.step}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      {renderToolTag(step.tool)}
                      <span className="text-xs text-text-muted truncate max-w-[160px] md:max-w-xs">
                        {JSON.stringify(step.args).substring(0, 80)}…
                      </span>
                    </div>
                  </div>
                  <div className="text-text-muted ml-2 shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-2 bg-bg-primary border-t border-border/40 text-xs space-y-2">
                    <div>
                      <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                        Arguments
                      </h4>
                      <pre className="bg-bg-secondary p-2 rounded border border-border/40 text-text-secondary overflow-x-auto leading-relaxed">
                        {JSON.stringify(step.args, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                        Result
                      </h4>
                      <div className="bg-bg-secondary p-2 rounded border border-border/40 text-text-secondary max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar break-words">
                        {typeof step.result === 'string' ? step.result.replace(/\\n/g, '\n') : step.result}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setIsSourcesOpen((v) => !v)}
            className="flex items-center gap-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 hover:text-text-primary transition-colors"
          >
            {isSourcesOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Sources Referenced ({sources.length})
          </button>
          
          {isSourcesOpen && (
            <div className="flex flex-col gap-1.5 pl-5 border-l-2 border-border/40 animate-fade-in">
              {sources.map((src, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1.5 rounded text-[11px] font-medium bg-bg-tertiary text-text-secondary border border-border/50 truncate"
                  title="Source Document"
                >
                  {formatSource(src)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ChatPage ────────────────────────────────────────────────────────────────

export function ChatPage() {
  const { chats, activeLibraryId, setActiveLibraryId, addMessage, clearHistory } =
    useSettingsStore();
  const [question, setQuestion] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Libraries
  const { data: librariesData } = useQuery({
    queryKey: ["libraries"],
    queryFn: getLibraries,
  });

  const libraries = librariesData?.libraries || [];

  // Isolated chat history per library
  const currentChatHistory = activeLibraryId ? chats[activeLibraryId] || [] : [];

  // Auto-select first library
  useEffect(() => {
    if (!activeLibraryId && libraries.length > 0) {
      setActiveLibraryId(libraries[0].id);
    }
  }, [libraries, activeLibraryId, setActiveLibraryId]);

  const selectedLibrary = libraries.find((l) => l.id === activeLibraryId);

  // ── Agent mutation (replaces simple RAG answer) ──────────────────────────
  const agentMutation = useMutation({
    mutationFn: (text: string) =>
      runAgent({
        goal: text,
        project_name: selectedLibrary?.name,
        chat_history: currentChatHistory
          .slice(-10)
          .filter(
            (m): m is typeof m & { role: "user" | "assistant" } =>
              m.role === "user" || m.role === "assistant"
          )
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date().toISOString(),
        metadata: {
          steps: data.steps,
          sources: data.sources,
        },
      };
      if (activeLibraryId) addMessage(activeLibraryId, assistantMessage);
    },
    onError: (error) => {
      const isQuotaError =
        error instanceof Error &&
        error.message.toLowerCase().includes("quota exceeded");
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: isQuotaError
          ? "You have reached your usage limit. Please wait until your quota resets or upgrade your account."
          : `${error instanceof Error ? error.message : "Failed to get an answer from the agent."}`,
        timestamp: new Date().toISOString(),
        metadata: {
          isError: true,
          isQuotaError,
        },
      };
      if (activeLibraryId) addMessage(activeLibraryId, errorMessage);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || agentMutation.isPending || !selectedLibrary || !activeLibraryId)
      return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };
    addMessage(activeLibraryId, userMessage);
    agentMutation.mutate(question);
    setQuestion("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChatHistory, agentMutation.isPending]);

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-4rem)] min-h-0">
      {/* Header with Library Selector */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary-500" />
            Chat
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Autonomous agent reasoning over your indexed documents
          </p>
        </div>

        {/* Library Selector */}
        <div className="relative">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Select Library
          </label>
          <div className="relative w-full sm:w-64">
            <select
              value={activeLibraryId || ""}
              onChange={(e) => setActiveLibraryId(Number(e.target.value))}
              className="w-full appearance-none bg-bg-primary border border-border text-text-primary px-4 py-2 pr-8 rounded-lg focus:outline-none focus:border-primary-500 cursor-pointer"
              disabled={libraries.length === 0}
            >
              {libraries.length === 0 ? (
                <option value="">No libraries available</option>
              ) : (
                libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <Card
        className="flex flex-col flex-1 overflow-hidden min-h-0"
        contentClassName="flex flex-col flex-1 min-h-0 p-0"
      >
        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {currentChatHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BrainCircuit className="w-10 h-10 text-primary-500/40 mx-auto mb-3" />
                <p className="text-lg mb-2 text-text-primary">Welcome to Fehres Chat</p>
                <p className="text-sm text-text-secondary">
                  {selectedLibrary
                    ? `Ask questions about ${selectedLibrary.name}`
                    : "Select a library to start chatting"}
                </p>
              </div>
            </div>
          ) : (
            currentChatHistory.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 flex flex-col gap-1 ${
                    message.role === "user"
                      ? "bg-primary-600 text-white rounded-br-none"
                      : message.metadata?.isQuotaError
                      ? "bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316] rounded-bl-none"
                      : message.metadata?.isError
                      ? "bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-bl-none"
                      : "bg-bg-tertiary text-text-primary border border-border rounded-bl-none"
                  }`}
                >
                  {/* Quota Header */}
                  {message.metadata?.isQuotaError && (
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Quota Exceeded</span>
                    </div>
                  )}

                  {/* General Error Header */}
                  {message.metadata?.isError && !message.metadata?.isQuotaError && (
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>System Error</span>
                    </div>
                  )}

                  {/* Message Content */}
                  {message.role === "assistant" && !message.metadata?.isError ? (
                    <>
                      {/* Agent conclusion header */}
                      <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-text-secondary">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        Agent Conclusion
                      </div>
                      <div className="chat-markdown">
                        <MarkdownMessage content={message.content} />
                      </div>

                      {/* Reasoning Trace — only if agent data exists */}
                      {message.metadata?.steps && message.metadata.steps.length > 0 && (
                        <ReasoningTrace
                          steps={message.metadata.steps}
                          sources={message.metadata.sources || []}
                        />
                      )}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  )}

                  <span className="text-xs opacity-70 mt-1 block">
                    {formatDate(message.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}

          {/* Loading indicator */}
          {agentMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-bg-tertiary border border-border rounded-2xl rounded-bl-none px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-500" />
                  Agent Reasoning…
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-bg-secondary">
          {currentChatHistory.length > 0 && (
            <div className="mb-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => activeLibraryId && clearHistory(activeLibraryId)}
              >
                Clear History
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                selectedLibrary
                  ? `Ask about ${selectedLibrary.name}…`
                  : "Select a library first"
              }
              disabled={agentMutation.isPending || !selectedLibrary}
              className="flex-1 px-4 py-3 bg-bg-tertiary border border-border rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-600 disabled:opacity-50 transition-all"
            />
            <Button
              type="submit"
              isLoading={agentMutation.isPending}
              isDisabled={!question.trim() || !selectedLibrary}
            >
              <Send className="w-5 h-5" />
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
