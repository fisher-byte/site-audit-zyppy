import { basename } from "node:path";
import { fileURLToPath } from "node:url";

export function isDirectEntry(importMetaUrl: string) {
  const current = fileURLToPath(importMetaUrl);
  const invoked = process.argv[1] ?? "";
  return invoked === current || basename(invoked) === basename(current);
}
