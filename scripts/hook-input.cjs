/**
 * Shared reader for agent hook input (JSON on stdin), used by every hook script in scripts/.
 * Claude Code wires them in .claude/settings.json `hooks` (contract: code.claude.com/docs/en/hooks);
 * Cursor wires them in .cursor/hooks.json (contract: cursor.com/docs/agent/hooks).
 */

/**
 * @param {string} raw stdin text
 * @returns {Record<string, any> | null} parsed object, or null when empty or not JSON
 */
function parseHookInput(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {NodeJS.ReadableStream} [stream]
 * @returns {Promise<string>} full stdin text
 */
function readStdin(stream = process.stdin) {
  return new Promise((resolve) => {
    let raw = "";
    stream.on("data", (chunk) => (raw += chunk));
    stream.on("end", () => resolve(raw));
  });
}

/**
 * Cursor sends `cursor_version` with every hook event; Claude Code never does. Scripts use this to
 * answer in the caller's output format.
 * @param {Record<string, any> | null} input
 * @returns {boolean}
 */
function isCursorInput(input) {
  return Boolean(input && typeof input.cursor_version === "string");
}

/**
 * Directory the hook event happened in. Claude Code sends `cwd`; Cursor sends `cwd` on
 * beforeShellExecution and only `workspace_roots` on other events.
 * @param {Record<string, any> | null} input
 * @returns {string | null}
 */
function resolveCwd(input) {
  if (!input) return null;
  if (typeof input.cwd === "string" && input.cwd !== "") return input.cwd;
  const roots = input.workspace_roots;
  return Array.isArray(roots) && typeof roots[0] === "string" ? roots[0] : null;
}

module.exports = { parseHookInput, readStdin, isCursorInput, resolveCwd };
