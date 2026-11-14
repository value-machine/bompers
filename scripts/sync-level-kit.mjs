#!/usr/bin/env node
/**
 * Keeps the public level kit in sync with the content catalog in the game code.
 *
 *   node scripts/sync-level-kit.mjs           write public/level-kit/v1/catalog.json and the
 *                                             generated tables in AUTHORING.md / LEVEL_FORMAT.md
 *   node scripts/sync-level-kit.mjs --check   exit 1 when any of them differs (CI, pre-commit)
 *
 * What gets generated: src/features/level-file/services/levelKitExport.ts (loaded through Vite
 * so the TypeScript and the `@/` alias resolve exactly as in the app).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPORT_MODULE = "/src/features/level-file/services/levelKitExport.ts";
const check = process.argv.includes("--check");

const read = (rel) => {
  const file = path.join(ROOT, rel);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};

async function loadPlan() {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { "@": path.join(ROOT, "src") } },
  });
  try {
    const { planLevelKitSync } = await server.ssrLoadModule(EXPORT_MODULE);
    return planLevelKitSync(read);
  } finally {
    await server.close();
  }
}

let plan;
try {
  plan = await loadPlan();
} catch (error) {
  console.error(`level-kit: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const stale = plan.filter((file) => file.current !== file.expected);
if (check) {
  if (stale.length > 0) {
    console.error("level-kit: out of sync with the content catalog in code:");
    for (const file of stale) console.error(`  ${file.path}`);
    console.error("Run `pnpm level-kit:sync` and commit the result.");
    process.exit(1);
  }
  console.log(`level-kit: ${plan.length} files in sync.`);
} else {
  for (const file of stale) {
    writeFileSync(path.join(ROOT, file.path), file.expected);
    console.log(`level-kit: wrote ${file.path}`);
  }
  if (stale.length === 0) console.log("level-kit: already in sync.");
}
