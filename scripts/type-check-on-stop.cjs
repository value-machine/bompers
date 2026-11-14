#!/usr/bin/env node
/**
 * Stop hook (Claude Code Stop, Cursor stop): before a turn ends, run the repo's `type-check` script when the working
 * tree has uncommitted TypeScript changes, and send the agent back to work while it fails.
 * Catches cross-file breaks (renames, changed signatures) that the per-file PostToolUse lint
 * (scripts/lint-edited-file.cjs) cannot see. Tests stay with pre-commit and CI: a lap's
 * acceptance test is red on purpose until loop-build finishes, so a test gate here would
 * false-block.
 *
 * Cost control:
 * - Skips when no `.ts` / `.tsx` / `tsconfig*.json` file is changed or untracked (pure answers,
 *   docs edits, clean trees — committed work already passed pre-commit's type-check).
 * - Fingerprints the working tree; an unchanged tree that already passed is not re-checked.
 * Loop guard: blocks at most once per failing tree fingerprint. If the agent stops again without
 * changing anything, the turn ends (Claude Code's 8-continuation cap is the outer bound).
 *
 * The tsc invocation is read from package.json `scripts["type-check"]` (SSOT) and run with the
 * TypeScript binary through `node`, so Windows needs no `pnpm` / `.cmd` shim.
 *
 * Contract: exit 0 always. Claude Code: JSON `{decision: "block", reason}` on stdout continues
 * the turn. Cursor: JSON `{followup_message}` is submitted as the next user message (only after a
 * `completed` stop; `loop_limit` in .cursor/hooks.json is the outer bound).
 * Fails open: missing git, node_modules or script → allow the stop.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseHookInput, readStdin, isCursorInput, resolveCwd } = require("./hook-input.cjs");

const STATE_FILE = "claude-type-check-on-stop.json";
const TYPE_CHECK_SCRIPT = "type-check";
const RELEVANT_PATH = /(\.tsx?|(^|\/)tsconfig[^/]*\.json)$/;
const MAX_REASON_LINES = 40;
const TSC_TIMEOUT_MS = 110_000;

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {{status: number | null, stdout: string}}
 */
function defaultRunGit(args, cwd) {
  const res = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: res.status, stdout: res.stdout || "" };
}

/**
 * @param {string} porcelain `git status --porcelain=v1 -z --untracked-files=all` output
 * @returns {string[]} changed paths (rename targets included)
 */
function parseChangedPaths(porcelain) {
  const entries = porcelain.split("\0").filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i].slice(0, 2);
    paths.push(entries[i].slice(3));
    if (status.includes("R") || status.includes("C")) i++; // skip the rename source
  }
  return paths;
}

/**
 * @param {string} root
 * @param {string[]} relevantPaths
 * @param {(args: string[], cwd: string) => {status: number | null, stdout: string}} runGit
 * @returns {string} hash of HEAD, the tracked diff and the relevant files' contents
 */
function fingerprintTree(root, relevantPaths, runGit) {
  const hash = crypto.createHash("sha1");
  hash.update(runGit(["rev-parse", "HEAD"], root).stdout);
  hash.update(runGit(["diff", "HEAD"], root).stdout);
  for (const rel of [...relevantPaths].sort()) {
    hash.update(rel);
    try {
      hash.update(fs.readFileSync(path.join(root, rel)));
    } catch {
      hash.update("<missing>");
    }
  }
  return hash.digest("hex");
}

/**
 * @param {string} root
 * @returns {{status: number | null, output: string} | null} null when tsc can't be run
 */
