import { parseArgs } from "./lib/args.js";
import { buildCacheOptions, clearCache } from "./lib/cache.js";
import { loadConfig } from "./lib/config.js";

const options = parseArgs();
const { config } = loadConfig(options.configPath);
const cache = buildCacheOptions(config, {
  noCache: false,
  refreshFailed: false,
  ttlHours: options.cacheTtlHours,
});
clearCache(cache.dir);
console.log(`Cleared SEO gate cache: ${cache.dir}`);
