import { parseArgs } from "./lib/args.js";
import { buildCacheOptions } from "./lib/cache.js";
import { mapLimit } from "./lib/concurrency.js";
import { productionBaseUrl } from "./lib/config.js";
import { runDeepAuditForUrl } from "./lib/deep-audit.js";
import { fetchSitemapUrls } from "./lib/sitemap.js";
import { Reporter } from "./lib/reporter.js";
import { loadConfig } from "./lib/config.js";

const options = parseArgs();
const { config } = loadConfig(options.configPath);
const reporter = new Reporter();
const base = productionBaseUrl(config);
const sitemap = await fetchSitemapUrls(base, config.sitemaps?.indexPath ?? "/sitemap.xml", config.sitemaps?.childSitemaps);
const concurrency = config.sitemaps?.concurrency ?? 8;
const cache = buildCacheOptions(config, {
  noCache: options.noCache,
  readCache: options.readCache,
  writeCache: options.writeCache,
  refreshFailed: options.refreshFailed,
  ttlHours: options.cacheTtlHours,
} as Parameters<typeof buildCacheOptions>[1] & { readCache: boolean; writeCache: boolean });
const mode = config.links?.internalMode === "all" || config.links?.externalMode === "all" ? "all" : "sample";
const entries = mode === "all" ? sitemap.entries : sitemap.entries.slice(0, config.sitemaps?.sampleInternalLinkPages ?? 30);
let cacheHits = 0;

await mapLimit(entries, concurrency, async (entry) => {
  const result = await runDeepAuditForUrl({
    config,
    base,
    url: entry.loc,
    lastmod: entry.lastmod,
    cache,
    checkLinks: true,
    checkExternalStatus: (config.links?.externalStatusCheck ?? "sample") !== "off",
  });
  if (result.cacheHit) cacheHits += 1;
  for (const item of result.results) {
    if (item.level === "pass") reporter.pass(item.message);
    else if (item.level === "warn") reporter.warn(false, item.message);
    else reporter.fail(item.message);
  }
});

console.log(`Link audit URLs: ${entries.length} | cache hits: ${cacheHits}`);
reporter.print("SEO link audit", {
  json: options.json,
  jsonOutputPath: config.reporting?.jsonOutputPath,
  failOnWarnings: config.reporting?.failOnWarnings,
});
