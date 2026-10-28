import { JSDOM } from "jsdom";
import { fetchHeadNoFollow } from "./http.js";
import { Reporter } from "./reporter.js";
import type { SeoGateConfig } from "./types.js";

function relTokens(anchor: Element) {
  return (anchor.getAttribute("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

function isExternalHref(base: string, href: string) {
  try {
    const target = new URL(href, base);
    return target.origin !== new URL(base).origin && /^https?:$/.test(target.protocol);
  } catch {
    return false;
  }
}

function normalizeHref(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function matchesAny(input: string, patterns: string[] = []) {
  return patterns.some((pattern) => new RegExp(pattern).test(input));
}

export async function checkLinksForPage(
  reporter: Reporter,
  config: SeoGateConfig,
  pageUrl: string,
  html: string,
  opts: { checkExternalStatus?: boolean } = {}
) {
  const doc = new JSDOM(html).window.document;
  const links = config.links ?? {};
  const externalAnchors = Array.from(doc.querySelectorAll("a[href]")).filter((anchor) =>
    isExternalHref(pageUrl, anchor.getAttribute("href")?.trim() ?? "")
  );

  for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    reporter.expect(!!href, `${pageUrl}: empty href`);
    reporter.expect(!/^javascript:/i.test(href), `${pageUrl}: javascript href (${href})`);
    reporter.expect(!!normalizeHref(pageUrl, href), `${pageUrl}: malformed href (${href})`);
  }

  for (const anchor of externalAnchors) {
    const href = normalizeHref(pageUrl, anchor.getAttribute("href") ?? "");
    const rel = relTokens(anchor);
    const target = anchor.getAttribute("target") ?? "";
    const host = new URL(href).host;
    const allowedHost = (links.allowedExternalHosts ?? []).includes(host);
    if (target === "_blank" && (links.requireNoopenerForBlank ?? true)) {
      reporter.expect(rel.includes("noopener"), `${pageUrl}: external target=_blank missing rel=noopener (${href})`);
    }
    if (!allowedHost && matchesAny(href, links.sponsoredPatterns)) {
      reporter.expect(rel.includes("sponsored"), `${pageUrl}: sponsored external link missing rel=sponsored (${href})`);
    }
    if (opts.checkExternalStatus) {
      const head = await fetchHeadNoFollow(href);
      reporter.expect(head.status < 400 || head.status === 405, `${pageUrl}: external link returned ${head.status} (${href})`);
    }
  }

  for (const selector of links.ugcSelectors ?? []) {
    for (const anchor of Array.from(doc.querySelectorAll(`${selector} a[href]`))) {
      const href = normalizeHref(pageUrl, anchor.getAttribute("href") ?? "");
      if (!href || !isExternalHref(pageUrl, href)) continue;
      const rel = relTokens(anchor);
      reporter.expect(
        rel.includes("ugc") || rel.includes("nofollow"),
        `${pageUrl}: UGC external link missing rel=ugc or nofollow (${href})`
      );
    }
  }
}
