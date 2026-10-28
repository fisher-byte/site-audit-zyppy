import assert from "node:assert/strict";
import test from "node:test";
import { Reporter } from "./reporter.js";
import { checkPageMeta } from "./seo.js";
import type { RequiredPage, SeoGateConfig } from "./types.js";

const baseConfig: SeoGateConfig = {
  site: {
    publicBaseUrl: "https://example.com",
  },
  pageRules: {
    titleMinLength: 10,
    descriptionMinLength: 40,
    requiredHreflangCount: 3,
    requireXDefaultHreflang: true,
    requireCanonical: true,
    requireSelfCanonical: true,
    requireH1: true,
    requireOpenGraph: true,
    requireTwitterCard: "summary_large_image",
    requireJsonLd: true,
    requireImageAlt: false,
    requireViewport: true,
    requireHtmlLang: true,
    requireAbsoluteCanonical: true,
    minInternalLinks: 0,
  },
};

const basePage: RequiredPage = {
  path: "/",
  label: "home",
};

function buildHtml(overrides: {
  canonical?: string;
  hreflang?: string;
  title?: string;
  description?: string;
} = {}) {
  const title = overrides.title ?? "Free online PDF tools | pdfClaw";
  const description =
    overrides.description ??
    "pdfClaw is a privacy-first free online PDF toolkit for OCR, conversion, merge, split, compression, and document workflows.";
  const canonical = overrides.canonical ?? "https://example.com/";
  const hreflang =
    overrides.hreflang ??
    `
    <link rel="alternate" hreflang="zh-CN" href="https://example.com/" />
    <link rel="alternate" hreflang="en" href="https://example.com/en" />
    <link rel="alternate" hreflang="zh-HK" href="https://example.com/hk" />
    <link rel="alternate" hreflang="ja" href="https://example.com/jp" />
    <link rel="alternate" hreflang="x-default" href="https://example.com/" />
    `;
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="${canonical}" />
        ${hreflang}
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="https://example.com/logo.svg" />
        <meta property="og:url" content="https://example.com/" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{"@type":"WebPage"}</script>
      </head>
      <body>
        <h1>pdfClaw</h1>
      </body>
    </html>
  `;
}

test("checkPageMeta accepts homepage canonical with trailing slash", () => {
  const reporter = new Reporter();
  checkPageMeta(reporter, baseConfig, basePage, buildHtml());
  const failures = reporter.getResults().filter((item) => item.level === "fail");
  assert.equal(
    failures.some((item) => item.message.includes("canonical mismatch")),
    false,
  );
});

test("checkPageMeta still fails when canonical points to the wrong path", () => {
  const reporter = new Reporter();
  checkPageMeta(
    reporter,
    baseConfig,
    basePage,
    buildHtml({ canonical: "https://example.com/en" }),
  );
  const failures = reporter.getResults().filter((item) => item.level === "fail");
  assert.equal(
    failures.some((item) => item.message.includes("canonical mismatch")),
    true,
  );
});
