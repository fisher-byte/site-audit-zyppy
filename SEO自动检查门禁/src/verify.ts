import { spawn, type ChildProcess } from "node:child_process";
import { parseArgs } from "./lib/args.js";
import { loadConfig, localBaseUrl, resolveFromConfig } from "./lib/config.js";
import { isDirectEntry } from "./lib/entry.js";
import { fetchText, waitForUrl } from "./lib/http.js";
import { Reporter } from "./lib/reporter.js";
import { checkPageMeta } from "./lib/seo.js";

function runCommand(command: string, cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
}

function startCommand(command: string, cwd: string): ChildProcess {
  return spawn(command, { cwd, shell: true, stdio: "inherit", env: process.env });
}

export async function runVerify(options = parseArgs()) {
  const { config, configDir } = loadConfig(options.configPath);
  const reporter = new Reporter();
  const localVerify = config.localVerify;
  if (!localVerify) throw new Error("localVerify config is required for seo:verify");

  const cwd = resolveFromConfig(configDir, localVerify.commandCwd);
  const shouldSkipBuild = localVerify.skipBuildEnv ? process.env[localVerify.skipBuildEnv] === "1" : false;
  if (localVerify.buildCommand && !shouldSkipBuild) await runCommand(localVerify.buildCommand, cwd);

  let server: ChildProcess | null = null;
  try {
    if (localVerify.startCommand) {
      server = startCommand(localVerify.startCommand, cwd);
      const healthPath = config.site.healthPath ?? "/";
      await waitForUrl(`${localBaseUrl(config)}${healthPath}`);
    }

    for (const page of localVerify.requiredPages) {
      try {
        const res = await fetchText(`${localBaseUrl(config)}${page.path}`);
        reporter.expect(
          res.status === (page.expectedStatus ?? 200),
          `${page.label ?? page.path}: expected HTTP ${page.expectedStatus ?? 200}, got ${res.status}`
        );
        if (res.status === (page.expectedStatus ?? 200)) checkPageMeta(reporter, config, page, res.body);
      } catch (error) {
        reporter.fail(`${page.label ?? page.path}: fetch failed (${String(error)})`);
      }
    }

    for (const smoke of localVerify.smokePaths ?? []) {
      try {
        const res = await fetchText(`${localBaseUrl(config)}${smoke.path}`);
        reporter.expect(res.body.includes(smoke.contains), `${smoke.label ?? smoke.path}: missing ${smoke.contains}`);
      } catch (error) {
        reporter.fail(`${smoke.label ?? smoke.path}: smoke fetch failed (${String(error)})`);
      }
    }
  } finally {
    if (server && !server.killed) server.kill();
  }

  reporter.print("SEO local verification", {
    json: options.json,
    jsonOutputPath: config.reporting?.jsonOutputPath,
    failOnWarnings: config.reporting?.failOnWarnings,
  });
}

if (isDirectEntry(import.meta.url)) {
  runVerify().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
