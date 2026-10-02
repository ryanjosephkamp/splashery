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
 *   --hook            run as a harness hook at the end of a turn (grooph hooks install --push):
 *                     wait a moment for the event hook's own line, then push; print nothing
 *                     and exit 0 whatever happens; give way if another push is under way
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
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EVENTS = ".grooph/events";

/**
 * How git is run. By a person, as it is. As a hook, unattended: git must never ask for a password on a terminal
 * nobody is at, and no call may outlast its limit, or a turn's end would hang on a remote that does not answer.
 */
const how = { env: process.env, limits: undefined, deadline: undefined };
/** The time one call may take: its own limit, and never past the whole run's deadline. */
const limitFor = (args) => {
  const own = how.limits?.[args[0]] ?? how.limits?.other;
  if (own === undefined || how.deadline === undefined) return own;
  const left = how.deadline - Date.now();
  if (left < 500) throw new Error("out of time");
  return Math.min(own, left);
};
/**
 * A call that talks to a remote, with a limit, on a system with a shell: git is started in a process group of its
 * own and the whole group is stopped when the time is up. Stopping git alone would leave its helper (the program
 * that holds the connection) running after it, one more for every turn that ends while the remote is down.
 */
const GROUPED = 'set -m 2>/dev/null; t="$1"; shift; "$@" & pid=$!; ( sleep "$t"; kill -9 -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null ) >/dev/null 2>&1 & guard=$!; wait "$pid"; code=$?; kill "$guard" 2>/dev/null; exit "$code"';
const run = (cwd, args, input) => {
  const limit = limitFor(args);
  const options = { encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], maxBuffer: 64_000_000, env: how.env };
  const remote = args[0] === "fetch" || args[0] === "push";
  // The connection itself has limits too, for the helper's sake: no ten-minute waits on a link that has gone quiet.
  const patient = remote && limit ? ["-c", "http.lowSpeedLimit=1000", "-c", "http.lowSpeedTime=10"] : [];
  if (remote && limit && process.platform !== "win32") {
    const out = execFileSync("sh", ["-c", GROUPED, "sh", String(Math.max(1, Math.ceil(limit / 1000))), "git", "-C", cwd, ...patient, ...args], { ...options, timeout: limit + 3000, killSignal: "SIGKILL" });
    return out.replace(/\n$/, "");
  }
  return execFileSync("git", ["-C", cwd, ...patient, ...args], { ...options, ...(limit ? { timeout: limit, killSignal: "SIGKILL" } : {}) }).replace(/\n$/, "");
};

/** One git command in `cwd`; its output, or undefined when it fails. `input` is given on standard input. */
function git(cwd, args, input) {
  try {
    return run(cwd, args, input);
  } catch (err) {
    return undefined;
  }
}

