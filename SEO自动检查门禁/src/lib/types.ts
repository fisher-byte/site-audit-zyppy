export type SchemaRule = {
  pattern: string;
  type: string;
  requiredFields?: string[];
};

export type RequiredPage = {
  path: string;
  label?: string;
  expectedStatus?: number;
  requireBreadcrumb?: boolean;
  backToListPath?: string;
  expectedSchemaTypes?: string[];
};

export type SmokePath = {
  path: string;
  contains: string;
  label?: string;
};

export type StatusPage = {
  path: string;
  expectedStatus: number;
  mustContain?: string[];
  requireNoindex?: boolean;
  requireHomeLink?: string;
};

export type RedirectPage = {
  path: string;
  expectedLocationPattern?: string;
};

export type NoindexPage = {
  path: string;
  expectedRobots?: string;
};

export type SeoGateConfig = {
  site: {
    publicBaseUrl: string;
    localBaseUrl?: string;
    productionBaseUrl?: string;
    healthPath?: string;
    hostRedirects?: Array<{
      url: string;
      expectedLocationPattern: string;
    }>;
  };
  cache?: {
    enabled?: boolean;
    dir?: string;
    ttlHours?: number;
    cacheFailures?: boolean;
  };
  localVerify?: {
    commandCwd?: string;
    buildCommand?: string;
    startCommand?: string;
    port?: number;
    skipBuildEnv?: string;
    requiredPages: RequiredPage[];
    smokePaths?: SmokePath[];
  };
  sitemaps?: {
    indexPath?: string;
    childSitemaps?: string[];
    forbiddenUrlPatterns?: string[];
    allowRedirects?: boolean;
    sampleInternalLinkPages?: number;
    concurrency?: number;
    deepAudit?: "sample" | "all";
    deepAuditCache?: boolean;
    deepAuditSampleSize?: number;
    requireCanonicalSelf?: boolean;
    requireIndexable?: boolean;
  };
  pageRules?: {
    titleMinLength?: number;
    descriptionMinLength?: number;
    requiredHreflangCount?: number;
    requireXDefaultHreflang?: boolean;
    requireCanonical?: boolean;
    requireSelfCanonical?: boolean;
    requireH1?: boolean;
    requireVisibleH1?: boolean;
    requireOpenGraph?: boolean;
    requireTwitterCard?: string;
    requireJsonLd?: boolean;
    requireImageAlt?: boolean;
    requireViewport?: boolean;
    requireHtmlLang?: boolean;
    requireAbsoluteCanonical?: boolean;
    checkOgImageAccessible?: boolean;
    checkTwitterImageAccessible?: boolean;
    minInternalLinks?: number;
    malformedInternalLinkPatterns?: string[];
    forbiddenInternalHrefs?: string[];
    schemaRules?: SchemaRule[];
    jsonLdRules?: SchemaRule[];
  };
  links?: {
    internalMode?: "sample" | "all";
    externalMode?: "off" | "sample" | "all";
    externalStatusCheck?: "off" | "sample" | "all";
    externalSampleSize?: number;
    requireNoopenerForBlank?: boolean;
    ugcSelectors?: string[];
    sponsoredPatterns?: string[];
    allowedExternalHosts?: string[];
  };
  assets?: {
    robotsPath?: string;
    robotsMustContain?: string[];
    llmsPath?: string;
    llmsMustContain?: string[];
    indexNowKeyPath?: string;
    indexNowKey?: string;
    staticAssets?: Array<{
      url: string;
      expectedContentTypePattern?: string;
    }>;
  };
  specialPages?: {
    statusPages?: StatusPage[];
    noindexPages?: NoindexPage[];
    legacyRedirects?: RedirectPage[];
    hreflangSamplePath?: string;
    botSamplePaths?: string[];
  };
  indexNow?: {
    key: string;
    keyLocation?: string;
    defaultSitemapUrl?: string;
    siteHost?: string;
    maxUrls?: number;
    verifyKey?: boolean;
  };
  reporting?: {
    jsonOutputPath?: string;
    failOnWarnings?: boolean;
  };
};

export type CheckResult = {
  level: "pass" | "warn" | "fail";
  message: string;
};

export type PageMeta = {
  title: string;
  description: string;
  canonical: string;
  h1: string;
  lang: string;
  hreflangCount: number;
  hasXDefault: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  twitterCard: string;
  twitterImage: string;
  viewport: boolean;
  jsonLdBlocks: string[];
  robots: string;
  noindex: boolean;
  internalLinks: string[];
  imagesWithoutAlt: number;
  hasBreadcrumb: boolean;
};
