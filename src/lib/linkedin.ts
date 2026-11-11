// Sales Navigator lead URLs look like
//   https://www.linkedin.com/sales/lead/ACwAAA...,NAME_SEARCH,xyz
// The ACwAAA... part is a profile id that LinkedIn also accepts under /in/,
// where it redirects to the person's real vanity URL. The id is
// case-sensitive, so it must never be lowercased.
const SALES_LEAD_RE = /linkedin\.com\/sales\/(?:lead|people)\/([A-Za-z0-9_-]{10,})/i;

export function salesNavProfileId(url: string): string | undefined {
  return url.match(SALES_LEAD_RE)?.[1];
}

// Turns a Sales Navigator lead URL into a regular profile URL that opens for
// anyone logged in to LinkedIn (no Sales Navigator seat needed). Other URLs
// are returned unchanged.
export function toProfileUrl(url: string): string {
  const id = salesNavProfileId(url);
  return id ? `https://www.linkedin.com/in/${id}` : url;
}

// True when the URL has a real vanity slug the enrichment API can look up.
// Sales Navigator ids (also as /in/ACwAAA...) are not resolvable by it.
export function isEnrichableLinkedinUrl(url: string): boolean {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return !!m && !/^AC[a-z]AA/i.test(m[1]);
}

// Canonicalizes to https://www.linkedin.com/in/<slug> so URLs that only
// differ by domain (nl.linkedin.com, no www), query/tracking params, or
// trailing slashes still match up between what was requested and what
// Bizdex echoes back.
export function normalizeLinkedinUrl(url: string): string {
  const trimmed = url.trim();
  const salesId = salesNavProfileId(trimmed);
  if (salesId) return `https://www.linkedin.com/in/${salesId}`;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const slugMatch = withProtocol.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (slugMatch) {
    const slug = slugMatch[1];
    return `https://www.linkedin.com/in/${/^AC[a-z]AA/i.test(slug) ? slug : slug.toLowerCase()}`;
  }
  return withProtocol.replace(/\/+$/, '').split(/[?#]/)[0].toLowerCase();
}
