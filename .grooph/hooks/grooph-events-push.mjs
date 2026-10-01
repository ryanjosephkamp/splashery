#!/usr/bin/env node
/**
 * Send this project's session events to a branch of their own (docs/subagents.md §6).
 *
 * The event hook writes <project>/.grooph/events/<session id>.jsonl. Those files
 * are a record of what ran, not part of the work: committed with a lane's work
 * they would ride into every pull request. This puts them on a branch that holds
 * nothing else, so another machine can read them and no pull request ever sees them.
 *
 *   node .grooph/hooks/grooph-events-push.mjs [--branch <name>] [--remote <name>] [--no-push]
 *
 *   --branch <name>   the branch to write. Default: grooph-events/<the branch checked out here>.
 *                     Give the whole name when a harness only lets a session push under a
 *                     prefix, for example --branch claude/grooph-events-lane-a
 *   --remote <name>   default: origin
 *   --no-push         make the commit and print its id; send nothing
 *
 * What it does, and all it does:
 *   - it makes one commit whose tree is .grooph/events/ and nothing else, on top
 *     of what that branch already holds on the remote, and pushes it there;
 *   - it never touches the working tree, the index, HEAD or the branch checked
 *     out: nothing is staged, nothing is checked out, no local branch is made;
 *   - event files already on that branch that this clone does not have are kept,
 *     so two sessions may share one branch; a file both have is never made
 *     shorter: lines only one side has are kept from both;
 *   - it writes only to a branch that holds events and nothing else. A branch
 *     with anything else on it (a work branch, main) is refused, and so is the
 *     branch checked out here: an events branch is never a branch of work;
 *   - it sends what the hook wrote: ids, names and times.
 *
 * Read it elsewhere, after a fetch:  grooph sessions lane-a=git:origin/<branch>
 *
 * No dependencies; any Node from 18 on, and git. `grooph hooks install` copies
 * this file to <project>/.grooph/hooks/ beside the hook. `grooph events push`
 * runs the same code.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EVENTS = ".grooph/events";

/** One git command in `cwd`; its output, or undefined when it fails. `input` is given on standard input. */
function git(cwd, args, input) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64_000_000 }).replace(/\n$/, "");
  } catch (err) {
    return undefined;
  }
}

/** The same, but a failure is an error that says what git said. */
function must(cwd, args, input) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64_000_000 }).replace(/\n$/, "");
  } catch (err) {
    const said = String(err?.stderr ?? err?.message ?? err).trim().split("\n").slice(-3).join(" ");
    throw new Error(`git ${args[0]} failed: ${said}`);
  }
}

const validBranch = (cwd, name) => git(cwd, ["check-ref-format", "--branch", name]) !== undefined;

/** The entries of a tree, by name. `-z`: a name with a space, a quote or an accent comes back as it is, not quoted. */
function entriesOf(cwd, treeish) {
  const listed = git(cwd, ["ls-tree", "-z", treeish]);
  if (listed === undefined) return undefined;
  const entries = new Map();
  for (const record of listed.split("\0")) {
    const m = /^(\d+) (\w+) ([0-9a-f]+)\t([\s\S]+)$/.exec(record);
    if (m) entries.set(m[4], { mode: m[1], type: m[2], id: m[3] });
  }
  return entries;
}

/** A tree from its entries, sorted as git sorts them. */
const treeOf = (cwd, entries) =>
  must(
    cwd,
    ["mktree", "-z"],
    [...entries]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, e]) => `${e.mode} ${e.type} ${e.id}\t${name}\0`)
      .join(""),
  );

/**
 * What an events branch may hold: `.grooph/events/` with files in it, and nothing else at any level.
 * Returns why not, or undefined when the commit is one.
 */
function notAnEventsBranch(cwd, commit) {
  const [top, leaf] = EVENTS.split("/");
  const root = entriesOf(cwd, commit);
  if (!root) return "its tree could not be read";
  if (root.size !== 1 || root.get(top)?.type !== "tree") return `it holds other files (${[...root.keys()].filter((n) => n !== top).slice(0, 3).join(", ") || "an unexpected layout"})`;
  const mid = entriesOf(cwd, `${commit}:${top}`);
  if (!mid || mid.size !== 1 || mid.get(leaf)?.type !== "tree") return `its ${top}/ holds more than ${leaf}/`;
  const files = entriesOf(cwd, `${commit}:${EVENTS}`);
  if (!files || [...files.values()].some((e) => e.type !== "blob")) return `its ${EVENTS}/ holds folders`;
  return undefined;
}

/**
 * One event file from two copies. Events are appended, so one copy is normally the other with more lines:
 * then the longer one. When neither continues the other (a session id used again after its file was lost),
 * the branch's lines stay and the lines only this clone has follow them. Nothing is ever dropped.
 */
function joined(onBranch, here) {
  if (here.startsWith(onBranch)) return here;
  if (onBranch.startsWith(here)) return onBranch;
  const had = new Set(onBranch.split("\n"));
  const added = here.split("\n").filter((line) => line !== "" && !had.has(line));
  return `${onBranch}${onBranch.endsWith("\n") || onBranch === "" ? "" : "\n"}${added.join("\n")}${added.length ? "\n" : ""}`;
}

/**
 * @param {{ project: string, branch?: string, remote?: string, push?: boolean, now?: Date }} options
 * @returns {{ status: "nothing" | "unchanged" | "committed" | "pushed", message: string, branch?: string, commit?: string, files?: number }}
 */
