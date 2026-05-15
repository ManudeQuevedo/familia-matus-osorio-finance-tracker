"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  ChevronDown,
  MessageSquarePlus,
  Minus,
  Send,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiChatMarkdown } from "@/components/ai/ai-chat-markdown";
import { useAiChat } from "@/components/providers/AiChatProvider";
import { Button } from "@/components/ui/button";
import { useEscape } from "@/lib/hooks/use-escape";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: string;
  title: string | null;
  updated_at: string;
  preview: string | null;
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-bg-card-nested"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

function stripConvMarker(raw: string): {
  text: string;
  convId: string | null;
} {
  const match = raw.match(/__CONV_ID__([a-f0-9-]+)__CONV_ID__/);
  if (!match) return { text: raw, convId: null };
  return {
    text: raw.replace(match[0], "").trimEnd(),
    convId: match[1] ?? null,
  };
}

export function AiChatPanel() {
  const t = useTranslations("Finance.ai");
  const locale = useLocale();
  const {
    open,
    conversationId,
    messages,
    isStreaming,
    closeChat,
    minimizeChat,
    setConversationId,
    setMessages,
    setIsStreaming,
    startNewConversation,
    pageContext,
    openChat,
  } = useAiChat();

  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamBuffer, setStreamBuffer] = useState("");

  useEscape(() => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    minimizeChat();
  }, open);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rawStreamRef = useRef("");

  const suggestions = [
    t("suggestions.spentThisMonth"),
    t("suggestions.newCar"),
    t("suggestions.accelerateDebts"),
    t("suggestions.savingsVsLastMonth"),
    t("suggestions.tripViable"),
  ];

  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ai/conversations");
      if (!res.ok) return;
      const json = (await res.json()) as { conversations: ConversationItem[] };
      setConversations(json.conversations ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      void loadConversations();
    });
  }, [open, loadConversations]);

  useEffect(() => {
    if (!open || !conversationId || messages.length > 0) return;
    void (async () => {
      const res = await fetch(
        `/api/ai/conversations?id=${encodeURIComponent(conversationId)}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        messages: { id: string; role: "user" | "assistant"; content: string }[];
      };
      setMessages(
        (json.messages ?? []).map((m, i) => ({
          id: m.id ?? `loaded-${i}`,
          role: m.role,
          content: m.content,
        })),
      );
    })();
  }, [open, conversationId, messages.length, setMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamBuffer, isStreaming]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [input]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setInput("");

      const userMsg = {
        id: `user-${Date.now()}`,
        role: "user" as const,
        content: trimmed,
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setIsStreaming(true);
      setStreamBuffer("");
      rawStreamRef.current = "";

      const history = nextMessages
        .slice(0, -1)
        .slice(-20)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId,
            conversationHistory: history,
            pageContext,
          }),
        });

        if (res.status === 429) {
          const json = (await res.json()) as { message?: string };
          notify.ai.rateLimit();
          setError(json.message ?? t("errors.rateLimit"));
          setIsStreaming(false);
          return;
        }

        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          notify.ai.error();
          setError(
            (json as { message?: string }).message ?? t("errors.connection"),
          );
          setIsStreaming(false);
          return;
        }

        const headerConvId = res.headers.get("X-Conversation-Id");
        if (headerConvId) setConversationId(headerConvId);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          rawStreamRef.current += decoder.decode(value, { stream: true });
          const { text, convId } = stripConvMarker(rawStreamRef.current);
          if (convId) setConversationId(convId);
          setStreamBuffer(text);
        }

        const { text: finalText, convId } = stripConvMarker(
          rawStreamRef.current,
        );
        if (convId) setConversationId(convId);

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: finalText,
          },
        ]);
        setStreamBuffer("");
        rawStreamRef.current = "";
        void loadConversations();
      } catch {
        notify.ai.error();
        setError(t("errors.connection"));
      } finally {
        setIsStreaming(false);
      }
    },
    [
      conversationId,
      isStreaming,
      loadConversations,
      messages,
      pageContext,
      setConversationId,
      setIsStreaming,
      setMessages,
      t,
    ],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const selectConversation = async (id: string) => {
    setConversationId(id);
    setMessages([]);
    setShowHistory(false);
    openChat({ conversationId: id });
    const res = await fetch(
      `/api/ai/conversations?id=${encodeURIComponent(id)}`,
    );
    if (!res.ok) return;
    const json = (await res.json()) as {
      messages: { id: string; role: "user" | "assistant"; content: string }[];
    };
    setMessages(
      (json.messages ?? []).map((m, i) => ({
        id: m.id ?? `loaded-${i}`,
        role: m.role,
        content: m.content,
      })),
    );
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));

  const empty = messages.length === 0 && !isStreaming;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label={t("close")}
            className="fixed inset-0 z-60 bg-black/40 md:bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={minimizeChat}
          />
          <motion.aside
            className={cn(
              "fixed inset-y-0 right-0 z-70 flex w-full flex-col border-l border-border-default bg-bg-card shadow-2xl dark:border-border-default",
              "md:w-[420px]",
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}>
            <header className="flex shrink-0 items-center gap-2 border-b border-border-default px-4 py-3 dark:border-border-default">
              <BrainCircuit
                className="h-5 w-5 shrink-0 text-accent"
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{t("title")}</h2>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex max-w-full items-center gap-1 text-xs text-text-muted hover:text-text-primary">
                  <span className="truncate">
                    {conversationId
                      ? (conversations.find((c) => c.id === conversationId)
                          ?.title ?? t("history.current"))
                      : t("history.newChat")}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      showHistory && "rotate-180",
                    )}
                  />
                </button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  startNewConversation();
                  setShowHistory(false);
                  setMessages([]);
                }}
                aria-label={t("newChat")}>
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={minimizeChat}
                aria-label={t("minimize")}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={closeChat}
                aria-label={t("close")}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <AnimatePresence>
              {showHistory ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="shrink-0 overflow-hidden border-b border-border-default">
                  <div className="max-h-48 overflow-y-auto p-2">
                    {loadingHistory ? (
                      <p className="px-2 py-2 text-xs text-text-muted">
                        {t("history.loading")}
                      </p>
                    ) : conversations.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-text-muted">
                        {t("history.empty")}
                      </p>
                    ) : (
                      conversations.slice(0, 10).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => void selectConversation(c.id)}
                          className={cn(
                            "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-bg-card-hover",
                            conversationId === c.id && "bg-accent-muted",
                          )}>
                          <p className="truncate font-medium">
                            {c.title ?? t("history.untitled")}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-text-muted">
                            {formatDate(c.updated_at)}
                            {c.preview ? ` · ${c.preview}` : ""}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div
              ref={scrollRef}
              className="touch-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
              {empty ? (
                <div className="flex flex-1 flex-col justify-end gap-3 pb-2">
                  <p className="text-center text-sm text-text-muted">
                    {t("emptyHint")}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void sendMessage(s)}
                        className="rounded-full border border-border-default bg-bg-card-nested px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent/40 hover:bg-accent-muted">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.role === "user" ? "justify-end" : "justify-start",
                      )}>
                      <div
                        className={cn(
                          "max-w-[92%] rounded-2xl px-4 py-2.5 text-sm",
                          m.role === "user"
                            ? "bg-accent-muted text-text-primary"
                            : "bg-bg-card-nested text-text-primary",
                        )}>
                        {m.role === "assistant" ? (
                          <AiChatMarkdown content={m.content} />
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isStreaming && streamBuffer ? (
                    <div className="flex justify-start">
                      <div className="max-w-[92%] rounded-2xl bg-bg-card-nested px-4 py-2.5 text-sm">
                        <AiChatMarkdown content={streamBuffer} />
                      </div>
                    </div>
                  ) : null}
                  {isStreaming && !streamBuffer ? <TypingIndicator /> : null}
                </div>
              )}
            </div>

            {error ? (
              <p className="shrink-0 px-4 pb-2 text-center text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <form
              onSubmit={onSubmit}
              className="shrink-0 border-t border-border-default p-4 dark:border-border-default">
              <div className="flex items-end gap-2 rounded-2xl border border-border-default bg-bg-card-nested/80 p-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder={t("inputPlaceholder")}
                  disabled={isStreaming}
                  className="max-h-24 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-text-muted"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  disabled={!input.trim() || isStreaming}
                  aria-label={t("send")}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
