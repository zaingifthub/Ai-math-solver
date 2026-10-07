/**
 * Search-engine indexing switch. Indexing is off on temporary hosting domains
 * (*.hostingersite.com, *.vercel.app) so previews never compete with the real site.
 * SITE_NOINDEX=true forces it off; SITE_NOINDEX=false forces it on.
 */
const TEMPORARY_HOSTS = /\.(hostingersite\.com|vercel\.app)$/i;

export function isIndexingDisabled(siteUrl = process.env.NEXT_PUBLIC_SITE_URL, flag = process.env.SITE_NOINDEX): boolean {
  if (flag === "true") return true;
  if (flag === "false") return false;
  try {
    return TEMPORARY_HOSTS.test(new URL(siteUrl ?? "").hostname);
  } catch {
    return false;
  }
}
