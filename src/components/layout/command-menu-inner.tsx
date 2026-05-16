"use client";

import {
  AlertCircle,
  BarChart,
  Brain,
  CreditCard,
  DollarSign,
  FileText,
  Home,
  Plus,
  Settings,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FINANCE_PATH_BY_KEY,
  type FinanceNavKey,
} from "@/components/finance/finance-nav-config";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { useCommandMenu } from "@/contexts/command-menu-context";
import {
  useFabQuickActions,
  type FabHotkeyKind,
} from "@/contexts/fab-quick-actions-context";
import { useSettingsModal } from "@/contexts/settings-modal-context";
import type { CommandSearchResult } from "@/lib/finance/command-search-queries";
import { useModKeyLabel } from "@/lib/hooks/use-mod-key-label";
import { useRouter } from "@/i18n/navigation";
import { useIsDesktop } from "@/hooks/use-is-desktop";

type NavCmd = {
  labelKey: FinanceNavKey;
  icon: LucideIcon;
  href: string;
  shortcut?: string;
};

const NAVIGATION: NavCmd[] = [
  {
    labelKey: "dashboard",
    icon: Home,
    href: FINANCE_PATH_BY_KEY.dashboard,
    shortcut: "1",
  },
  {
    labelKey: "expenses",
    icon: CreditCard,
    href: FINANCE_PATH_BY_KEY.expenses,
    shortcut: "2",
  },
  {
    labelKey: "incomes",
    icon: TrendingUp,
    href: FINANCE_PATH_BY_KEY.incomes,
    shortcut: "3",
  },
  {
    labelKey: "goals",
    icon: Target,
    href: FINANCE_PATH_BY_KEY.goals,
    shortcut: "4",
  },
  {
    labelKey: "debts",
    icon: AlertCircle,
    href: FINANCE_PATH_BY_KEY.debts,
    shortcut: "5",
  },
  {
    labelKey: "reports",
    icon: BarChart,
    href: FINANCE_PATH_BY_KEY.reports,
    shortcut: "6",
  },
  {
    labelKey: "ai",
    icon: Brain,
    href: FINANCE_PATH_BY_KEY.ai,
    shortcut: "/",
  },
  {
    labelKey: "notes",
    icon: FileText,
    href: FINANCE_PATH_BY_KEY.notes,
  },
];

const ACTION_ROWS: {
  fab?: FabHotkeyKind;
  value: string;
  icon: LucideIcon;
  labelKey:
    | "quickExpense"
    | "quickIncome"
    | "newGoal"
    | "quickNote"
    | "settings";
  hint?: string;
}[] = [
  {
    fab: "expense",
    value: "quickExpense",
    icon: Plus,
    labelKey: "quickExpense",
    hint: "N",
  },
  {
    fab: "income",
    value: "quickIncome",
    icon: DollarSign,
    labelKey: "quickIncome",
    hint: "I",
  },
  {
    fab: "goal",
    value: "newGoal",
    icon: Target,
    labelKey: "newGoal",
    hint: "G",
  },
  { fab: "note", value: "quickNote", icon: FileText, labelKey: "quickNote" },
  {
    value: "settings",
    icon: Settings,
    labelKey: "settings",
    hint: ",",
  },
];