function defaultRunTypeCheck(root) {
  let script;
  try {
    script = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts[
      TYPE_CHECK_SCRIPT
    ];
  } catch {
    return null;
  }
  const words = typeof script === "string" ? script.trim().split(/\s+/) : [];
  const tscBin = path.join(root, "node_modules", "typescript", "bin", "tsc");
  if (words[0] !== "tsc" || !fs.existsSync(tscBin)) return null;
  const res = spawnSync(process.execPath, [tscBin, ...words.slice(1)], {
    cwd: root,
    encoding: "utf8",
    timeout: TSC_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: res.status, output: `${res.stdout || ""}${res.stderr || ""}` };
}

/**
 * @param {string} output tsc output
 * @returns {string}
 */
function formatReason(output) {
  const lines = output.split(/\r?\n/).filter((l) => l.trim() !== "");
  const shown = lines.slice(0, MAX_REASON_LINES);
  if (lines.length > shown.length) shown.push(`… ${lines.length - shown.length} more lines`);
  return (
    `\`pnpm ${TYPE_CHECK_SCRIPT}\` fails on the working tree. Fix these before ending the turn ` +
    `(or say why they stay):\n${shown.join("\n")}`
  );
}

/**
 * @param {string} file
 * @returns {{passed?: string, failed?: string}}
 */
function readState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/**
 * @typedef {{
 *   runGit?: (args: string[], cwd: string) => {status: number | null, stdout: string},
 *   runTypeCheck?: (root: string) => {status: number | null, output: string} | null,
 *   loadState?: (file: string) => {passed?: string, failed?: string},
 *   saveState?: (file: string, state: {passed?: string, failed?: string}) => void,
 * }} StopDeps
 */

/**
 * @param {{block: boolean, reason?: string}} result
 * @param {boolean} cursor
 * @returns {string} stdout for the caller ("" = allow the stop)
 */
function formatStopOutput(result, cursor) {
  if (!result.block) return "";
  return JSON.stringify(
    cursor ? { followup_message: result.reason } : { decision: "block", reason: result.reason }
  );
}

/**
 * @param {string} raw stdin text
 * @param {StopDeps} [deps]
 * @returns {{block: boolean, reason?: string, skipped?: string, cursor?: boolean}}
 */
function run(raw, deps = {}) {
  const runGit = deps.runGit || defaultRunGit;
  const input = parseHookInput(raw);
  const cursor = isCursorInput(input);
  // Cursor also fires stop on aborted or errored turns; only a finished turn gets a follow-up.
  if (cursor && input.status !== "completed")
    return { block: false, skipped: "turn not completed", cursor };
  const cwd = resolveCwd(input);
  if (!cwd) return { block: false, skipped: "no cwd" };

  const top = runGit(["rev-parse", "--show-toplevel"], cwd);
  const gitDir = runGit(["rev-parse", "--absolute-git-dir"], cwd);
  if (top.status !== 0 || gitDir.status !== 0) return { block: false, skipped: "not a git tree" };
  const root = top.stdout.trim();

  const status = runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"], root);
  const relevant = parseChangedPaths(status.stdout).filter((p) => RELEVANT_PATH.test(p));
  if (relevant.length === 0) return { block: false, skipped: "no TypeScript changes" };

  const stateFile = path.join(gitDir.stdout.trim(), STATE_FILE);
  const state = (deps.loadState || readState)(stateFile);
  const fingerprint = fingerprintTree(root, relevant, runGit);
  if (fingerprint === state.passed) return { block: false, skipped: "unchanged since pass" };
  if (fingerprint === state.failed) return { block: false, skipped: "already reported" };

  const result = (deps.runTypeCheck || defaultRunTypeCheck)(root);
  if (!result || result.status === null) return { block: false, skipped: "type-check unavailable" };

  const save = deps.saveState || ((f, s) => fs.writeFileSync(f, JSON.stringify(s)));
  if (result.status === 0) {
    save(stateFile, { passed: fingerprint });
    return { block: false };
  }
  save(stateFile, { failed: fingerprint });
  return { block: true, reason: formatReason(result.output), cursor };
}

if (require.main === module) {
  void readStdin().then((raw) => {
    try {
      const result = run(raw);
      const out = formatStopOutput(result, Boolean(result.cursor));
      if (out) process.stdout.write(out);
    } catch {
      // fail open: a broken check never traps the agent in the turn
    }
    process.exit(0);
  });
}

module.exports = { parseChangedPaths, formatReason, formatStopOutput, run };
