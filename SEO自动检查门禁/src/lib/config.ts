import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type { SeoGateConfig } from "./types.js";

export type LoadedConfig = {
  config: SeoGateConfig;
  configPath: string;
  configDir: string;
};

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function loadConfig(configPath: string): LoadedConfig {
  const absolutePath = isAbsolute(configPath) ? configPath : resolve(process.cwd(), configPath);
  let parsed: SeoGateConfig;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as SeoGateConfig;
  } catch (error) {
    throw new Error(`Failed to read config ${absolutePath}: ${String(error)}`);
  }

  const failures: string[] = [];
  if (!parsed.site?.publicBaseUrl) failures.push("site.publicBaseUrl is required");
  if (parsed.localVerify && !Array.isArray(parsed.localVerify.requiredPages)) {
    failures.push("localVerify.requiredPages must be an array");
  }
  if (parsed.indexNow && !parsed.indexNow.key) failures.push("indexNow.key is required when indexNow is configured");
  if (failures.length) throw new Error(`Invalid SEO gate config:\n- ${failures.join("\n- ")}`);

  parsed.site.publicBaseUrl = trimTrailingSlash(parsed.site.publicBaseUrl);
  if (parsed.site.localBaseUrl) parsed.site.localBaseUrl = trimTrailingSlash(parsed.site.localBaseUrl);
  if (parsed.site.productionBaseUrl) parsed.site.productionBaseUrl = trimTrailingSlash(parsed.site.productionBaseUrl);

  return {
    config: parsed,
    configPath: absolutePath,
    configDir: dirname(absolutePath),
  };
}

export function resolveFromConfig(configDir: string, maybePath?: string) {
  if (!maybePath) return process.cwd();
  return isAbsolute(maybePath) ? maybePath : resolve(configDir, maybePath);
}

export function publicUrl(config: SeoGateConfig, path = "") {
  return `${config.site.publicBaseUrl}${path.split("?")[0]}`;
}

export function localBaseUrl(config: SeoGateConfig) {
  return config.site.localBaseUrl ?? config.site.publicBaseUrl;
}

export function productionBaseUrl(config: SeoGateConfig) {
  return config.site.productionBaseUrl ?? config.site.publicBaseUrl;
}
