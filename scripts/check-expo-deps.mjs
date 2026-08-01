#!/usr/bin/env node
/**
 * Fails if apps/mobile/package.json declares a native dependency at a version
 * other than the one Expo bundles for the installed SDK.
 *
 *   node scripts/check-expo-deps.mjs          # report + non-zero exit on drift
 *   node scripts/check-expo-deps.mjs --fix    # rewrite package.json to match
 *
 * Why this exists: mismatched native modules do not fail at install time or at
 * typecheck time — they fail three minutes into an EAS Gradle build, e.g.
 *   react-native-screens 4.18 + safe-area-context 4.14 ->
 *     SafeAreaView.kt: Operator '!=' cannot be applied to 'Insets' and 'EdgeInsets'
 * Expo pins a known-good matrix in expo/bundledNativeModules.json; this checks
 * against it offline, so it costs nothing to run in CI.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));

const bundled = require("expo/bundledNativeModules.json");
const pkgPath = join(root, "apps/mobile/package.json");
let raw = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(raw);

const fix = process.argv.includes("--fix");
const drift = [];

for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) {
  const want = bundled[name];
  if (!want || want === spec) continue;
  drift.push({ name, spec, want });
}

if (drift.length === 0) {
  const sdk = require("expo/package.json").version;
  console.log(`✅ apps/mobile native deps match Expo SDK ${sdk}`);
  process.exit(0);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const { name, spec, want } of drift) {
  console.log(`${fix ? "fixing" : "DRIFT "}  ${name}: ${spec} -> ${want}`);
  if (!fix) continue;
  const re = new RegExp(`("${escape(name)}"\\s*:\\s*)"${escape(spec)}"`);
  if (!re.test(raw)) {
    console.error(`  !! could not patch ${name} automatically`);
    continue;
  }
  raw = raw.replace(re, `$1"${want}"`);
}

if (fix) {
  writeFileSync(pkgPath, raw);
  console.log("\napps/mobile/package.json updated — now run: pnpm install");
  process.exit(0);
}

console.error(
  `\n${drift.length} dependency/dependencies differ from the Expo SDK matrix.` +
    `\nRun: node scripts/check-expo-deps.mjs --fix && pnpm install`,
);
process.exit(1);
