// Canonicalizes to https://www.linkedin.com/in/<slug> so URLs that only
// differ by domain (nl.linkedin.com, no www), query/tracking params, or
// trailing slashes still match up between what was requested and what
// Bizdex echoes back.
export function normalizeLinkedinUrl(url: string): string {
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const slugMatch = withProtocol.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (slugMatch) return `https://www.linkedin.com/in/${slugMatch[1].toLowerCase()}`;
  return withProtocol.replace(/\/+$/, '').split(/[?#]/)[0].toLowerCase();
}
