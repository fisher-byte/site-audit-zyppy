export type CliArgs = {
  configPath: string;
  json: boolean;
  dryRun: boolean;
  noCache: boolean;
  readCache: boolean;
  writeCache: boolean;
  refreshFailed: boolean;
  cacheTtlHours?: number;
  urls: string[];
};

export function parseArgs(argv = process.argv.slice(2)): CliArgs {
  let configPath = "seo-gate.config.json";
  let json = false;
  let dryRun = process.env.DRY_RUN === "1";
  let noCache = false;
  let readCache = true;
  let writeCache = true;
  let refreshFailed = false;
  let cacheTtlHours: number | undefined;
  const urls: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    } else if (arg === "--config") {
      configPath = argv[++i] ?? configPath;
    } else if (arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-cache") {
      noCache = true;
      readCache = false;
      writeCache = false;
    } else if (arg === "--fresh") {
      readCache = false;
      writeCache = true;
    } else if (arg === "--refresh-failed") {
      refreshFailed = true;
    } else if (arg === "--cache-ttl-hours") {
      const value = Number(argv[++i]);
      if (Number.isFinite(value)) cacheTtlHours = value;
    } else if (arg.startsWith("--cache-ttl-hours=")) {
      const value = Number(arg.slice("--cache-ttl-hours=".length));
      if (Number.isFinite(value)) cacheTtlHours = value;
    } else {
      urls.push(arg);
    }
  }

  return { configPath, json, dryRun, noCache, readCache, writeCache, refreshFailed, cacheTtlHours, urls };
}
