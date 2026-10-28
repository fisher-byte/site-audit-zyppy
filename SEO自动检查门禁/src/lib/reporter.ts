import { writeFileSync } from "node:fs";
import type { CheckResult } from "./types.js";

export class Reporter {
  private results: CheckResult[] = [];

  pass(message: string) {
    this.results.push({ level: "pass", message });
  }

  warn(condition: unknown, message: string) {
    if (condition) this.pass(message);
    else this.results.push({ level: "warn", message });
  }

  expect(condition: unknown, message: string) {
    if (condition) this.pass(message);
    else this.results.push({ level: "fail", message });
  }

  fail(message: string) {
    this.results.push({ level: "fail", message });
  }

  merge(other: Reporter) {
    this.results.push(...other.getResults());
  }

  getResults() {
    return [...this.results];
  }

  counts() {
    return {
      pass: this.results.filter((r) => r.level === "pass").length,
      warn: this.results.filter((r) => r.level === "warn").length,
      fail: this.results.filter((r) => r.level === "fail").length,
    };
  }

  print(title: string, opts: { json?: boolean; jsonOutputPath?: string; failOnWarnings?: boolean } = {}) {
    const counts = this.counts();
    const payload = { title, counts, results: this.results };

    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`\n${"=".repeat(60)}`);
      console.log(title);
      console.log(`PASS: ${counts.pass} | WARN: ${counts.warn} | FAIL: ${counts.fail}`);
      console.log("=".repeat(60));
      for (const level of ["warn", "fail"] as const) {
        const items = this.results.filter((r) => r.level === level);
        if (!items.length) continue;
        console.log(`\n${level.toUpperCase()}:`);
        for (const item of items) console.log(`  - ${item.message}`);
      }
    }

    if (opts.jsonOutputPath) writeFileSync(opts.jsonOutputPath, `${JSON.stringify(payload, null, 2)}\n`);
    if (counts.fail > 0 || (opts.failOnWarnings && counts.warn > 0)) process.exitCode = 1;
  }
}
