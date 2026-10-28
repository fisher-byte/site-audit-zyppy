import type { SchemaRule } from "./types.js";
import { Reporter } from "./reporter.js";

export function parseJsonLdBlocks(blocks: string[], label: string, reporter: Reporter) {
  const parsed: unknown[] = [];
  for (const [index, block] of blocks.entries()) {
    try {
      parsed.push(JSON.parse(block));
      reporter.pass(`${label}: JSON-LD block ${index + 1} is parseable`);
    } catch (error) {
      reporter.fail(`${label}: JSON-LD block ${index + 1} is not valid JSON (${String(error)})`);
    }
  }
  return parsed;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const graph = obj["@graph"];
    return [obj, ...flattenJsonLd(graph)];
  }
  return [];
}

function typeMatches(actual: unknown, expected: string) {
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

function hasField(obj: Record<string, unknown>, fieldPath: string) {
  let cursor: unknown = obj;
  for (const segment of fieldPath.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) return false;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  if (Array.isArray(cursor)) return cursor.length > 0;
  return cursor !== undefined && cursor !== null && String(cursor).trim() !== "";
}

export function checkJsonLdRules(reporter: Reporter, label: string, blocks: string[], rules: SchemaRule[]) {
  const parsed = parseJsonLdBlocks(blocks, label, reporter);
  const nodes = parsed.flatMap(flattenJsonLd);
  for (const rule of rules) {
    const matches = nodes.filter((node) => typeMatches(node["@type"], rule.type));
    reporter.expect(matches.length > 0, `${label}: missing ${rule.type} JSON-LD`);
    for (const field of rule.requiredFields ?? []) {
      reporter.expect(
        matches.some((node) => hasField(node, field)),
        `${label}: ${rule.type} JSON-LD missing required field ${field}`
      );
    }
  }
}

export function extractJsonLdUrls(blocks: string[]) {
  const urls = new Set<string>();
  function walk(value: unknown) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if ((key === "image" || key === "url" || key === "@id") && typeof nested === "string" && /^https?:\/\//.test(nested)) {
        urls.add(nested);
      }
      walk(nested);
    }
  }
  for (const block of blocks) {
    try {
      walk(JSON.parse(block));
    } catch {
      // Invalid JSON-LD is reported by checkJsonLdRules.
    }
  }
  return Array.from(urls);
}
