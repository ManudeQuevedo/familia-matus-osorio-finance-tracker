"use client";

import { BrainCircuit, MessageSquare, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { dispatchOpenAiChat } from "@/components/providers/AiChatProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: string;
  title: string | null;
  updated_at: string;
  preview: string | null;
};

export function AiHistoryPageClient() {
  const t = useTranslations("Finance.ai");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      if (!res.ok) return;
      const json = (await res.json()) as { conversations: ConversationItem[] };
      setItems(json.conversations ?? []);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t("history.deleteConfirm"))) return;
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/ai/conversations?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (res.ok) setItems((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <FinancePageShell className="pb-24 md:pb-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-muted">
            <BrainCircuit className="h-6 w-6 text-accent" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("pageTitle")}
            </h1>
            <p className="mt-1 text-sm text-text-secondary dark:text-text-muted">
              {t("pageSubtitle")}
            </p>
          </div>
        </header>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => dispatchOpenAiChat()}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {t("newChat")}
        </Button>

        <ul className="space-y-2">
          {loading ? (
            <li className="py-8 text-center text-sm text-text-muted">
              {t("history.loading")}
            </li>
          ) : items.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border-default py-12 text-center text-sm text-text-muted dark:border-border-default">
              {debounced ? t("history.noResults") : t("history.empty")}
            </li>
          ) : (
            items.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => dispatchOpenAiChat(c.id)}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-xl border border-border-default bg-bg-card p-4 text-left transition-colors",
                    "hover:border-accent/30 hover:bg-bg-card-nested dark:border-border-default bg-bg-card hover:bg-bg-card-hover/80",
                  )}>
                  <MessageSquare
                    className="mt-0.5 h-5 w-5 shrink-0 text-text-muted group-hover:text-accent"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {c.title ?? t("history.untitled")}
                    </p>
                    {c.preview ? (
                      <p className="mt-1 line-clamp-2 text-sm text-text-secondary dark:text-text-muted">
                        {c.preview}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-text-muted">
                      {formatDate(c.updated_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100"
                    disabled={deletingId === c.id}
                    onClick={(e) => void onDelete(c.id, e)}
                    aria-label={t("history.delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </FinancePageShell>
  );
}
