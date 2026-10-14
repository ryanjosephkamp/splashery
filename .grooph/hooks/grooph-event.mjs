#!/usr/bin/env node
/**
 * grooph's event hook (docs/subagents.md; amendment A-012).
 *
 * A harness runs this when a session or a subagent starts or stops, or a tool
 * call finishes. It reads the hook's JSON from standard input and appends ONE
 * line to <project>/.grooph/events/<session id>.jsonl. That is all it does:
 *
 *   - it prints nothing, to standard output or standard error. (Some hooks'
 *     output is fed back to the agent; this one has none to feed.)
 *   - it always exits 0, whatever goes wrong, so it never blocks or fails a step.
 *   - it keeps ids, names and times. It never writes a prompt, a tool's input
 *     or result, or anything an agent said.
 *   - it writes only inside the project it was installed in, and only for
 *     sessions working in that project.
 *
 * No dependencies; any Node from 18 on. `grooph hooks install` copies this
 * file to <project>/.grooph/hooks/ and points the harness at the copy.
 *
 *   node .grooph/hooks/grooph-event.mjs <harness>      harness: claude-code | codex
 */
import { appendFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EVENT = {
  SessionStart: "session-start",
  SessionEnd: "session-end",
  UserPromptSubmit: "turn-start",
  Stop: "turn-end",
  SubagentStart: "subagent-start",
  SubagentStop: "subagent-stop",
  PostToolUse: "tool",
};

const str = (v) => (typeof v === "string" && v !== "" ? v : undefined);
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
const inside = (child, parent) => child === parent || child.startsWith(parent + sep);

function main(input) {
  const harness = str(process.argv[2]) ?? "unknown";
  const payload = JSON.parse(input);
  const event = EVENT[payload.hook_event_name];
  const session = str(payload.session_id);
  if (!event || !session) return;

  // The project is where this file was installed: <project>/.grooph/hooks/grooph-event.mjs.
  // GROOPH_EVENTS_DIR moves the events only; the project test below still applies.
  const project = real(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."));
  const cwd = str(payload.cwd);
  const claudeProject = str(process.env.CLAUDE_PROJECT_DIR);
  const here = (claudeProject !== undefined && real(claudeProject) === project) || (cwd !== undefined && inside(real(cwd), project));
  // A session working somewhere else (Codex writing its memories in the background fires user-level hooks too) is not this project's.
  if (!here) return;

  const line = { v: 1, t: new Date().toISOString(), harness, event, session };
  const agent = str(payload.agent_id);
  if (agent) line.agent = agent;
  const type = str(payload.agent_type);
  if (type) line.type = type;
  if (event === "tool") {
    const tool = str(payload.tool_name);
    if (tool) line.tool = tool;
    // Claude Code's Agent tool returns the id of the subagent it started: the one fact kept from a tool result.
    const response = payload.tool_response;
    const spawned = response && typeof response === "object" ? str(response.agentId) : undefined;
    if (spawned && /^[A-Za-z0-9._-]{1,128}$/.test(spawned)) line.spawned = spawned;
  }
  const model = str(payload.model);
  if (model) line.model = model;
  if (cwd && !agent) line.cwd = cwd;
  if (event === "subagent-stop") {
    const transcript = str(payload.agent_transcript_path);
    if (transcript) line.transcript = transcript;
  }

  const dir = str(process.env.GROOPH_EVENTS_DIR) ?? join(project, ".grooph", "events");
  const name = /^[A-Za-z0-9._-]{1,128}$/.test(session) ? session : Buffer.from(session).toString("hex").slice(0, 64);
  mkdirSync(dir, { recursive: true });
  // One short line, appended in one write: lines from hooks running at the same moment do not interleave.
  appendFileSync(join(dir, `${name}.jsonl`), `${JSON.stringify(line)}\n`);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    main(input);
  } catch {
    // An observer that cannot write must not be heard from.
  }
  process.exit(0);
});
process.stdin.on("error", () => process.exit(0));
