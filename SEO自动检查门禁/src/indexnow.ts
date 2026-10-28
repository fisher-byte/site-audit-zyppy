import { parseArgs } from "./lib/args.js";
import { loadConfig } from "./lib/config.js";
import { isDirectEntry } from "./lib/entry.js";
import { fetchText } from "./lib/http.js";
import { extractLocs } from "./lib/sitemap.js";

function hostFromUrl(url: string) {
  return new URL(url).host;
}

export async function runIndexNow(options = parseArgs()) {
  const { config } = loadConfig(options.configPath);
  const indexNow = config.indexNow;
  if (!indexNow) throw new Error("indexNow config is required for seo:indexnow");

  const sitemapUrl = indexNow.defaultSitemapUrl ?? `${config.site.publicBaseUrl}/sitemap.xml`;
  const siteHost = indexNow.siteHost ?? hostFromUrl(sitemapUrl);
  const keyLocation = indexNow.keyLocation ?? `https://${siteHost}/${indexNow.key}.txt`;
  const maxUrls = indexNow.maxUrls ?? 100;

  if (indexNow.verifyKey !== false) {
    const key = await fetchText(keyLocation);
    if (key.body.trim() !== indexNow.key) throw new Error(`IndexNow key mismatch at ${keyLocation}`);
  }

  let urls = options.urls;
  if (!urls.length && process.env.CHANGED_URLS) urls = process.env.CHANGED_URLS.split(",").map((u) => u.trim()).filter(Boolean);
  if (!urls.length) {
    const sitemap = await fetchText(sitemapUrl);
    urls = extractLocs(sitemap.body);
  }

  urls = Array.from(new Set(urls)).slice(0, maxUrls);
  if (!urls.length) throw new Error("No URLs to submit");
  for (const url of urls) {
    if (hostFromUrl(url) !== siteHost) throw new Error(`URL host does not match SITE_HOST: ${url}`);
  }

  const payload = {
    host: siteHost,
    key: indexNow.key,
    keyLocation,
    urlList: urls,
  };

  if (options.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  console.log(`IndexNow HTTP ${response.status}`);
  const body = await response.text();
  if (body) console.log(body);
  if (![200, 202].includes(response.status)) process.exitCode = 1;
}

if (isDirectEntry(import.meta.url)) {
  runIndexNow().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
