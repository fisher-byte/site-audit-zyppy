import { createHash } from "node:crypto";
import { rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, SeoGateConfig } from "./types.js";

export type CacheOptions = {
  enabled: boolean;
  dir: string;
  ttlHours: number;
  cacheFailures: boolean;
  noCache: boolean;
  readCache: boolean;
  writeCache: boolean;
  refreshFailed: boolean;
};

type CachedResults = {
  createdAt: string;
  expiresAt: string;
  hasFailures: boolean;
  results: CheckResult[];
};

export function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

export function buildCacheOptions(config: SeoGateConfig, overrides: { noCache?: boolean; refreshFailed?: boolean; ttlHours?: number }) {
  return {
    enabled: config.cache?.enabled !== false,
    dir: config.cache?.dir ?? ".seo-gate-cache",
    ttlHours: overrides.ttlHours ?? config.cache?.ttlHours ?? 24,
    cacheFailures: config.cache?.cacheFailures ?? false,
    noCache: overrides.noCache ?? false,
    readCache: (overrides as { readCache?: boolean }).readCache ?? true,
    writeCache: (overrides as { writeCache?: boolean }).writeCache ?? true,
    refreshFailed: overrides.refreshFailed ?? false,
  } satisfies CacheOptions;
}

export function clearCache(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function fileFor(dir: string, key: string) {
  return join(dir, `${key}.json`);
}

export function makeCacheKey(input: {
  url: string;
  checkType: string;
  configHash: string;
  validators?: string[];
}) {
  return hashValue(input);
}

export function readCachedResults(options: CacheOptions, key: string) {
  if (!options.enabled || options.noCache || !options.readCache) return null;
  const file = fileFor(options.dir, key);
  if (!existsSync(file)) return null;
  try {
    const cached = JSON.parse(readFileSync(file, "utf8")) as CachedResults;
    if (new Date(cached.expiresAt).getTime() < Date.now()) return null;
    if (cached.hasFailures && (!options.cacheFailures || options.refreshFailed)) return null;
    return cached.results;
  } catch {
    return null;
  }
}

export function writeCachedResults(options: CacheOptions, key: string, results: CheckResult[]) {
  if (!options.enabled || options.noCache || !options.writeCache) return;
  const hasFailures = results.some((result) => result.level === "fail");
  if (hasFailures && !options.cacheFailures) return;
  mkdirSync(options.dir, { recursive: true });
  const now = Date.now();
  const payload: CachedResults = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + options.ttlHours * 60 * 60 * 1000).toISOString(),
    hasFailures,
    results,
  };
  writeFileSync(fileFor(options.dir, key), `${JSON.stringify(payload, null, 2)}\n`);
}

export function cacheableConfigHash(config: SeoGateConfig) {
  return hashValue({
    version: 2,
    site: config.site,
    sitemaps: config.sitemaps,
    pageRules: config.pageRules,
    links: config.links,
    assets: config.assets,
  });
}
