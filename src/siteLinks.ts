/** Public URLs for share / contribute CTAs (no secrets). */
export const SITE_PUBLIC_URL = 'https://alberta-hospital-wait-times.pages.dev';

export const GITHUB_REPO_URL =
  'https://github.com/thatdaveguy1/Alberta-Hospital-Wait-Times';

export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;

export const SHARE_TITLE = 'Unofficial Alberta Hospital Wait Times Dashboard';

export function redditSubmitUrl(pageUrl: string = SITE_PUBLIC_URL): string {
  const params = new URLSearchParams({
    url: pageUrl,
    title: SHARE_TITLE,
  });
  return `https://www.reddit.com/submit?${params.toString()}`;
}