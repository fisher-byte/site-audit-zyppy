import { JSDOM } from "jsdom";
import type { PageMeta, RequiredPage, SeoGateConfig } from "./types.js";
import { publicUrl } from "./config.js";
import { Reporter } from "./reporter.js";

export function parseHtml(html: string) {
  return new JSDOM(html).window.document;
}

export function extractMeta(html: string): PageMeta {
  const doc = parseHtml(html);
  const internalLinks = Array.from(doc.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href")?.trim() ?? "")
    .filter((href) => href.startsWith("/"));
  const jsonLdBlocks = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map(
    (node) => node.textContent?.trim() ?? ""
  );
  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute("content")?.trim() ?? "";

  return {
    title: doc.querySelector("title")?.textContent?.trim() ?? "",
    description: doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "",
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? "",
    h1: doc.querySelector("h1")?.textContent?.trim() ?? "",
    lang: doc.documentElement.getAttribute("lang") ?? "",
    hreflangCount: doc.querySelectorAll('link[rel="alternate"][hreflang]').length,
    hasXDefault: !!doc.querySelector('link[rel="alternate"][hreflang="x-default"]'),
    ogTitle: doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ?? "",
    ogDescription: doc.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() ?? "",
    ogImage: doc.querySelector('meta[property="og:image"]')?.getAttribute("content")?.trim() ?? "",
    ogUrl: doc.querySelector('meta[property="og:url"]')?.getAttribute("content")?.trim() ?? "",
    twitterCard: doc.querySelector('meta[name="twitter:card"]')?.getAttribute("content")?.trim() ?? "",
    twitterImage: doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content")?.trim() ?? "",
    viewport: !!doc.querySelector('meta[name="viewport"]'),
    jsonLdBlocks,
    robots,
    noindex: /noindex/i.test(robots),
    internalLinks,
    imagesWithoutAlt: Array.from(doc.querySelectorAll("img")).filter((img) => !(img.getAttribute("alt") ?? "").trim())
      .length,
    hasBreadcrumb: !!doc.querySelector('nav[aria-label="Breadcrumb"], nav.breadcrumb-nav'),
  };
}

export function expectedCanonical(config: SeoGateConfig, pagePath: string) {
  return publicUrl(config, pagePath);
}

function canonicalVariants(url: string) {
  const normalized = url.replace(/\/+$/, "");
  return new Set([normalized, `${normalized}/`]);
}

function matchesAny(input: string, patterns: string[] = []) {
  return patterns.some((pattern) => new RegExp(pattern).test(input));
}

export function checkPageMeta(reporter: Reporter, config: SeoGateConfig, page: RequiredPage, html: string) {
  const rules = config.pageRules ?? {};
  const meta = extractMeta(html);
  const label = page.label ?? page.path;

  reporter.expect(meta.title.length >= (rules.titleMinLength ?? 10), `${label}: title is missing or too short`);
  reporter.expect(
    meta.description.length >= (rules.descriptionMinLength ?? 40),
    `${label}: meta description is missing or too short`
  );
  if (rules.requireH1 ?? true) reporter.expect(!!meta.h1, `${label}: missing H1`);
  if (rules.requireCanonical ?? true) reporter.expect(!!meta.canonical, `${label}: missing canonical`);
  if ((rules.requireSelfCanonical ?? true) && meta.canonical) {
    const expected = expectedCanonical(config, page.path);
    reporter.expect(
      canonicalVariants(expected).has(meta.canonical),
      `${label}: canonical mismatch (${meta.canonical})`
    );
  }
  reporter.expect(
    meta.hreflangCount >= (rules.requiredHreflangCount ?? 0),
    `${label}: not enough hreflang links (${meta.hreflangCount})`
  );
  if (rules.requireXDefaultHreflang) reporter.expect(meta.hasXDefault, `${label}: missing x-default hreflang`);
  if (rules.requireOpenGraph) {
    reporter.expect(!!meta.ogTitle, `${label}: missing og:title`);
    reporter.expect(!!meta.ogDescription, `${label}: missing og:description`);
    reporter.expect(!!meta.ogImage, `${label}: missing og:image`);
    reporter.expect(!!meta.ogUrl, `${label}: missing og:url`);
  }
  if (rules.requireTwitterCard) {
    reporter.expect(
      meta.twitterCard === rules.requireTwitterCard,
      `${label}: twitter:card should be ${rules.requireTwitterCard}`
    );
  }
  if (rules.requireJsonLd) reporter.expect(meta.jsonLdBlocks.length > 0, `${label}: missing JSON-LD`);
  if (rules.requireImageAlt) reporter.expect(meta.imagesWithoutAlt === 0, `${label}: images missing alt`);
  if (typeof rules.minInternalLinks === "number") {
    reporter.expect(
      meta.internalLinks.length >= rules.minInternalLinks,
      `${label}: fewer than ${rules.minInternalLinks} internal links (${meta.internalLinks.length})`
    );
  }
  for (const href of meta.internalLinks) {
    reporter.expect(
      !matchesAny(href, rules.malformedInternalLinkPatterns),
      `${label}: malformed internal link (${href})`
    );
    reporter.expect(
      !(rules.forbiddenInternalHrefs ?? []).includes(href),
      `${label}: forbidden legacy internal link (${href})`
    );
  }
  if (page.requireBreadcrumb) reporter.expect(meta.hasBreadcrumb, `${label}: missing visible breadcrumb`);
  if (page.backToListPath) {
    reporter.expect(meta.internalLinks.includes(page.backToListPath), `${label}: missing back-to-list link`);
  }

  const schemaTypes = [
    ...(page.expectedSchemaTypes ?? []),
    ...(rules.schemaRules ?? []).filter((rule) => new RegExp(rule.pattern).test(page.path)).map((rule) => rule.type),
  ];
  for (const schemaType of schemaTypes) {
    reporter.expect(
      meta.jsonLdBlocks.some((block) => block.includes(`"@type":"${schemaType}"`) || block.includes(`"@type": "${schemaType}"`)),
      `${label}: missing ${schemaType} JSON-LD`
    );
  }
}
