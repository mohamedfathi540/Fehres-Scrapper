import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send, ChevronDown, AlertTriangle, AlertCircle } from "lucide-react";
import { MarkdownMessage } from "../components/ui/MarkdownMessage";
import { useSettingsStore } from "../stores/settingsStore";
import { getAnswer } from "../api/nlp";
import { getLibraries } from "../api/data";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { generateId, formatDate } from "../utils/helpers";
import type { ChatMessage } from "../api/types";

export function ChatPage() {
  const { chats, activeLibraryId, setActiveLibraryId, addMessage, clearHistory } = useSettingsStore();
  const [question, setQuestion] = useState("");
  const contextLimit = 10;
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Libraries
  const { data: librariesData } = useQuery({
    queryKey: ["libraries"],
    queryFn: getLibraries,
  });

  const libraries = librariesData?.libraries || [];

  // Get the current isolated chat history
  const currentChatHistory = activeLibraryId ? (chats[activeLibraryId] || []) : [];

  // Auto-select first library if none selected and libraries exist
  useEffect(() => {
    if (!activeLibraryId && libraries.length > 0) {
      setActiveLibraryId(libraries[0].id);
    }
  }, [libraries, activeLibraryId, setActiveLibraryId]);

  const selectedLibrary = libraries.find(l => l.id === activeLibraryId);

  const answerMutation = useMutation({
    mutationFn: (text: string) =>
      getAnswer({
        text,
        limit: contextLimit,
        project_name: selectedLibrary?.name,
        chat_history: currentChatHistory
          .slice(-10)
          .filter((m): m is typeof m & { role: "user" | "assistant" } =>
            m.role === "user" || m.role === "assistant"
          )
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: data.Answer,
        timestamp: new Date().toISOString(),
        metadata: {
          fullPrompt: data.FullPrompt,
          chatHistory: data.ChatHistory,
        },
      };
      if (activeLibraryId) addMessage(activeLibraryId, assistantMessage);
    },
    onError: (error) => {
      const isQuotaError = error instanceof Error && error.message.toLowerCase().includes('quota exceeded');
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: isQuotaError
          ? "You have reached your usage limit. Please wait until your quota resets or upgrade your account."
          : `${error instanceof Error ? error.message : "Failed to get an answer from the server."}`,
        timestamp: new Date().toISOString(),
        metadata: {
          isError: true,
          isQuotaError: isQuotaError,
        },
      };
      if (activeLibraryId) addMessage(activeLibraryId, errorMessage);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || answerMutation.isPending || !selectedLibrary || !activeLibraryId) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };
    addMessage(activeLibraryId, userMessage);
    answerMutation.mutate(question);
    setQuestion("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChatHistory, answerMutation.isPending]);

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-4rem)] min-h-0">
      {/* Header with Library Selector */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
            Chat
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Ask questions about your indexed documents
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {currentChatHistory.length === 0 ?
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-lg mb-2 text-text-primary">
                  Welcome to Fehres Chat
                </p>
                <p className="text-sm text-text-secondary">
                  {selectedLibrary
                    ? `Ask questions about ${selectedLibrary.name}`
                    : "Select a library to start chatting"}
                </p>
              </div>
            </div>
            : currentChatHistory.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 flex flex-col gap-1 ${
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
                    <div className="chat-markdown">
                      <MarkdownMessage content={message.content} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  )}

                  <span className="text-xs opacity-70 mt-1 block">
                    {formatDate(message.timestamp)}
                  </span>
                </div>
              </div>
            ))
          }
          {answerMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-bg-tertiary border border-border rounded-2xl rounded-bl-none px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce delay-200" />
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
              <Button variant="ghost" size="sm" onPress={() => activeLibraryId && clearHistory(activeLibraryId)}>
                Clear History
              </Button>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={selectedLibrary ? `Ask about ${selectedLibrary.name}...` : "Select a library first"}
              disabled={answerMutation.isPending || !selectedLibrary}
              className="flex-1 px-4 py-3 bg-bg-tertiary border border-border rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-600 disabled:opacity-50 transition-all"
            />
            <Button
              type="submit"
              isLoading={answerMutation.isPending}
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