/** The same, but a failure is an error that says what git said. */
function must(cwd, args, input) {
  try {
    return run(cwd, args, input);
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

  const hasRemote = git(project, ["remote", "get-url", remote]) !== undefined;
  if (!hasRemote && options.push !== false) throw new Error(`there is no remote named "${remote}" here`);

  // The branch's tip on the remote is fetched into a ref of grooph's own, never into FETCH_HEAD: a session that
  // fetched something and means to use FETCH_HEAD next must still find what it fetched there.
  const TIP = "refs/grooph/events-tip";
  const tipOnRemote = () => {
    if (!hasRemote) return undefined;
    const spec = `+${ref}:${TIP}`;
    // `--no-write-fetch-head` is git 2.29 and later. An older git has no way to fetch without writing FETCH_HEAD.
    const [major, minor] = (/(\d+)\.(\d+)/.exec(git(project, ["version"]) ?? "") ?? []).slice(1).map(Number);
    const keep = major > 2 || (major === 2 && minor >= 29) ? ["--no-write-fetch-head"] : [];
    const began = Date.now();
    const fetched = git(project, ["fetch", "--quiet", "--no-tags", ...keep, remote, spec]);
    // A fetch that used up its whole limit did not learn that the branch is missing: the remote did not answer.
    if (fetched === undefined && how.limits && Date.now() - began >= (how.limits.fetch ?? Infinity) - 500) throw new Error(`${remote} did not answer in time`);
    return fetched === undefined ? undefined : git(project, ["rev-parse", "--verify", "--quiet", `${TIP}^{commit}`]);
  };

  // Another session may send to the same branch between this one's fetch and its push. Git then refuses the push,
  // and the answer is to look again and put this commit on top of theirs: three tries, then give up and say so.
  for (let attempt = 1; ; attempt += 1) {
    // What the branch holds on the remote now, if it exists there: the new commit goes on top of it.
    const parent = tipOnRemote();

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
    const count = `${entries.size} event file${entries.size === 1 ? "" : "s"}`;

    if (parent && git(project, ["rev-parse", `${parent}^{tree}`]) === root) {
      return { status: "unchanged", branch, commit: parent, files: entries.size, message: `Nothing new: ${remote} ${branch} already holds these ${count}.` };
    }

    // A commit needs a name; a sandbox may have none configured.
    const identity = [];
    if (!git(project, ["config", "user.name"])) identity.push("-c", "user.name=grooph");
    if (!git(project, ["config", "user.email"])) identity.push("-c", "user.email=grooph@localhost");
    const when = (options.now ?? new Date()).toISOString();
    const commit = must(project, [...identity, "commit-tree", root, ...(parent ? ["-p", parent] : []), "-m", `grooph events: ${entries.size} session file${entries.size === 1 ? "" : "s"}, ${when}`]);

    if (options.push === false) return { status: "committed", branch, commit, files: entries.size, message: `Made commit ${commit.slice(0, 7)} for ${branch} (${count}); not sent (--no-push).` };

    try {
      must(project, ["push", "--quiet", remote, `${commit}:${ref}`]);
    } catch (err) {
      if (attempt < 3) continue;
      throw err;
    }
    return {
      status: "pushed",
      branch,
      commit,
      files: entries.size,
      message: `Sent ${count} to ${remote} ${branch} (${commit.slice(0, 7)}). Read them elsewhere after a fetch: grooph sessions <name>=git:${remote}/${branch}`,
    };
  }
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

/**
 * As a hook at the end of a turn. A session's events are only seen elsewhere when they are sent, and a session
 * cannot send what it writes as it stops: so this runs when a turn ends, after the event hook's line for that end.
 * It keeps the event hook's promises: nothing printed, exit 0 whatever happens, nothing the harness reads back.
 * It is not the event hook, and it is installed only when asked for (--push).
 *
 * A harness runs the hooks of one event side by side, so the turn's own last line may not be written yet:
 * `settle` waits for it. One push at a time: a lock folder beside the events; a lock more than two minutes
 * from now, either way, was left by a push that died or by a wrong clock, and is taken over.
 *
 * Unattended: git is told never to ask anything of a terminal, and every call has a limit, so a remote that
 * wants a password or never answers costs a turn's end some seconds and never hangs it. If the harness stops
 * this process, the lock goes with it.
 */
export async function hookMain(argv, project, settle = Number(process.env.GROOPH_PUSH_SETTLE_MS ?? 1500)) {
  const lock = join(project, EVENTS, ".pushing");
  let mine = false;
  const release = () => {
    if (!mine) return;
    mine = false;
    try {
      rmSync(lock, { recursive: true, force: true });
    } catch {
      // left for the next push to take over
    }
  };
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.once(signal, () => {
      release();
      process.exit(0);
    });
  }
  try {
    // Everything together stays well inside the hook's own limit of sixty seconds, retries included.
    how.limits = { fetch: 12_000, push: 20_000, other: 8_000 };
    how.deadline = Date.now() + 45_000;
    how.env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "", SSH_ASKPASS: "", GCM_INTERACTIVE: "never" };
    // ssh asks on the terminal by itself; batch mode stops it. A project's or a person's own ssh command is left alone.
    if (!process.env.GIT_SSH_COMMAND && !git(project, ["config", "core.sshCommand"])) how.env.GIT_SSH_COMMAND = "ssh -oBatchMode=yes -oConnectTimeout=10";
    await new Promise((done) => setTimeout(done, Number.isFinite(settle) && settle >= 0 ? settle : 1500));
    if (!existsSync(join(project, EVENTS))) return 0;
    try {
      mkdirSync(lock);
      mine = true;
    } catch {
      if (Math.abs(Date.now() - statSync(lock).mtimeMs) < 120_000) return 0; // another push is under way; the next turn's will carry this one's lines
      rmSync(lock, { recursive: true, force: true });
      mkdirSync(lock);
      mine = true;
    }
    main(argv.filter((arg) => arg !== "--hook"), project, () => {}, () => {});
  } catch {
    // A hook that fails must not fail a turn.
  } finally {
    release();
  }
  return 0;
}

const invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invoked === realpathSync(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  const project = projectOf(invoked, process.cwd());
  process.exitCode = argv.includes("--hook") ? await hookMain(argv, project) : main(argv, project);
}
