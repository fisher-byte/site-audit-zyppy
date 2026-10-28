import type { CacheOptions } from "./cache.js";
import { cacheableConfigHash, makeCacheKey, readCachedResults, writeCachedResults } from "./cache.js";
import { checkAssetUrl } from "./assets.js";
import { fetchHeadNoFollow, fetchText } from "./http.js";
import { checkJsonLdRules, extractJsonLdUrls } from "./jsonld.js";
import { checkLinksForPage } from "./links.js";
import { Reporter } from "./reporter.js";
import { extractMeta } from "./seo.js";
import type { SeoGateConfig } from "./types.js";

export async function runDeepAuditForUrl(input: {
  config: SeoGateConfig;
  base: string;
  url: string;
  lastmod?: string;
  cache: CacheOptions;
  checkLinks?: boolean;
  checkExternalStatus?: boolean;
}) {
  const configHash = cacheableConfigHash(input.config);
  const head = await fetchHeadNoFollow(input.url);
  const validators = [input.lastmod ?? "", String(head.status), head.location ?? ""];
  const key = makeCacheKey({ url: input.url, checkType: "deep-audit", configHash, validators });
  const cached = input.config.sitemaps?.deepAuditCache === false ? null : readCachedResults(input.cache, key);
  if (cached) return { results: cached, cacheHit: true };

  const reporter = new Reporter();
  reporter.expect(head.status === 200, `${input.url}: deep audit expected 200, got ${head.status}`);
  if (head.status !== 200) return { results: reporter.getResults(), cacheHit: false };

  const response = await fetchText(input.url);
  const meta = extractMeta(response.body);
  const rules = input.config.pageRules ?? {};
  reporter.expect(!meta.noindex, `${input.url}: sitemap URL has noindex`);
  reporter.expect(!!meta.canonical, `${input.url}: missing canonical`);
  reporter.expect(meta.canonical === input.url, `${input.url}: canonical should self-point (${meta.canonical})`);
  reporter.expect(!/[?#]/.test(meta.canonical), `${input.url}: canonical should not contain query or hash (${meta.canonical})`);
  reporter.expect(meta.title.length >= (rules.titleMinLength ?? 10), `${input.url}: missing/short title`);
  reporter.expect(meta.description.length >= (rules.descriptionMinLength ?? 40), `${input.url}: missing/short description`);
  reporter.expect(!!meta.h1, `${input.url}: missing H1`);
  if (rules.requireViewport ?? true) reporter.expect(meta.viewport, `${input.url}: missing viewport`);
  if (rules.requireHtmlLang ?? true) reporter.expect(!!meta.lang, `${input.url}: missing html lang`);
  if (rules.requireOpenGraph) {
    reporter.expect(!!meta.ogTitle && !!meta.ogDescription && !!meta.ogImage && !!meta.ogUrl, `${input.url}: incomplete OG tags`);
  }
  if (rules.requireTwitterCard) reporter.expect(meta.twitterCard === rules.requireTwitterCard, `${input.url}: twitter card mismatch`);
  if (rules.requireImageAlt) reporter.expect(meta.imagesWithoutAlt === 0, `${input.url}: images missing alt`);

  const jsonRules = [
    ...(rules.schemaRules ?? []).filter((rule) => new RegExp(rule.pattern).test(new URL(input.url).pathname)),
    ...(rules.jsonLdRules ?? []).filter((rule) => new RegExp(rule.pattern).test(new URL(input.url).pathname)),
  ];
  if (rules.requireJsonLd || jsonRules.length) {
    reporter.expect(meta.jsonLdBlocks.length > 0, `${input.url}: missing JSON-LD`);
    checkJsonLdRules(reporter, input.url, meta.jsonLdBlocks, jsonRules);
  }

  if ((rules.checkOgImageAccessible ?? true) && meta.ogImage) {
    await checkAssetUrl(reporter, `${input.url}: og:image`, input.base, meta.ogImage, "^image/");
  }
  if ((rules.checkTwitterImageAccessible ?? false) && meta.twitterImage) {
    await checkAssetUrl(reporter, `${input.url}: twitter:image`, input.base, meta.twitterImage, "^image/");
  }
  for (const assetUrl of extractJsonLdUrls(meta.jsonLdBlocks).filter((url) => /\.(png|jpe?g|webp|gif|svg)(?:$|[?#])/i.test(url))) {
    await checkAssetUrl(reporter, `${input.url}: JSON-LD asset`, input.base, assetUrl, "^image/");
  }
  if (input.checkLinks) {
    await checkLinksForPage(reporter, input.config, input.url, response.body, { checkExternalStatus: input.checkExternalStatus });
  }

  const results = reporter.getResults();
  writeCachedResults(input.cache, key, results);
  return { results, cacheHit: false };
}
