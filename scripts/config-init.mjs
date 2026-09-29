#!/usr/bin/env node
/**
 * Create config/.env.local from config/.env.example if it is missing.
 *
 *   npm run config:init
 *
 * The real credentials file is git-ignored, so it does not travel with the
 * repo — a fresh clone, or a fresh sandbox, starts without it. This script
 * puts the blank template back in place so there is always one obvious file
 * to fill in. It never overwrites an existing config/.env.local.
 */

import { copyFile, access, constants } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const template = join(root, "config", ".env.example");
const target = join(root, "config", ".env.local");

const exists = async (path) =>
  access(path, constants.F_OK).then(
    () => true,
    () => false
  );

if (!(await exists(template))) {
  console.error("✖ config/.env.example is missing — cannot create the template.");
  process.exit(1);
}

if (await exists(target)) {
  console.log("✓ config/.env.local already exists — left untouched.");
  console.log("  Open it and paste your keys. (Delete it first to start over.)");
  process.exit(0);
}

await copyFile(template, target);
console.log("✓ Created config/.env.local");
console.log("");
console.log("  Open  config/.env.local  and paste your keys after each `=`.");
console.log("  Then restart the dev server. Blank values are fine — the site");
console.log("  falls back to the curated content for anything not filled in.");
