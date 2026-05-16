"use client";

import {
  BrainCircuit,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AiChatMarkdown } from "@/components/ai/ai-chat-markdown";
import { FinanceContentHeaderActions } from "@/components/finance/FinanceContentHeaderActions";
import { FinanceHeaderSearchTrigger } from "@/components/finance/finance-header-search-trigger";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import {
  dispatchOpenAiChat,
  useAiChat,
} from "@/components/providers/AiChatProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: string;
  title: string | null;
  updated_at: string;
  created_at: string;
  preview: string | null;
  message_count: number;
};

type PreviewMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown> | null;
};

type DateGroup = "today" | "yesterday" | "thisWeek" | "thisMonth" | "older";

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function conversationDateGroup(
  updatedIso: string,
  now = new Date(),
): DateGroup {
  const d = new Date(updatedIso);
  const sodToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sodD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const msPerDay = 86400000;
  const dayDiff = Math.round((sodToday.getTime() - sodD.getTime()) / msPerDay);

  if (dayDiff === 0) return "today";
  if (dayDiff === 1) return "yesterday";

  const sow = startOfWeekMonday(sodToday);
  if (sodD >= sow && dayDiff > 1) return "thisWeek";

  const som = new Date(now.getFullYear(), now.getMonth(), 1);
  if (sodD >= som) return "thisMonth";

  return "older";
}

function formatRelativeShort(iso: string, locale: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  const loc = locale.startsWith("es") ? "es" : "en";
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });

  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const min = Math.floor(diffSec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.floor(min / 60);
  if (hr < 24) return rtf.format(-hr, "hour");
  const day = Math.floor(hr / 24);
  if (day < 7) return rtf.format(-day, "day");
  const week = Math.floor(day / 7);
  if (week < 5) return rtf.format(-week, "week");
  const month = Math.floor(day / 30);
  if (month < 12) return rtf.format(-month, "month");
  const year = Math.floor(day / 365);
  return rtf.format(-year, "year");
}

