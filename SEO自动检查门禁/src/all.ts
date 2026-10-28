import { parseArgs } from "./lib/args.js";
import { runAudit } from "./audit-production.js";
import { runVerify } from "./verify.js";

const args = parseArgs();
await runVerify(args);
if (process.exitCode) process.exit(process.exitCode);
await runAudit(args);
