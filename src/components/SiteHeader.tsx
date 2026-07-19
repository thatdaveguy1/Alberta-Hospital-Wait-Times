// SiteHeader — persistent top navigation for the Clinical Ledger shell.
// Brand, primary destinations (Home / ER Waits), an "All modules" mega-menu on
// desktop (full-screen sheet on mobile), a live ER-feed freshness chip, and a
// ⌘K command palette that jumps to any module or any ER facility.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, MapPin, Menu, Moon, Search, Sun, X } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_TITLE_BY_ID,
  DASHBOARDS,
  type DashboardId,
} from '../lib/dashboardRegistry';
import { dashboardMatchesSearch } from '../lib/dashboardModuleSearch';
import { formatRelativeTime, useSyncStatus } from '../hooks/useSyncStatus';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import type { Hospital } from '../types';

export type AppView = 'home' | DashboardId;

interface SiteHeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onSelectFacility: (facilityId: string) => void;
}

const MENU_GROUPS = CATEGORIES.filter((c) => c.id !== 'all').map((cat) => ({
  id: cat.id,
  title: CATEGORY_TITLE_BY_ID[cat.id],
  modules: DASHBOARDS.filter((d) => d.category === cat.id),
}));

function NavLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-16 items-center px-3 text-sm transition-colors cursor-pointer',
        active ? 'font-semibold text-accent' : 'text-ink-2 hover:text-ink',
      )}
    >
      {children}
      {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden />}
    </button>
  );
}

function FreshnessChip() {
  const { syncStatus } = useSyncStatus();
  const ts = syncStatus?.erWaitTimesLastUpdate;
  if (!ts) return null;
  return (
    <span
      className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-medium text-ok whitespace-nowrap"
      title="ER wait times feed status"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      ER feed · {formatRelativeTime(ts)}
    </span>
  );
}

type PaletteItem =
  | { kind: 'module'; id: DashboardId; label: string; hint: string }
  | { kind: 'facility'; id: string; label: string; hint: string; wait?: string };

