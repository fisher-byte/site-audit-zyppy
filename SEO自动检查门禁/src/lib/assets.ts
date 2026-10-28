import { fetchHeadNoFollow } from "./http.js";
import { Reporter } from "./reporter.js";

function absoluteUrl(base: string, maybeUrl: string) {
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return "";
  }
}

export async function checkAssetUrl(
  reporter: Reporter,
  label: string,
  base: string,
  url: string,
  expectedContentTypePattern?: string
) {
  const target = absoluteUrl(base, url);
  reporter.expect(!!target, `${label}: invalid asset URL (${url})`);
  if (!target) return;
  const head = await fetchHeadNoFollow(target);
  reporter.expect(head.status === 200, `${label}: asset not accessible (${head.status}): ${target}`);
  if (expectedContentTypePattern) {
    const response = await fetch(target, { method: "HEAD", redirect: "manual", headers: { "user-agent": "SeoGate/0.1" } });
    const contentType = response.headers.get("content-type") ?? "";
    reporter.expect(new RegExp(expectedContentTypePattern).test(contentType), `${label}: unexpected content-type ${contentType}: ${target}`);
  }
}