function AiMessageAttachments({
  meta,
}: {
  meta?: Record<string, unknown> | null;
}) {
  if (!meta || typeof meta !== "object") return null;
  const raw = meta.attachments;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 border-t border-border-default/50 pt-2">
      {raw.map((item, i) => {
        const att = item as { url?: string; name?: string };
        if (!att.url && !att.name) return null;
        return (
          <li key={i}>
            {att.url ? (
              <a
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent underline underline-offset-2">
                {att.name ?? att.url}
              </a>
            ) : (
              <span className="text-xs text-text-muted">{att.name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-3 px-1 py-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse space-y-2 rounded-lg border border-border-default/60 bg-bg-card/40 px-3 py-3">
          <div className="h-3.5 w-3/5 rounded bg-bg-card-nested" />
          <div className="h-3 w-full rounded bg-bg-card-nested/80" />
        </div>
      ))}
    </div>
  );
}

export function AiHistoryPageClient() {
  const t = useTranslations("Finance.ai");
  const th = useTranslations("Finance.ai.history");
  const tc = useTranslations("Finance.common");
  const locale = useLocale();

  const { conversationId: activeConversationId, startNewConversation } =
    useAiChat();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameSkipBlurRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = debounced
        ? `/api/ai/conversations?q=${encodeURIComponent(debounced)}`
        : "/api/ai/conversations";
      const res = await fetch(url);
      if (!res.ok) {
        notify.generic.loadRetry();
        return;
      }
      const json = (await res.json()) as {
        conversations: ConversationItem[];
      };
      setItems(json.conversations ?? []);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setPreviewMessages([]);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/ai/conversations?id=${encodeURIComponent(selectedId)}`,
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { messages: PreviewMessage[] };
        if (!cancelled) {
          setPreviewMessages(json.messages ?? []);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const formatAbsolute = (iso: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  const grouped = (() => {
    const order: DateGroup[] = [
      "today",
      "yesterday",
      "thisWeek",
      "thisMonth",
      "older",
    ];
    const map = new Map<DateGroup, ConversationItem[]>();
    for (const g of order) map.set(g, []);
    for (const c of items) {
      const g = conversationDateGroup(c.updated_at);
      map.get(g)!.push(c);
    }
    return order
      .filter((g) => (map.get(g)?.length ?? 0) > 0)
      .map((g) => ({
        key: g,
        label:
          g === "today"
            ? th("groupToday")
            : g === "yesterday"
              ? th("groupYesterday")
              : g === "thisWeek"
                ? th("groupThisWeek")
                : g === "thisMonth"
                  ? th("groupThisMonth")
                  : th("groupOlder"),
        items: map.get(g)!,
      }));
  })();

  const selectedConversation = selectedId
    ? items.find((c) => c.id === selectedId)
    : undefined;

  const openFloatingChat = (id: string) => {
    dispatchOpenAiChat(id);
  };

  const openNewInPanel = () => {
    dispatchOpenAiChat(undefined, { newChat: true });
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 768px)").matches
    ) {
      dispatchOpenAiChat(id);
    }
  };

  const startRename = (conv: ConversationItem) => {
    renameSkipBlurRef.current = false;
    setRenamingId(conv.id);
    setRenameValue(conv.title ?? "");
  };

  const handleRenameSave = async (id: string, raw: string) => {
    const trimmed = raw.trim();
    setRenamingId(null);
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: trimmed }),
      });
      if (!res.ok) {
        notify.ai.error();
        return;
      }
      setItems((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, title: trimmed.length > 0 ? trimmed : null }
            : c,
        ),
      );
      notify.generic.saved();
    } catch {
      notify.ai.error();
    }
  };

  const confirmDeleteOne = (id: string) => {
    toast.warning(th("deleteConversationWarn"), {
      description: th("deleteConversationDesc"),
      duration: 6000,
      action: {
        label: tc("delete"),
        onClick: () => {
          void (async () => {
            const res = await fetch(
              `/api/ai/conversations?id=${encodeURIComponent(id)}`,
              { method: "DELETE" },
            );
            if (!res.ok) {
              notify.ai.error();
              return;
            }
            if (activeConversationId === id) {
              startNewConversation();
            }
            if (selectedId === id) {
              setSelectedId(null);
              setPreviewMessages([]);
            }
            setItems((prev) => prev.filter((c) => c.id !== id));
            notify.generic.saved();
          })();
        },
      },
      cancel: {
        label: tc("cancel"),
        onClick: () => {},
      },
    });
  };

  const confirmClearAll = () => {
    toast.warning(th("clearHistoryWarn"), {
      description: th("clearHistoryDesc"),
      duration: 8000,
      action: {
        label: th("clearAllAction"),
        onClick: () => {
          void (async () => {
            const res = await fetch("/api/ai/conversations?all=1", {
              method: "DELETE",
            });
            if (!res.ok) {
              notify.ai.error();
              return;
            }
            startNewConversation();
            setSelectedId(null);
            setPreviewMessages([]);
            setItems([]);
            notify.ai.historyCleared();
          })();
        },
      },
      cancel: {
        label: tc("cancel"),
        onClick: () => {},
      },
    });
  };

  return (
    <FinancePageShell className="flex min-h-[min(880px,calc(100dvh-5rem))] flex-col p-3! md:p-6!">
      <header className="mb-4 flex shrink-0 items-center justify-between gap-3 md:mb-4">
        <div className="flex min-w-0 items-center gap-3 pr-14 md:pr-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-muted">
            <BrainCircuit className="h-6 w-6 text-accent" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("pageTitle")}
            </h1>
            <p className="mt-1 text-sm text-text-secondary dark:text-text-muted">
              {t("pageSubtitle")}
            </p>
          </div>
        </div>
        <FinanceHeaderSearchTrigger variant="inline" />
        <FinanceContentHeaderActions />
      </header>

      <Button
        type="button"
        size="icon"
        className="fixed right-4 top-19 z-40 h-11 w-11 rounded-full shadow-lg md:hidden"
        onClick={() => {
          startNewConversation();
          openNewInPanel();
        }}
        aria-label={th("newConversationWide")}>
        <MessageSquarePlus className="h-5 w-5" />
      </Button>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-default bg-bg-card dark:border-border-default",
          "md:flex-row",
        )}>
        {/* Historial */}
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col border-border-default md:w-[320px] md:border-r dark:border-border-default",
            "max-md:min-h-0 max-md:flex-1",
          )}>
          <div className="border-b border-border-default px-4 py-4 dark:border-border-default">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                {th("conversationsTitle")}
              </h2>
              <button
                type="button"
                onClick={confirmClearAll}
                disabled={loading || items.length === 0}
                className="text-[11px] text-text-muted transition-colors hover:text-red-500 disabled:pointer-events-none disabled:opacity-40">
                {th("clearHistory")}
              </button>
            </div>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => {
                startNewConversation();
                openNewInPanel();
              }}>
              <MessageSquarePlus className="mr-2 h-4 w-4 shrink-0" />
              {th("newConversationWide")}
            </Button>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={th("searchConversations")}
                className="pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 touch-scroll">
            {loading ? (
              <ConversationListSkeleton />
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <MessageSquare
                  className="mb-4 h-12 w-12 text-text-muted"
                  strokeWidth={1.25}
                />
                <p className="text-sm font-medium">
                  {debounced ? th("noSearchResults") : th("emptyStateTitle")}
                </p>
                <p className="mt-1 max-w-xs text-xs text-text-muted">
                  {debounced
                    ? th("noSearchResultsFor", { query: debounced })
                    : th("emptyStateSubtitle")}
                </p>
                {!debounced ? (
                  <Button className="mt-6" onClick={openNewInPanel}>
                    {th("emptyStateCta")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-5 pb-4">
                {grouped.map((section) => (
                  <div key={section.key}>
                    <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {section.label}
                    </p>
                    <ul className="space-y-1">
                      {section.items.map((c) => {
                        const active = selectedId === c.id;
                        return (
                          <li key={c.id}>
                            <div
                              className={cn(
                                "group relative flex rounded-lg transition-colors",
                                active &&
                                  "border-l-2 border-accent bg-accent/10 pl-[6px]",
                                !active &&
                                  "border-l-2 border-transparent pl-[6px]",
                              )}>
                              <button
                                type="button"
                                onClick={() => handleSelectConversation(c.id)}
                                className={cn(
                                  "min-w-0 flex-1 rounded-md px-2 py-2.5 text-left transition-colors",
                                  "hover:bg-bg-card-hover",
                                  active && "rounded-l-none",
                                )}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    {renamingId === c.id ? (
                                      <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) =>
                                          setRenameValue(e.target.value)
                                        }
                                        onFocus={(e) => e.target.select()}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            renameSkipBlurRef.current = true;
                                            void handleRenameSave(
                                              c.id,
                                              renameValue,
                                            );
                                          }
                                          if (e.key === "Escape") {
                                            renameSkipBlurRef.current = true;
                                            setRenamingId(null);
                                          }
                                        }}
                                        onBlur={() => {
                                          if (renameSkipBlurRef.current) {
                                            renameSkipBlurRef.current = false;
                                            return;
                                          }
                                          void handleRenameSave(
                                            c.id,
                                            renameValue,
                                          );
                                        }}
                                        className="w-full border-b border-accent bg-transparent text-sm font-medium outline-none"
                                      />
                                    ) : (
                                      <p className="truncate text-sm font-medium leading-tight">
                                        {c.title ?? th("untitled")}
                                      </p>
                                    )}
                                    {c.preview ? (
                                      <p className="mt-1 truncate text-xs text-text-muted">
                                        {c.preview}
                                      </p>
                                    ) : (
                                      <p className="mt-1 truncate text-xs text-text-muted opacity-60">
                                        —
                                      </p>
                                    )}
                                    <p className="mt-1 text-[11px] text-text-muted">
                                      {formatRelativeShort(
                                        c.updated_at,
                                        locale,
                                      )}{" "}
                                      ·{" "}
                                      {th("messagesCount", {
                                        count: c.message_count,
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </button>

                              <div className="flex shrink-0 items-start pt-2 pr-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={th("conversationMenu")}
                                      className={cn(
                                        "rounded-md p-1 text-text-muted transition-opacity hover:bg-bg-card-hover hover:text-text-primary",
                                        "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                                      )}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.preventDefault()}>
                                      <MoreHorizontal className="h-[15px] w-[15px]" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-52">
                                    <DropdownMenuItem
                                      onSelect={() => openFloatingChat(c.id)}>
                                      <MessageSquare className="mr-2 h-3.5 w-3.5" />
                                      {th("openInChat")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => startRename(c)}>
                                      <Pencil className="mr-2 h-3.5 w-3.5" />
                                      {th("rename")}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-500 focus:text-red-500"
                                      onSelect={() => confirmDeleteOne(c.id)}>
                                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                                      {th("deleteConversation")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Preview desktop */}
        <section className="hidden min-h-0 min-w-0 flex-1 flex-col md:flex">
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
              <BrainCircuit
                className="mb-6 h-12 w-12 text-text-muted"
                strokeWidth={1.25}
              />
              <p className="text-base font-medium">{th("emptyPreviewTitle")}</p>
              <p className="mt-2 max-w-sm text-sm text-text-muted">
                {th("emptyPreviewSubtitle")}
              </p>
              <Button className="mt-8" onClick={openNewInPanel}>
                {th("emptyPreviewCta")}
              </Button>
            </div>
          ) : previewLoading ? (
            <div className="flex flex-1 flex-col gap-4 p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-6 w-2/5 rounded bg-bg-card-nested" />
                <div className="h-10 w-full rounded bg-bg-card-nested/80" />
              </div>
              <div className="animate-pulse flex-1 space-y-4 rounded-xl bg-bg-card-nested/40 p-4">
                <div className="ml-auto h-12 w-[70%] rounded-2xl bg-bg-card-nested" />
                <div className="h-16 w-[85%] rounded-2xl bg-bg-card-nested/90" />
              </div>
            </div>
          ) : (
            <>
              <header className="shrink-0 border-b border-border-default px-6 py-4 dark:border-border-default">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">
                      {selectedConversation?.title ?? th("untitled")}
                    </h3>
                    <p className="mt-1 text-xs text-text-muted">
                      {selectedConversation
                        ? formatAbsolute(selectedConversation.updated_at)
                        : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => selectedId && openFloatingChat(selectedId)}>
                    {th("previewOpenChat")}
                  </Button>
                </div>
              </header>

              <div className="touch-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-4">
                  {previewMessages.map((m) => (
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
                        <AiMessageAttachments meta={m.metadata} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-border-default bg-bg-card/95 p-4 backdrop-blur dark:border-border-default">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => selectedId && openFloatingChat(selectedId)}>
                  {th("previewContinue")}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </FinancePageShell>
  );
}
