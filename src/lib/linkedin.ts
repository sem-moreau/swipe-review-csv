export function normalizeLinkedinUrl(url: string): string {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return withProtocol.trim().replace(/\/+$/, '').toLowerCase();
}
