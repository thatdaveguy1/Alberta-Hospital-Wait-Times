// App — Clinical Ledger shell: persistent header nav, home front door,
// module views (legacy dashboards render inside a dark legacy wrapper until
// they get their own redesign pass), light footer, and the Data Sources modal.
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SiteHeader, type AppView } from './components/SiteHeader';
import HomePage from './components/HomePage';
import ErWaitDashboard from './components/ErWaitDashboard';
import SurgicalDashboard from './components/SurgicalDashboard';
import ServiceDisruptionsDashboard from './components/ServiceDisruptionsDashboard';
import PrimaryCareDashboard from './components/PrimaryCareDashboard';
import DiagnosticDashboard from './components/DiagnosticDashboard';
import PublicHealthDashboard from './components/PublicHealthDashboard';
import RegionalInequityDashboard from './components/RegionalInequityDashboard';
import SpendingDashboard from './components/SpendingDashboard';
import {
  DASHBOARDS,
  TAB_METADATA_MAP,
  type DashboardId,
} from './lib/dashboardRegistry';
import { readDashboardModuleFromUrl } from './lib/dashboardModuleSearch';
import { cn } from './lib/utils';
import { prefetchCareSeekingPages } from './lib/pageDataPrefetch';

const MODULE_IDS = DASHBOARDS.map((d) => d.id);

function viewFromUrl(): AppView {
  const fromUrl = readDashboardModuleFromUrl(MODULE_IDS);
  return (fromUrl as DashboardId | null) ?? 'home';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(viewFromUrl);
  const [requestedFacilityId, setRequestedFacilityId] = useState<string | null>(null);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);

  useEffect(() => {
    const fromUrl = readDashboardModuleFromUrl(MODULE_IDS);
    if (fromUrl) setActiveView(fromUrl as DashboardId);
  }, []);

  // Warm ER + Labs while the shell is idle so those clicks feel instant.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) prefetchCareSeekingPages();
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 1800 });
    } else {
      timeoutId = setTimeout(run, 400);
    }
    return () => {
      cancelled = true;
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeView === 'home') url.searchParams.delete('module');
    else url.searchParams.set('module', activeView);
    window.history.replaceState({}, '', url.toString());
  }, [activeView]);

  const navigate = (view: AppView) => {
    if (view === 'er-waits' || view === 'diagnostics') prefetchCareSeekingPages();
    setActiveView(view);
    if (view !== 'er-waits') setRequestedFacilityId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectFacility = (facilityId: string) => {
    setRequestedFacilityId(facilityId);
    setActiveView('er-waits');
    window.scrollTo({ top: 0 });
  };

  const activeDashboard = DASHBOARDS.find((d) => d.id === activeView);
  const footerBlurb =
    activeView === 'home'
      ? 'Independent, unofficial tracking of Alberta health system data, tied to public sources and timestamps.'
      : activeView === 'er-waits'
        ? 'Data synchronized from Alberta Health Services feeds. Estimated ER wait times refresh about every 10 minutes.'
        : `Viewing ${activeDashboard?.title}. Source: ${activeDashboard?.source}. Update cadence: ${activeDashboard?.updateFrequency}.`;

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader
        activeView={activeView}
        onNavigate={navigate}
        onSelectFacility={selectFacility}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeView === 'home' ? (
              <HomePage onNavigate={navigate} />
            ) : activeView === 'er-waits' ? (
              <ErWaitDashboard
                requestedFacilityId={requestedFacilityId}
                onRequestedFacilityHandled={() => setRequestedFacilityId(null)}
              />
            ) : activeView === 'diagnostics' ? (
              <DiagnosticDashboard />
            ) : activeView === 'disruptions' ? (
              <ServiceDisruptionsDashboard />
            ) : activeView === 'surgical-waits' ? (
              <SurgicalDashboard />
            ) : activeView === 'primary-care' ? (
              <PrimaryCareDashboard />
            ) : activeView === 'public-health' ? (
              <PublicHealthDashboard />
            ) : activeView === 'regional-inequity' ? (
              <RegionalInequityDashboard />
            ) : activeView === 'health-spending' ? (
              <SpendingDashboard />
            ) : (
              <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
                Unknown dashboard: {activeView}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer id="site-footer" className="mt-12 border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold text-ink">Alberta Health Data Monitor</p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-3">{footerBlurb}</p>
            <p className="mt-2 text-xs text-ink-3">
              Unofficial tracker · Not affiliated with Alberta Health Services · In a
              life-threatening emergency call <strong className="font-semibold text-ink">911</strong>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setIsSourcesModalOpen(true)}
              className="text-ink-2 transition-colors hover:text-accent cursor-pointer"
            >
              Data Sources
            </button>
            <a
              href="https://www.albertahealthservices.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-2 transition-colors hover:text-accent"
            >
              Official AHS Web
            </a>
            <a href="#contributions" className="text-ink-2 transition-colors hover:text-accent">
              Contribute
            </a>
          </div>
        </div>
      </footer>

      {/* Data Sources modal */}
      {isSourcesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Data sources and registries">
          <button
            type="button"
            aria-label="Close data sources"
            className="absolute inset-0 bg-ink/30 cursor-default"
            onClick={() => setIsSourcesModalOpen(false)}
            tabIndex={-1}
          />
          <div className="relative flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-line p-5">
              <div>
                <h3 className="text-base font-semibold text-ink">Data Sources & Registries</h3>
                <p className="mt-0.5 text-xs text-ink-3">
                  Dataset origins and update frequencies across all consoles
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSourcesModalOpen(false)}
                aria-label="Close"
                className="rounded-lg border border-line bg-surface p-2 text-ink-2 transition-colors hover:bg-paper hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-ink-3">
                    <th className="py-2.5 pr-4 font-semibold">Console</th>
                    <th className="px-4 py-2.5 font-semibold">Update</th>
                    <th className="px-4 py-2.5 font-semibold">Frequency</th>
                    <th className="py-2.5 pl-4 font-semibold">Data Source Registry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {Object.entries(TAB_METADATA_MAP).map(([key, meta]) => {
                    const dashboard = DASHBOARDS.find((d) => d.id === key);
                    const name = dashboard ? dashboard.shortName : key;
                    const badgeClass =
                      meta.updateType === 'auto'
                        ? 'bg-ok-soft text-ok'
                        : meta.updateType === 'mixed'
                          ? 'bg-accent-soft text-accent-strong'
                          : 'bg-warn-soft text-warn';
                    const badgeLabel =
                      meta.updateType === 'auto' ? 'Auto' : meta.updateType === 'mixed' ? 'Mixed' : 'Manual';
                    return (
                      <tr key={key} className="transition-colors hover:bg-paper">
                        <td className="py-3 pr-4 font-semibold text-ink">{name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              badgeClass,
                            )}
                          >
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-ink-2">{meta.interval}</td>
                        <td className="py-3 pl-4 leading-normal text-ink-3">{meta.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-line p-4">
              <button
                type="button"
                onClick={() => setIsSourcesModalOpen(false)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