export function pushEvents(options) {
  const project = options.project;
  const remote = options.remote ?? "origin";
  if (git(project, ["rev-parse", "--git-dir"]) === undefined) throw new Error(`${project} is not in a git repository`);

  const dir = join(project, EVENTS);
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".jsonl") && statSync(join(dir, name)).isFile())
        .sort()
    : [];
  if (files.length === 0) return { status: "nothing", message: `No events in ${EVENTS}/ yet: nothing to send. The event hook writes them once it is installed (grooph hooks install).` };

  const here = git(project, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const checkedOut = here && here !== "HEAD" ? here : undefined;
  // With no branch checked out (a detached worktree) there is no name to derive one from, and one made from the commit would change with every commit.
  if (!options.branch && !checkedOut) throw new Error("no branch is checked out here, so there is no name to give the events branch: say one with --branch <name>");
  const branch = options.branch ?? `grooph-events/${checkedOut}`;
  if (!validBranch(project, branch)) throw new Error(`"${branch}" is not a branch name git accepts`);
  if (branch === checkedOut) throw new Error(`"${branch}" is the branch checked out here: the events go to a branch of their own, never to a branch of work. Leave --branch out, or name another`);
  const ref = `refs/heads/${branch}`;

  // What the branch holds on the remote now, if it exists there: the new commit goes on top of it.
  let parent;
  if (options.push !== false || git(project, ["remote", "get-url", remote]) !== undefined) {
    if (git(project, ["fetch", "--quiet", "--no-tags", remote, ref]) !== undefined) parent = git(project, ["rev-parse", "--verify", "--quiet", "FETCH_HEAD^{commit}"]);
  }

  // The branch may hold events and nothing else. Anything more is someone's work, and this would replace it.
  if (parent) {
    const why = notAnEventsBranch(project, parent);
    if (why) throw new Error(`${remote} ${branch} is not an events branch: ${why}. Nothing was sent. Name a branch that holds only ${EVENTS}/, or one that does not exist yet`);
  }

  // The tree: every event file on the branch, and every one here; a file both have is joined, never shortened.
  const entries = (parent && entriesOf(project, `${parent}:${EVENTS}`)) || new Map();
  for (const name of files) {
    const local = readFileSync(join(dir, name), "utf8");
    const had = entries.get(name);
    const before = had ? git(project, ["cat-file", "blob", had.id]) : undefined;
    // `git()` trims one trailing newline; the comparison is of lines, so give it back.
    const text = before === undefined ? local : joined(before === "" ? "" : `${before}\n`, local);
    entries.set(name, { mode: "100644", type: "blob", id: must(project, ["hash-object", "-w", "--stdin"], text) });
  }
  const [top, leaf] = EVENTS.split("/");
  const eventsTree = treeOf(project, entries);
  const root = treeOf(project, new Map([[top, { mode: "040000", type: "tree", id: treeOf(project, new Map([[leaf, { mode: "040000", type: "tree", id: eventsTree }]])) }]]));

  if (parent && git(project, ["rev-parse", `${parent}^{tree}`]) === root) {
    return { status: "unchanged", branch, commit: parent, files: entries.size, message: `Nothing new: ${remote} ${branch} already holds these ${entries.size} event file${entries.size === 1 ? "" : "s"}.` };
  }

  // A commit needs a name; a sandbox may have none configured.
  const identity = [];
  if (!git(project, ["config", "user.name"])) identity.push("-c", "user.name=grooph");
  if (!git(project, ["config", "user.email"])) identity.push("-c", "user.email=grooph@localhost");
  const when = (options.now ?? new Date()).toISOString();
  const said = `grooph events: ${entries.size} session file${entries.size === 1 ? "" : "s"}, ${when}`;
  const commit = must(project, [...identity, "commit-tree", root, ...(parent ? ["-p", parent] : []), "-m", said]);

  if (options.push === false) return { status: "committed", branch, commit, files: entries.size, message: `Made commit ${commit.slice(0, 7)} for ${branch} (${entries.size} event file${entries.size === 1 ? "" : "s"}); not sent (--no-push).` };

  must(project, ["push", "--quiet", remote, `${commit}:${ref}`]);
  return {
    status: "pushed",
    branch,
    commit,
    files: entries.size,
    message: `Sent ${entries.size} event file${entries.size === 1 ? "" : "s"} to ${remote} ${branch} (${commit.slice(0, 7)}). Read them elsewhere after a fetch: grooph sessions <name>=git:${remote}/${branch}`,
  };
}

/** The project a copy of this script belongs to: <script>/../.. when it sits in .grooph/hooks/, else where it is run. */
export function projectOf(script, cwd) {
  const dir = dirname(script);
  if (dir.replace(/\\/g, "/").endsWith("/.grooph/hooks")) return resolve(dir, "..", "..");
  return git(cwd, ["rev-parse", "--show-toplevel"]) ?? cwd;
}

/** @returns {number} the exit code */
export function main(argv, project, out = console.log, err = console.error) {
  const options = { project };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--branch" || arg === "--remote") {
      const value = argv[++i];
      if (!value) {
        err(`grooph: ${arg} needs a value`);
        return 1;
      }
      options[arg.slice(2)] = value;
    } else if (arg === "--no-push") options.push = false;
    else {
      err(`grooph: events push does not take "${arg}". Options: --branch <name>, --remote <name>, --no-push`);
      return 1;
    }
  }
  try {
    out(pushEvents(options).message);
    return 0;
  } catch (e) {
    err(`grooph: ${e.message}`);
    return 1;
  }
}

const invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invoked === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2), projectOf(invoked, process.cwd()));
}
