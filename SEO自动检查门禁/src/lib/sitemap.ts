import { fetchText } from "./http.js";

export function extractLocs(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)).map((match) => match[1].trim());
}

export function extractSitemapEntries(xml: string) {
  return Array.from(xml.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/g)).map((match) => {
    const block = match[1];
    return {
      loc: block.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1]?.trim() ?? "",
      lastmod: block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1]?.trim() ?? "",
    };
  }).filter((entry) => entry.loc);
}

export function pathFromUrl(baseUrl: string, url: string) {
  if (url.startsWith(baseUrl)) return url.slice(baseUrl.length) || "/";
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export async function fetchSitemapUrls(baseUrl: string, indexPath = "/sitemap.xml", childSitemaps?: string[]) {
  const sitemapIndexUrl = `${baseUrl}${indexPath}`;
  const index = await fetchText(sitemapIndexUrl);
  const childUrls = childSitemaps?.length
    ? childSitemaps.map((name) => (name.startsWith("http") ? name : `${baseUrl}/${name.replace(/^\/+/, "")}`))
    : extractLocs(index.body).filter((loc) => loc.includes(".xml"));

  const allUrls: string[] = [];
  const entries: Array<{ loc: string; lastmod: string; sitemap: string }> = [];
  for (const childUrl of childUrls) {
    const child = await fetchText(childUrl);
    const childEntries = extractSitemapEntries(child.body).map((entry) => ({ ...entry, sitemap: childUrl }));
    if (childEntries.length) {
      entries.push(...childEntries);
      allUrls.push(...childEntries.map((entry) => entry.loc));
    } else {
      const locs = extractLocs(child.body);
      entries.push(...locs.map((loc) => ({ loc, lastmod: "", sitemap: childUrl })));
      allUrls.push(...locs);
    }
  }

  return { sitemapIndexUrl, index, childUrls, allUrls, entries };
}