export function CommandMenuInner() {
  const { open, setOpen } = useCommandMenu();
  const desktop = useIsDesktop();
  const router = useRouter();
  const tNav = useTranslations("Finance.nav");
  const tMenu = useTranslations("Finance.commandMenu");
  const { openFabAction } = useFabQuickActions();
  const { openSettings } = useSettingsModal();
  const mod = useModKeyLabel();

  const chord = useCallback((k: string) => `${mod}+${k}`, [mod]);

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [remote, setRemote] = useState<CommandSearchResult | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term), 300);
    return () => window.clearTimeout(id);
  }, [term]);

  useEffect(() => {
    cancelledRef.current = false;
    const q = debounced.trim();
    if (q.length < 2) {
      return;
    }

    void (async () => {
      await Promise.resolve();

      try {
        setRemoteLoading(true);
        const res = await fetch(
          `/api/finance/command-search?q=${encodeURIComponent(q)}`,
        );
        const body = (await res.json()) as { results?: CommandSearchResult };
        if (cancelledRef.current) return;
        if (!res.ok) setRemote(null);
        else setRemote(body.results ?? null);
      } catch {
        if (!cancelledRef.current) setRemote(null);
      } finally {
        if (!cancelledRef.current) setRemoteLoading(false);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [debounced]);

  const onNavigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router, setOpen],
  );

  useEffect(() => {
    if (!open) queueMicrotask(() => setTerm(""));
  }, [open]);

  useEffect(() => {
    if (!desktop) setOpen(false);
  }, [desktop, setOpen]);

  const queryOk = debounced.trim().length >= 2;
  const remoteForUi = queryOk ? remote : null;
  const effectiveLoading = queryOk && remoteLoading;

  const hasRemoteHits = useMemo(() => {
    if (!remoteForUi) return false;
    return (
      remoteForUi.expenses.length > 0 ||
      remoteForUi.goals.length > 0 ||
      remoteForUi.debts.length > 0 ||
      remoteForUi.notes.length > 0
    );
  }, [remoteForUi]);

  const remoteActive = debounced.trim().length >= 2;

  const emptyCaption = !remoteActive
    ? tMenu("typeToSearchHint")
    : effectiveLoading
      ? tMenu("searching")
      : !hasRemoteHits
        ? tMenu("noResults")
        : tMenu("typeToSearchHint");

  return (
    <CommandDialog
      open={open && desktop}
      onOpenChange={(next) => {
        if (!desktop) return;
        setOpen(next);
      }}>
      <DialogTitle className="sr-only">
        {tMenu("searchPlaceholder")}
      </DialogTitle>
      <Command>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder={tMenu("searchPlaceholder")}
        />
        <CommandList>
          <CommandEmpty>{emptyCaption}</CommandEmpty>

          <CommandGroup heading={tMenu("navigationHeading")}>
            {NAVIGATION.map((nav) => {
              const Icon = nav.icon;
              return (
                <CommandItem
                  key={`nav:${nav.href}`}
                  value={`nav ${tNav(nav.labelKey)} ${nav.href}`}
                  keywords={[tNav(nav.labelKey)]}
                  onSelect={() => onNavigate(nav.href)}>
                  <Icon aria-hidden />
                  <span>{tNav(nav.labelKey)}</span>
                  {nav.shortcut ? (
                    <CommandShortcut>{`${mod}${nav.shortcut}`}</CommandShortcut>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={tMenu("actionsHeading")}>
            {ACTION_ROWS.map((row) => {
              const Icon = row.icon;
              return (
                <CommandItem
                  key={row.value}
                  value={`action ${row.value} ${tMenu(row.labelKey)}`}
                  keywords={[tMenu(row.labelKey)]}
                  onSelect={() => {
                    setOpen(false);
                    if (row.value === "settings") openSettings();
                    else if (row.fab) openFabAction(row.fab);
                  }}>
                  <Icon aria-hidden />
                  <span>{tMenu(row.labelKey)}</span>
                  {row.hint ? (
                    <CommandShortcut>{chord(row.hint)}</CommandShortcut>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>

          {remoteActive && remoteForUi && hasRemoteHits ? (
            <Fragment>
              <CommandSeparator />

              {remoteForUi.expenses.length > 0 ? (
                <CommandGroup heading={tMenu("fromExpenses")}>
                  {remoteForUi.expenses.map((e) => (
                    <CommandItem
                      key={`ve:${e.id}`}
                      value={`hit expense ${e.label} ${e.subtitleKey} ${debounced}`}
                      keywords={[debounced]}
                      onSelect={() => onNavigate(FINANCE_PATH_BY_KEY.expenses)}>
                      <CreditCard aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{e.label}</span>
                      <CommandShortcut className="max-w-[40%] shrink-0 truncate font-normal capitalize">
                        {tMenu(`expenseKind.${e.subtitleKey}` as const)}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {remoteForUi.goals.length > 0 ? (
                <CommandGroup heading={tMenu("fromGoals")}>
                  {remoteForUi.goals.map((g) => (
                    <CommandItem
                      key={`g:${g.id}`}
                      value={`hit goal ${g.title} ${debounced}`}
                      keywords={[debounced]}
                      onSelect={() => onNavigate(FINANCE_PATH_BY_KEY.goals)}>
                      <Target aria-hidden />
                      <span>{g.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {remoteForUi.debts.length > 0 ? (
                <CommandGroup heading={tMenu("fromDebts")}>
                  {remoteForUi.debts.map((d) => (
                    <CommandItem
                      key={`d:${d.id}`}
                      value={`hit debt ${d.name} ${debounced}`}
                      keywords={[debounced]}
                      onSelect={() => onNavigate(FINANCE_PATH_BY_KEY.debts)}>
                      <AlertCircle aria-hidden />
                      <span>{d.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {remoteForUi.notes.length > 0 ? (
                <CommandGroup heading={tMenu("fromNotes")}>
                  {remoteForUi.notes.map((n) => (
                    <CommandItem
                      key={`n:${n.id}`}
                      value={`hit note ${n.title ?? ""} ${n.snippet} ${debounced}`}
                      keywords={[debounced]}
                      onSelect={() => onNavigate(`/notes/${n.id}`)}>
                      <FileText aria-hidden />
                      <span className="truncate">
                        {n.title?.trim().length ? n.title : n.snippet}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </Fragment>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
