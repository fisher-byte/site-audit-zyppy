import { parseArgs } from "./lib/args.js";
import { buildCacheOptions } from "./lib/cache.js";
import { mapLimit } from "./lib/concurrency.js";
import { productionBaseUrl } from "./lib/config.js";
import { runDeepAuditForUrl } from "./lib/deep-audit.js";
import { isDirectEntry } from "./lib/entry.js";
import { fetchHeadNoFollow, fetchText } from "./lib/http.js";
import { Reporter } from "./lib/reporter.js";
import { fetchSitemapUrls } from "./lib/sitemap.js";
import { checkPageMeta, extractMeta, parseHtml } from "./lib/seo.js";
import { loadConfig } from "./lib/config.js";
import { checkAssetUrl } from "./lib/assets.js";

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

async function checkAssets(reporter: Reporter, base: string, configAssets = {}) {
  const assets = configAssets as NonNullable<ReturnType<typeof loadConfig>["config"]["assets"]>;
  if (assets.robotsPath) {
    const res = await fetchText(`${base}${assets.robotsPath}`);
    reporter.expect(res.status === 200, `${assets.robotsPath}: expected 200, got ${res.status}`);
    for (const text of assets.robotsMustContain ?? []) reporter.expect(res.body.includes(text), `${assets.robotsPath}: missing ${text}`);
  }
  if (assets.llmsPath) {
    const res = await fetchText(`${base}${assets.llmsPath}`);
    reporter.expect(res.status === 200, `${assets.llmsPath}: expected 200, got ${res.status}`);
    for (const text of assets.llmsMustContain ?? []) reporter.expect(res.body.includes(text), `${assets.llmsPath}: missing ${text}`);
  }
  if (assets.indexNowKeyPath && assets.indexNowKey) {
    const res = await fetchText(`${base}${assets.indexNowKeyPath}`);
    reporter.expect(res.status === 200, `${assets.indexNowKeyPath}: expected 200, got ${res.status}`);
    reporter.expect(res.body.trim() === assets.indexNowKey, `${assets.indexNowKeyPath}: key content mismatch`);
  }
  for (const asset of assets.staticAssets ?? []) {
    await checkAssetUrl(reporter, asset.url, base, asset.url, asset.expectedContentTypePattern);
  }
}

