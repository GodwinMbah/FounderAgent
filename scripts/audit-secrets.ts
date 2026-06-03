#!/usr/bin/env tsx
/**
 * Scan tracked repository files for committed Supabase secret values.
 *
 * This intentionally looks for secret-shaped values, not environment variable
 * names such as SUPABASE_SECRET_KEY.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Supabase sb_secret", pattern: /sb_secret_[A-Za-z0-9_-]{16,}/g },
  { name: "JWT-like Supabase key", pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { name: "Private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
];

function trackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  return output.split("\n").filter(Boolean);
}

function main() {
  const findings: Array<{ file: string; pattern: string; count: number }> = [];

  for (const file of trackedFiles()) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of SECRET_PATTERNS) {
      const matches = text.match(spec.pattern);
      if (matches?.length) {
        findings.push({ file, pattern: spec.name, count: matches.length });
      }
    }
  }

  if (findings.length > 0) {
    console.error(JSON.stringify({ ok: false, findings }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, findings: [] }, null, 2));
}

main();
