"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocale } from "next-intl";

import { AiChatPanel } from "@/components/ai/ai-chat-panel";
import type { AiPageContext } from "@/lib/ai/financial-context";
import { buildPageContextFromPath } from "@/lib/ai/page-context";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { BrainCircuit } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AiChatContextValue = {
  open: boolean;
  minimized: boolean;
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  openChat: (opts?: {
    conversationId?: string | null;
    newChat?: boolean;
  }) => void;
  closeChat: () => void;
  minimizeChat: () => void;
  setConversationId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsStreaming: (v: boolean) => void;
  startNewConversation: () => void;
  pageContext: AiPageContext;
};

const AiChatContext = createContext<AiChatContextValue | null>(null);

export function useAiChat() {
  const ctx = useContext(AiChatContext);
  if (!ctx) {
    throw new Error("useAiChat must be used within AiChatProvider");
  }
  return ctx;
}

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const pathWithoutLocale = useMemo(() => {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname === `${prefix}/`) return "/";
    if (pathname.startsWith(`${prefix}/`)) {
      const rest = pathname.slice(prefix.length) || "/";
      return rest.startsWith("/") ? rest : `/${rest}`;
    }
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  }, [pathname, locale]);

  const pageContext = useMemo(
    () => buildPageContextFromPath(pathWithoutLocale, locale),
    [pathWithoutLocale, locale],
  );

  const openChat = useCallback(
    (opts?: { conversationId?: string | null; newChat?: boolean }) => {
      if (opts?.newChat) {
        setConversationId(null);
        setMessages([]);
      } else if (opts?.conversationId !== undefined) {
        setConversationId(opts.conversationId);
      }
      setMinimized(false);
      setOpen(true);
    },
    [],
  );

  const closeChat = useCallback(() => {
    setOpen(false);
    setMinimized(false);
  }, []);

  const minimizeChat = useCallback(() => {
    setOpen(false);
    setMinimized(true);
  }, []);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (
        e as CustomEvent<{ conversationId?: string; newChat?: boolean }>
      ).detail;
      if (detail?.newChat) {
        startNewConversation();
      } else if (detail?.conversationId) {
        setConversationId(detail.conversationId);
        setMessages([]);
      }
      setMinimized(false);
      setOpen(true);
    };
    window.addEventListener("ai-chat-open", onOpen);
    return () => window.removeEventListener("ai-chat-open", onOpen);
  }, [startNewConversation, setConversationId, setMessages]);

  const value = useMemo(
    () => ({
      open,
      minimized,
      conversationId,
      messages,
      isStreaming,
      openChat,
      closeChat,
      minimizeChat,
      setConversationId,
      setMessages,
      setIsStreaming,
      startNewConversation,
      pageContext,
    }),
    [
      open,
      minimized,
      conversationId,
      messages,
      isStreaming,
      openChat,
      closeChat,
      minimizeChat,
      startNewConversation,
      pageContext,
    ],
  );

  return (
    <AiChatContext.Provider value={value}>
      {children}
      <AiChatPanel />
      {minimized && !open ? (
        <button
          type="button"
          onClick={() => openChat()}
          className={cn(
            "fixed right-0 top-1/2 z-50 flex -translate-y-1/2 items-center gap-2 rounded-l-2xl border border-r-0 border-border-default bg-bg-card py-3 pl-3 pr-2 shadow-lg transition-colors",
            "hover:bg-bg-card-nested dark:border-border-default bg-bg-card-nested dark:hover:bg-zinc-800",
          )}
          aria-label="Abrir asesor financiero">
          <BrainCircuit className="h-5 w-5 text-accent" strokeWidth={2} />
        </button>
      ) : null}
    </AiChatContext.Provider>
  );
}

export function dispatchOpenAiChat(
  conversationId?: string,
  options?: { newChat?: boolean },
) {
  window.dispatchEvent(
    new CustomEvent("ai-chat-open", {
      detail: { conversationId, newChat: options?.newChat },
    }),
  );
}