export async function runAudit(options = parseArgs()) {
  const { config } = loadConfig(options.configPath);
  const reporter = new Reporter();
  const base = productionBaseUrl(config);
  const cache = buildCacheOptions(config, {
    noCache: options.noCache,
    readCache: options.readCache,
    writeCache: options.writeCache,
    refreshFailed: options.refreshFailed,
    ttlHours: options.cacheTtlHours,
  } as Parameters<typeof buildCacheOptions>[1] & { readCache: boolean; writeCache: boolean });

  await checkAssets(reporter, base, config.assets);

  for (const redirect of config.site.hostRedirects ?? []) {
    const head = await fetchHeadNoFollow(redirect.url);
    reporter.expect(isRedirect(head.status), `${redirect.url}: expected host redirect, got ${head.status}`);
    reporter.expect(new RegExp(redirect.expectedLocationPattern).test(head.location), `${redirect.url}: bad redirect target ${head.location}`);
  }

  const sitemapConfig = config.sitemaps ?? {};
  const sitemap = await fetchSitemapUrls(base, sitemapConfig.indexPath ?? "/sitemap.xml", sitemapConfig.childSitemaps);
  reporter.expect(sitemap.index.status === 200, `${sitemap.sitemapIndexUrl}: expected 200, got ${sitemap.index.status}`);
  reporter.expect(sitemap.childUrls.length > 0, "sitemap: expected child sitemaps");
  reporter.expect(sitemap.allUrls.length > 0, "sitemap: expected URLs");
  const unique = new Set(sitemap.allUrls);
  reporter.expect(unique.size === sitemap.allUrls.length, `sitemap: ${sitemap.allUrls.length - unique.size} duplicate URLs`);

  const concurrency = sitemapConfig.concurrency ?? 8;
  await mapLimit(sitemap.allUrls, concurrency, async (url) => {
    for (const pattern of sitemapConfig.forbiddenUrlPatterns ?? []) {
      reporter.expect(!new RegExp(pattern).test(url), `${url}: forbidden sitemap URL pattern ${pattern}`);
    }
    const head = await fetchHeadNoFollow(url);
    if (sitemapConfig.allowRedirects) {
      reporter.expect(head.status === 200 || isRedirect(head.status), `${url}: expected 200 or redirect, got ${head.status}`);
    } else {
      reporter.expect(head.status === 200, `${url}: expected 200, got ${head.status}`);
    }
  });

  const deepMode = sitemapConfig.deepAudit ?? "sample";
  const deepEntries =
    deepMode === "all"
      ? sitemap.entries
      : sitemap.entries.slice(0, sitemapConfig.deepAuditSampleSize ?? sitemapConfig.sampleInternalLinkPages ?? 30);
  let cacheHits = 0;
  await mapLimit(deepEntries, concurrency, async (entry) => {
    const result = await runDeepAuditForUrl({
      config,
      base,
      url: entry.loc,
      lastmod: entry.lastmod,
      cache,
      checkLinks: (config.links?.internalMode ?? "sample") === "all" || (config.links?.externalMode ?? "sample") === "all",
      checkExternalStatus: (config.links?.externalStatusCheck ?? "sample") === "all",
    });
    if (result.cacheHit) cacheHits += 1;
    for (const item of result.results) {
      if (item.level === "pass") reporter.pass(item.message);
      else if (item.level === "warn") reporter.warn(false, item.message);
      else reporter.fail(item.message);
    }
  });

  const pagesToCheck = config.localVerify?.requiredPages ?? [];
  for (const page of pagesToCheck) {
    try {
      const res = await fetchText(`${base}${page.path}`);
      reporter.expect(res.status === (page.expectedStatus ?? 200), `${page.path}: expected HTTP ${page.expectedStatus ?? 200}, got ${res.status}`);
      if (res.status === (page.expectedStatus ?? 200)) checkPageMeta(reporter, config, page, res.body);
    } catch (error) {
      reporter.fail(`${page.path}: fetch failed (${String(error)})`);
    }
  }

  for (const path of config.specialPages?.botSamplePaths ?? []) {
    const browser = await fetchText(`${base}${path}`, { headers: { "user-agent": "Mozilla/5.0" } });
    const googlebot = await fetchText(`${base}${path}`, { headers: { "user-agent": "Googlebot/2.1" } });
    const bingbot = await fetchText(`${base}${path}`, { headers: { "user-agent": "bingbot/2.0" } });
    const bm = extractMeta(browser.body);
    const gm = extractMeta(googlebot.body);
    const bim = extractMeta(bingbot.body);
    reporter.expect(browser.status === 200, `${path}: browser expected 200, got ${browser.status}`);
    reporter.expect(bm.title === gm.title && bm.title === bim.title, `${path}: title differs between UAs`);
    reporter.expect(bm.h1 === gm.h1 && bm.h1 === bim.h1, `${path}: H1 differs between UAs`);
  }

  for (const page of config.specialPages?.statusPages ?? []) {
    const res = await fetchText(`${base}${page.path}`, { redirect: "manual" });
    reporter.expect(res.status === page.expectedStatus, `${page.path}: expected ${page.expectedStatus}, got ${res.status}`);
    for (const text of page.mustContain ?? []) reporter.expect(res.body.includes(text), `${page.path}: missing ${text}`);
    if (page.requireNoindex) reporter.expect(/noindex/i.test(res.body), `${page.path}: missing noindex`);
    if (page.requireHomeLink) reporter.expect(res.body.includes(`href="${page.requireHomeLink}"`), `${page.path}: missing home link`);
  }

  for (const page of config.specialPages?.noindexPages ?? []) {
    const res = await fetchText(`${base}${page.path}`);
    const robots = extractMeta(res.body).robots;
    const expected = page.expectedRobots ?? "noindex";
    reporter.expect(robots.toLowerCase().includes(expected.toLowerCase()), `${page.path}: expected robots to include ${expected}`);
  }

  for (const redirect of config.specialPages?.legacyRedirects ?? []) {
    const head = await fetchHeadNoFollow(`${base}${redirect.path}`);
    reporter.expect(isRedirect(head.status), `${redirect.path}: expected redirect, got ${head.status}`);
    if (redirect.expectedLocationPattern) {
      reporter.expect(new RegExp(redirect.expectedLocationPattern).test(head.location), `${redirect.path}: bad redirect target ${head.location}`);
    }
  }

  const sampleCount = sitemapConfig.sampleInternalLinkPages ?? 0;
  const linksToCheck = new Set<string>();
  await mapLimit(sitemap.allUrls.slice(0, sampleCount), concurrency, async (url) => {
    const res = await fetchText(url);
    for (const link of extractMeta(res.body).internalLinks) linksToCheck.add(link);
  });
  await mapLimit(Array.from(linksToCheck), concurrency, async (link) => {
    const head = await fetchHeadNoFollow(`${base}${link}`);
    reporter.expect(head.status !== 404, `Internal link 404: ${link}`);
  });

  if (config.specialPages?.hreflangSamplePath) {
    const res = await fetchText(`${base}${config.specialPages.hreflangSamplePath}`);
    const doc = parseHtml(res.body);
    for (const link of Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]'))) {
      const href = link.getAttribute("href") ?? "";
      const lang = link.getAttribute("hreflang") ?? "";
      if (!href || lang === "x-default") continue;
      const head = await fetchHeadNoFollow(href);
      reporter.expect(head.status === 200, `hreflang ${lang} target not 200 (${head.status}): ${href}`);
    }
  }

  console.log(`Sitemap URLs scanned: ${sitemap.allUrls.length}`);
  console.log(`Deep audit URLs: ${deepEntries.length} | cache hits: ${cacheHits}`);
  reporter.print("SEO production audit", {
    json: options.json,
    jsonOutputPath: config.reporting?.jsonOutputPath,
    failOnWarnings: config.reporting?.failOnWarnings,
  });
}

if (isDirectEntry(import.meta.url)) {
  runAudit().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
