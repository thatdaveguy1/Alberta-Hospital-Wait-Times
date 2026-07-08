import React, { useCallback, useState } from 'react';
import {
  Star,
  Github,
  Share2,
  MessageSquare,
  ExternalLink,
  HeartHandshake,
  AlertTriangle,
  Shield,
  Copy,
  Check,
} from 'lucide-react';
import {
  GITHUB_ISSUES_URL,
  GITHUB_REPO_URL,
  SITE_PUBLIC_URL,
  redditSubmitUrl,
} from '../siteLinks';

const CONTRIBUTION_CARDS = [
  {
    title: 'Star on GitHub',
    body: 'Stars help others discover the project and signal that open health data tools matter.',
    cta: 'Open repository',
    href: GITHUB_REPO_URL,
    icon: Star,
    accent: 'text-amber-400',
    ring: 'hover:border-amber-500/30',
  },
  {
    title: 'Share the dashboard',
    body: 'Send the link to friends, community groups, or local advocates who track ER and system waits.',
    cta: 'Copy link',
    action: 'copy' as const,
    icon: Share2,
    accent: 'text-sky-400',
    ring: 'hover:border-sky-500/30',
  },
  {
    title: 'Report a data issue',
    body: 'Wrong wait time, broken chart, or stale module? Open a GitHub issue with the tab name and what you expected.',
    cta: 'File an issue',
    href: GITHUB_ISSUES_URL,
    icon: MessageSquare,
    accent: 'text-emerald-400',
    ring: 'hover:border-emerald-500/30',
  },
] as const;

export function ContributionsSection(): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const copySiteLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SITE_PUBLIC_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link:', SITE_PUBLIC_URL);
    }
  }, []);

  return (
    <section
      id="contributions"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 scroll-mt-24"
      aria-labelledby="contributions-heading"
    >
      <div className="rounded-3xl border border-slate-800 bg-[#090e21]/80 overflow-hidden shadow-xl">
        <div className="p-6 sm:p-8 border-b border-slate-800/80 bg-gradient-to-br from-slate-900/50 to-transparent">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/90 mb-2">
                Community
              </p>
              <h2
                id="contributions-heading"
                className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2"
              >
                <HeartHandshake className="w-6 h-6 text-blue-400 shrink-0" />
                Help keep this dashboard alive
              </h2>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                This is an independent, volunteer-maintained project. It is not affiliated with Alberta
                Health Services. Your star, share, or bug report keeps the data honest and the site
                reachable for Albertans checking waits and system pressure.
              </p>
            </div>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition-colors shrink-0">
              <Github className="w-4 h-4" />
              View source
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Ways you can contribute
            </p>
            {CONTRIBUTION_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-950/60 transition-colors ${card.ring}`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                      <Icon className={`w-4 h-4 ${card.accent}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white">{card.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.body}</p>
                    </div>
                  </div>
                  {'href' in card && card.href ? (
                    <a
                      href={card.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                    >
                      {card.cta}
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={copySiteLink}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          {card.cta}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Spread the word
            </p>
            <a
              href={redditSubmitUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-colors group"
            >
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <MessageSquare className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white group-hover:text-orange-100">
                  Share on Reddit
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pre-filled post with the public dashboard link
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-orange-300 shrink-0" />
            </a>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/40 space-y-3 flex-1">
              <div className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-300">Not medical advice.</strong> For emergencies call{' '}
                  <span className="text-white font-mono">911</span>. For health navigation call Health
                  Link <span className="text-white font-mono">811</span>.
                </p>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
                <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  We do not sell personal data. Location you enter stays in your browser for proximity
                  features. See project README on GitHub for how data is fetched and stored.
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 text-center lg:text-left">
              <a href="#site-footer" className="hover:text-slate-400 underline underline-offset-2">
                Privacy &amp; disclaimers
              </a>{' '}
              · Independent tracker · Not endorsed by AHS
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}