function CommandPalette({
  onClose,
  onNavigate,
  onSelectFacility,
}: {
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onSelectFacility: (facilityId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [facilities, setFacilities] = useState<Hospital[]>([]);
  const fetchedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch('/api/hospitals')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setFacilities(d as Hospital[]);
      })
      .catch(() => {});
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const modules = DASHBOARDS.filter((d) => dashboardMatchesSearch(d, query))
      .slice(0, 8)
      .map((d) => ({
        kind: 'module' as const,
        id: d.id as DashboardId,
        label: d.shortName,
        hint: CATEGORY_TITLE_BY_ID[d.category],
      }));
    const q = query.trim().toLowerCase();
    const facilityMatches = q
      ? facilities
          .filter(
            (h) =>
              h.name.toLowerCase().includes(q) ||
              (h.city ?? '').toLowerCase().includes(q),
          )
          .slice(0, 6)
          .map((h) => ({
            kind: 'facility' as const,
            id: h.id,
            label: h.name,
            hint: h.city || h.region || 'Alberta',
            wait: h.waitTimeLabel,
          }))
      : [];
    return [...modules, ...facilityMatches];
  }, [query, facilities]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const choose = (item: PaletteItem) => {
    if (item.kind === 'module') onNavigate(item.id);
    else onSelectFacility(item.id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[index];
      if (item) choose(item);
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-ink/30 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div className="relative mx-auto mt-[12vh] w-[min(92vw,36rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-md">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search modules or ER facilities…"
            className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <kbd className="hidden sm:block rounded border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
            esc
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-3">No matches found.</p>
          )}
          {items.map((item, i) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              data-active={i === index}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(item)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer',
                i === index ? 'bg-accent-soft' : 'hover:bg-paper',
              )}
            >
              <span className="rounded-md border border-line bg-surface p-1.5 text-ink-3" aria-hidden>
                {item.kind === 'module' ? (
                  <Activity className="h-3.5 w-3.5" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{item.label}</span>
                <span className="block truncate text-xs text-ink-3">{item.hint}</span>
              </span>
              {item.kind === 'facility' && item.wait && (
                <span className="shrink-0 font-mono text-xs tabular-nums text-ink-2">{item.wait}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({ activeView, onNavigate, onSelectFacility }: SiteHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetQuery, setSheetQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const locked = sheetOpen || paletteOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen, paletteOpen]);

  const go = (view: AppView) => {
    setMenuOpen(false);
    setSheetOpen(false);
    onNavigate(view);
  };

  const sheetGroups = useMemo(
    () =>
      MENU_GROUPS.map((g) => ({
        ...g,
        modules: g.modules.filter((d) => dashboardMatchesSearch(d, sheetQuery)),
      })).filter((g) => g.modules.length > 0),
    [sheetQuery],
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => go('home')}
            className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 text-left cursor-pointer"
            aria-label="Alberta Health Data Monitor — home"
          >
            <span className="rounded-lg border border-line bg-surface p-1.5" aria-hidden>
              <Activity className="h-4 w-4 text-accent" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">
                Alberta Health Data Monitor
              </span>
              <span className="hidden text-xs text-ink-3 sm:block">Unofficial AHS data tracker</span>
            </span>
          </button>
          <nav className="hidden h-16 items-stretch md:flex" aria-label="Primary">
            <NavLink active={activeView === 'home'} onClick={() => go('home')}>
              Home
            </NavLink>
            <NavLink active={activeView === 'er-waits'} onClick={() => go('er-waits')}>
              ER Waits
            </NavLink>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className={cn(
                'relative flex h-16 items-center gap-1 px-3 text-sm transition-colors cursor-pointer',
                menuOpen ? 'font-semibold text-accent' : 'text-ink-2 hover:text-ink',
              )}
            >
              All modules
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', menuOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <FreshnessChip />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="rounded-lg border border-line bg-surface p-2 text-ink-2 transition-colors hover:bg-paper hover:text-ink cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search modules and facilities (Ctrl+K)"
            className="rounded-lg border border-line bg-surface p-2 text-ink-2 transition-colors hover:bg-paper hover:text-ink cursor-pointer"
          >
            <Search className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-line bg-surface p-2 text-ink-2 transition-colors hover:bg-paper hover:text-ink md:hidden cursor-pointer"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Desktop mega-menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 top-16 z-30 hidden md:block"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-full z-40 hidden border-b border-line bg-surface shadow-md md:block">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-8 gap-y-6 px-4 py-6 sm:px-6 lg:grid-cols-5 lg:px-8">
              {MENU_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="text-xs font-semibold text-ink-3">{group.title}</p>
                  <ul className="mt-2 space-y-0.5">
                    {group.modules.map((m) => {
                      const Icon = m.icon;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => go(m.id as DashboardId)}
                            className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-paper cursor-pointer"
                          >
                            <Icon
                              className="mt-0.5 h-4 w-4 shrink-0 text-ink-3 group-hover:text-accent"
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-ink">{m.shortName}</span>
                              <span className="block truncate text-xs text-ink-3">{m.description}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Mobile full-screen sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
            <span className="text-sm font-semibold text-ink">All modules</span>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close menu"
              className="rounded-lg border border-line bg-surface p-2 text-ink-2 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3">
              <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <input
                type="text"
                value={sheetQuery}
                onChange={(e) => setSheetQuery(e.target.value)}
                placeholder="Search modules…"
                className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Modules">
            <button
              type="button"
              onClick={() => go('home')}
              className="mb-2 flex w-full items-center rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-ink cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => go('er-waits')}
              className="mb-4 flex w-full items-center rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-accent cursor-pointer"
            >
              ER Waits
            </button>
            {sheetGroups.map((group) => (
              <div key={group.id} className="mb-5">
                <p className="px-2 text-xs font-semibold text-ink-3">{group.title}</p>
                <ul className="mt-1 space-y-0.5">
                  {group.modules.map((m) => {
                    const Icon = m.icon;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => go(m.id as DashboardId)}
                          className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left cursor-pointer"
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink">{m.shortName}</span>
                            <span className="block text-xs text-ink-3">{m.description}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {sheetGroups.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-ink-3">No modules match your search.</p>
            )}
          </nav>
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={go}
          onSelectFacility={(id) => {
            setPaletteOpen(false);
            onSelectFacility(id);
          }}
        />
      )}
    </header>
  );
}
